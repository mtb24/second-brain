import type { PoolClient } from 'pg'
import {
  addDays,
  dateInTimeZone,
  dayKey,
  rangeStart,
} from './date'
import type {
  BodyMetricEntry,
  BodyMetricInput,
  Exercise,
  ExercisePerformance,
  PrRecord,
  SetEntry,
  SetEntryInput,
  Source,
  WorkoutAnalytics,
  WorkoutDashboard,
  WorkoutProfile,
  WorkoutSession,
} from './types'
import { getWorkoutPool, withWorkoutTransaction } from './db'

type Queryable = Pick<PoolClient, 'query'>
type WorkoutProfilePatch = Partial<Omit<WorkoutProfile, 'accessibilitySettings'>> & {
  accessibilitySettings?: Partial<WorkoutProfile['accessibilitySettings']>
}

type AuditInput = {
  actorType?: 'user' | 'assistant' | 'system'
  actorId?: string
  action: string
  entityType: string
  entityId?: string | null
  before?: unknown
  after?: unknown
  source?: Source
  sourceMessageId?: string
}

type PlannedMovementRow = {
  id: string
  routine_day_id: string
  exercise_id: string
  target_sets: number
  target_reps_min: number
  target_reps_max: number
  target_load: string | null
  target_intensity_type: string
  target_intensity_value: string | null
  progression_rule_id: string | null
  notes: string
  order_index: number
  exercise_name: string
  movement_pattern: string
  primary_muscles_json: string[] | null
  equipment_type: string
  rule_name: string | null
  rule_type: string | null
  rule_version: number | null
  config_json: Record<string, unknown> | null
}

const emptyAccessibility = {
  largeText: true,
  highContrast: true,
  reduceMotion: false,
}

export async function getDashboard(): Promise<WorkoutDashboard> {
  const profile = await getProfile()
  const today = dateInTimeZone(profile.timezone)
  const todaySession = await getSessionForDate(today)
  const nextSession = await getNextSession(today)
  const activePerformance = todaySession
    ? pickActivePerformance(todaySession)
    : nextSession
      ? pickActivePerformance(nextSession)
      : null

  const [analytics, exercises] = await Promise.all([
    getAnalytics('month'),
    getExercises(),
  ])

  return {
    profile,
    today,
    todaySession,
    nextSession,
    activePerformance,
    analytics,
    exercises,
  }
}

export async function getProfile(client: Queryable = getWorkoutPool()): Promise<WorkoutProfile> {
  await client.query(`
    INSERT INTO workout_user_profile (id)
    VALUES ('default')
    ON CONFLICT (id) DO NOTHING
  `)
  const { rows } = await client.query(`
    SELECT
      id,
      display_name,
      timezone,
      goal_type,
      training_age,
      available_days,
      session_length_minutes,
      equipment_profile,
      injury_notes,
      preferred_units,
      exercise_aliases_json,
      accessibility_settings
    FROM workout_user_profile
    WHERE id = 'default'
  `)

  const row = rows[0]
  return {
    id: row.id,
    displayName: row.display_name,
    timezone: row.timezone,
    goalType: row.goal_type,
    trainingAge: row.training_age,
    availableDays: arrayJson(row.available_days),
    sessionLengthMinutes: Number(row.session_length_minutes),
    equipmentProfile: objectJson(row.equipment_profile),
    injuryNotes: row.injury_notes ?? '',
    preferredUnits: row.preferred_units,
    exerciseAliasesJson: objectJson(row.exercise_aliases_json),
    accessibilitySettings: {
      ...emptyAccessibility,
      ...objectJson(row.accessibility_settings),
    },
  }
}

export async function patchProfile(
  patch: WorkoutProfilePatch,
  source: Source = 'ui',
) {
  return withWorkoutTransaction(async (client) => {
    const before = await getProfile(client)
    const next = {
      displayName: patch.displayName ?? before.displayName,
      timezone: patch.timezone ?? before.timezone,
      goalType: patch.goalType ?? before.goalType,
      trainingAge: patch.trainingAge ?? before.trainingAge,
      availableDays: patch.availableDays ?? before.availableDays,
      sessionLengthMinutes: patch.sessionLengthMinutes ?? before.sessionLengthMinutes,
      equipmentProfile: patch.equipmentProfile ?? before.equipmentProfile,
      injuryNotes: patch.injuryNotes ?? before.injuryNotes,
      preferredUnits: patch.preferredUnits ?? before.preferredUnits,
      exerciseAliasesJson: patch.exerciseAliasesJson ?? before.exerciseAliasesJson,
      accessibilitySettings: {
        ...before.accessibilitySettings,
        ...(patch.accessibilitySettings ?? {}),
      },
    }

    await client.query(
      `UPDATE workout_user_profile
       SET display_name = $1,
           timezone = $2,
           goal_type = $3,
           training_age = $4,
           available_days = $5::jsonb,
           session_length_minutes = $6,
           equipment_profile = $7::jsonb,
           injury_notes = $8,
           preferred_units = $9,
           exercise_aliases_json = $10::jsonb,
           accessibility_settings = $11::jsonb,
           updated_at = now()
       WHERE id = 'default'`,
      [
        next.displayName,
        next.timezone,
        next.goalType,
        next.trainingAge,
        JSON.stringify(next.availableDays),
        next.sessionLengthMinutes,
        JSON.stringify(next.equipmentProfile),
        next.injuryNotes,
        next.preferredUnits,
        JSON.stringify(next.exerciseAliasesJson),
        JSON.stringify(next.accessibilitySettings),
      ],
    )
    await audit(client, {
      action: 'update_profile',
      entityType: 'workout_user_profile',
      entityId: 'default',
      before,
      after: next,
      source,
    })
    return getProfile(client)
  })
}

export async function getExercises(client: Queryable = getWorkoutPool()): Promise<Exercise[]> {
  const { rows } = await client.query(`
    SELECT
      id,
      canonical_name,
      aliases_json,
      movement_pattern,
      primary_muscles_json,
      equipment_type,
      default_rest_seconds,
      notes,
      active
    FROM workout_exercises
    WHERE active = true
    ORDER BY canonical_name
  `)
  return rows.map(mapExercise)
}

export async function findExerciseByName(
  name: string,
  client: Queryable = getWorkoutPool(),
): Promise<Exercise | null> {
  const normalized = normalizeName(name)
  const exercises = await getExercises(client)

  const exact = exercises.find((exercise) => {
    if (normalizeName(exercise.canonicalName) === normalized) return true
    return exercise.aliases.some((alias) => normalizeName(alias) === normalized)
  })
  if (exact) return exact

  const partial = exercises.find((exercise) => {
    const names = [exercise.canonicalName, ...exercise.aliases].map(normalizeName)
    return names.some((candidate) => candidate.includes(normalized) || normalized.includes(candidate))
  })

  return partial ?? null
}

export async function generateWeekPlan(source: Source = 'ui'): Promise<WorkoutSession[]> {
  return withWorkoutTransaction(async (client) => {
    const profile = await getProfile(client)
    const constraints = await getConstraints(client)
    if (!constraints) throw new Error('Workout constraints are not available')
    const today = dateInTimeZone(profile.timezone)
    const activeRoutine = await getActiveRoutine(client)
    if (!activeRoutine) return []

    const routineDays = await getRoutineDays(activeRoutine.id, client)
    if (!routineDays.length) return []

    const availableDays = new Set(
      arrayJson(constraints.available_days_json ?? profile.availableDays).map((day) => day.toLowerCase()),
    )
    const unavailableDates = new Set(arrayJson(constraints.unavailable_dates_json))

    const existingCount = await one<{ count: string }>(
      client,
      `SELECT COUNT(*)::text AS count
       FROM workout_sessions
       WHERE routine_template_id = $1`,
      [activeRoutine.id],
    )
    let dayOffset = Number(existingCount?.count ?? 0)
    const created: WorkoutSession[] = []

    for (let i = 0; i < 7; i += 1) {
      const date = addDays(today, i)
      if (!availableDays.has(dayKey(date))) continue
      if (unavailableDates.has(date)) continue

      const existing = await one<{ id: string }>(
        client,
        `SELECT id FROM workout_sessions
         WHERE scheduled_for = $1::date
           AND status <> 'skipped'
         LIMIT 1`,
        [date],
      )
      if (existing) continue

      const routineDay = routineDays[dayOffset % routineDays.length]
      dayOffset += 1

      const sessionRow = await one<{ id: string }>(
        client,
        `INSERT INTO workout_sessions (
           scheduled_for, status, routine_template_id, routine_day_id,
           created_by_source, notes, rule_snapshot_json
         )
         VALUES ($1::date, 'planned', $2, $3, $4, '', $5::jsonb)
         RETURNING id`,
        [
          date,
          activeRoutine.id,
          routineDay.id,
          source,
          JSON.stringify({
            routine: activeRoutine.name,
            routineDay: routineDay.label,
            generatedAt: new Date().toISOString(),
          }),
        ],
      )
      if (!sessionRow) throw new Error('Unable to create workout session')

      await createPerformancesForSession(client, sessionRow.id)
      await audit(client, {
        action: 'generate_session',
        entityType: 'workout_session',
        entityId: sessionRow.id,
        after: { scheduledFor: date, routineDay: routineDay.label },
        source,
      })

      const session = await getSessionById(sessionRow.id, client)
      if (session) created.push(session)
    }

    return created
  })
}

export async function getSessionForDate(
  date: string,
  client: Queryable = getWorkoutPool(),
): Promise<WorkoutSession | null> {
  const row = await one<{ id: string }>(
    client,
    `SELECT id
     FROM workout_sessions
     WHERE scheduled_for = $1::date
       AND status <> 'skipped'
     ORDER BY created_at DESC
     LIMIT 1`,
    [date],
  )
  return row ? getSessionById(row.id, client) : null
}

export async function getNextSession(
  fromDate?: string,
  client: Queryable = getWorkoutPool(),
): Promise<WorkoutSession | null> {
  const profile = await getProfile(client)
  const today = fromDate ?? dateInTimeZone(profile.timezone)
  const row = await one<{ id: string }>(
    client,
    `SELECT id
     FROM workout_sessions
     WHERE scheduled_for >= $1::date
       AND status IN ('planned', 'in_progress')
     ORDER BY scheduled_for ASC, created_at ASC
     LIMIT 1`,
    [today],
  )
  return row ? getSessionById(row.id, client) : null
}

export async function listSessions(limit = 30): Promise<WorkoutSession[]> {
  const { rows } = await getWorkoutPool().query(
    `SELECT id
     FROM workout_sessions
     ORDER BY scheduled_for DESC, created_at DESC
     LIMIT $1`,
    [limit],
  )
  const sessions = await Promise.all(
    rows.map((row) => getSessionById(String(row.id))),
  )
  return sessions.filter((session): session is WorkoutSession => Boolean(session))
}

export async function getSessionById(
  id: string,
  client: Queryable = getWorkoutPool(),
): Promise<WorkoutSession | null> {
  const session = await one<Record<string, unknown>>(
    client,
    `SELECT
       ws.id,
       ws.scheduled_for::text,
       ws.started_at,
       ws.completed_at,
       ws.status,
       ws.routine_template_id,
       ws.routine_day_id,
       ws.notes,
       ws.created_by_source,
       rd.label AS routine_day_label
     FROM workout_sessions ws
     LEFT JOIN workout_routine_days rd ON rd.id = ws.routine_day_id
     WHERE ws.id = $1`,
    [id],
  )
  if (!session) return null

  const performances = await getPerformancesForSession(id, client)
  return {
    id: String(session.id),
    scheduledFor: String(session.scheduled_for),
    startedAt: isoOrNull(session.started_at),
    completedAt: isoOrNull(session.completed_at),
    status: String(session.status),
    routineTemplateId: nullableString(session.routine_template_id),
    routineDayId: nullableString(session.routine_day_id),
    routineDayLabel: nullableString(session.routine_day_label),
    notes: String(session.notes ?? ''),
    createdBySource: String(session.created_by_source ?? 'system'),
    performances,
  }
}

export async function startSession(id: string, source: Source = 'ui') {
  return withWorkoutTransaction(async (client) => {
    const before = await getSessionById(id, client)
    if (!before) throw new Error('Workout session not found')
    const profile = await getProfile(client)
    const today = dateInTimeZone(profile.timezone)
    const scheduledFor = before.scheduledFor > today ? today : before.scheduledFor

    await createPerformancesForSession(client, id)
    await client.query(
      `UPDATE workout_sessions
       SET status = 'in_progress',
           started_at = COALESCE(started_at, now()),
           scheduled_for = $2::date,
           updated_at = now()
       WHERE id = $1`,
      [id, scheduledFor],
    )
    await audit(client, {
      action: 'start_session',
      entityType: 'workout_session',
      entityId: id,
      before,
      after: { status: 'in_progress', scheduledFor },
      source,
    })
    return getSessionById(id, client)
  })
}

export async function completeSession(id: string, source: Source = 'ui') {
  return withWorkoutTransaction(async (client) => {
    const before = await getSessionById(id, client)
    if (!before) throw new Error('Workout session not found')
    await client.query(
      `UPDATE workout_sessions
       SET status = 'completed',
           completed_at = COALESCE(completed_at, now()),
           updated_at = now()
       WHERE id = $1`,
      [id],
    )
    await client.query(
      `UPDATE workout_exercise_performances
       SET status = CASE WHEN status = 'planned' THEN 'skipped' ELSE status END,
           updated_at = now()
       WHERE workout_session_id = $1`,
      [id],
    )
    await audit(client, {
      action: 'complete_session',
      entityType: 'workout_session',
      entityId: id,
      before,
      after: { status: 'completed' },
      source,
    })
    return getSessionById(id, client)
  })
}

export async function skipSession(id: string, source: Source = 'ui') {
  return withWorkoutTransaction(async (client) => {
    const before = await getSessionById(id, client)
    if (!before) throw new Error('Workout session not found')
    await client.query(
      `UPDATE workout_sessions
       SET status = 'skipped',
           completed_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [id],
    )
    await audit(client, {
      action: 'skip_session',
      entityType: 'workout_session',
      entityId: id,
      before,
      after: { status: 'skipped' },
      source,
    })
    return getSessionById(id, client)
  })
}

export async function rescheduleSession(
  id: string,
  scheduledFor: string,
  source: Source = 'ui',
) {
  return withWorkoutTransaction(async (client) => {
    const before = await getSessionById(id, client)
    if (!before) throw new Error('Workout session not found')
    await client.query(
      `UPDATE workout_sessions
       SET scheduled_for = $2::date,
           updated_at = now()
       WHERE id = $1`,
      [id, scheduledFor],
    )
    await audit(client, {
      action: 'reschedule_session',
      entityType: 'workout_session',
      entityId: id,
      before,
      after: { scheduledFor },
      source,
    })
    return getSessionById(id, client)
  })
}

export async function addSetToPerformance(
  performanceId: string,
  input: SetEntryInput,
): Promise<{ set: SetEntry; session: WorkoutSession | null }> {
  return withWorkoutTransaction(async (client) => {
    const existing = input.idempotencyKey
      ? await one<Record<string, unknown>>(
          client,
          `SELECT * FROM workout_set_entries
           WHERE idempotency_key = $1
           LIMIT 1`,
          [input.idempotencyKey],
        )
      : null
    if (existing) {
      const performance = await getPerformanceById(performanceId, client)
      return {
        set: mapSet(existing),
        session: performance ? await getSessionById(performance.workout_session_id, client) : null,
      }
    }

    const performance = await getPerformanceById(performanceId, client)
    if (!performance) throw new Error('Exercise performance not found')

    const nextSetNumber = input.setNumber ?? Number(
      (await one<{ next_set_number: string }>(
        client,
        `SELECT COALESCE(MAX(set_number), 0) + 1 AS next_set_number
         FROM workout_set_entries
         WHERE exercise_performance_id = $1
           AND deleted_at IS NULL`,
        [performanceId],
      ))?.next_set_number ?? 1,
    )

    const row = await one<Record<string, unknown>>(
      client,
      `INSERT INTO workout_set_entries (
         exercise_performance_id, set_number, reps, load, unit, rpe,
         completed, is_warmup, is_failure, notes, source, source_message_id,
         idempotency_key
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        performanceId,
        nextSetNumber,
        input.reps,
        input.load ?? null,
        input.unit,
        input.rpe ?? null,
        input.completed,
        input.isWarmup,
        input.isFailure,
        input.notes,
        input.source,
        input.sourceMessageId ?? null,
        input.idempotencyKey ?? null,
      ],
    )
    if (!row) throw new Error('Unable to log set')

    await client.query(
      `UPDATE workout_sessions
       SET status = 'in_progress',
           started_at = COALESCE(started_at, now()),
           updated_at = now()
       WHERE id = $1`,
      [performance.workout_session_id],
    )

    const workingSetCount = await one<{ count: string }>(
      client,
      `SELECT COUNT(*)::text AS count
       FROM workout_set_entries
       WHERE exercise_performance_id = $1
         AND deleted_at IS NULL
         AND completed = true
         AND is_warmup = false`,
      [performanceId],
    )

    await client.query(
      `UPDATE workout_exercise_performances
       SET status = CASE WHEN $2::int >= prescribed_sets THEN 'completed' ELSE 'in_progress' END,
           updated_at = now()
       WHERE id = $1`,
      [performanceId, Number(workingSetCount?.count ?? 0)],
    )

    await updatePrRecords(client, performance.exercise_id, performance.workout_session_id, row)
    await audit(client, {
      actorType: input.source === 'ui' ? 'user' : 'assistant',
      action: 'log_set',
      entityType: 'workout_set_entry',
      entityId: String(row.id),
      after: row,
      source: input.source,
      sourceMessageId: input.sourceMessageId,
    })

    return {
      set: mapSet(row),
      session: await getSessionById(performance.workout_session_id, client),
    }
  })
}

export async function logBodyMetric(input: BodyMetricInput): Promise<BodyMetricEntry> {
  return withWorkoutTransaction(async (client) => {
    const existing = input.idempotencyKey
      ? await one<Record<string, unknown>>(
          client,
          `SELECT * FROM workout_body_metric_entries
           WHERE idempotency_key = $1
           LIMIT 1`,
          [input.idempotencyKey],
        )
      : null
    if (existing) return mapBodyMetric(existing)

    const profile = await getProfile(client)
    const row = await one<Record<string, unknown>>(
      client,
      `INSERT INTO workout_body_metric_entries (
         metric_type, body_part, value, unit, measured_at,
         source, notes, source_message_id, idempotency_key
       )
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.metricType,
        input.bodyPart ?? null,
        input.value,
        input.unit,
        input.measuredAt ?? dateInTimeZone(profile.timezone),
        input.source,
        input.notes,
        input.sourceMessageId ?? null,
        input.idempotencyKey ?? null,
      ],
    )
    if (!row) throw new Error('Unable to log body metric')

    await audit(client, {
      actorType: input.source === 'ui' ? 'user' : 'assistant',
      action: 'log_body_metric',
      entityType: 'workout_body_metric_entry',
      entityId: String(row.id),
      after: row,
      source: input.source,
      sourceMessageId: input.sourceMessageId,
    })

    return mapBodyMetric(row)
  })
}

export async function getAnalytics(
  range: 'week' | 'month' | 'quarter' = 'month',
): Promise<WorkoutAnalytics> {
  const profile = await getProfile()
  const today = dateInTimeZone(profile.timezone)
  const start = rangeStart(range, today)

  const { rows: setRows } = await getWorkoutPool().query(
    `SELECT
       ex.canonical_name,
       ex.primary_muscles_json,
       se.reps,
       se.load
     FROM workout_set_entries se
     JOIN workout_exercise_performances ep ON ep.id = se.exercise_performance_id
     JOIN workout_sessions ws ON ws.id = ep.workout_session_id
     JOIN workout_exercises ex ON ex.id = ep.exercise_id
     WHERE ws.scheduled_for >= $1::date
       AND ws.scheduled_for <= $2::date
       AND se.deleted_at IS NULL
       AND se.completed = true
       AND se.is_warmup = false`,
    [start, today],
  )

  const muscleVolume = new Map<string, number>()
  const movementVolume = new Map<string, number>()
  let totalVolume = 0
  for (const row of setRows) {
    const volume = Number(row.reps) * Number(row.load ?? 0)
    totalVolume += volume
    movementVolume.set(row.canonical_name, (movementVolume.get(row.canonical_name) ?? 0) + volume)
    const muscles = arrayJson(row.primary_muscles_json)
    for (const muscle of muscles) {
      muscleVolume.set(muscle, (muscleVolume.get(muscle) ?? 0) + volume)
    }
  }

  const adherence = await one<{
    completed: string
    planned: string
    skipped: string
  }>(
    getWorkoutPool(),
    `SELECT
       COUNT(*) FILTER (WHERE status = 'completed')::text AS completed,
       COUNT(*) FILTER (WHERE status IN ('planned', 'in_progress', 'completed'))::text AS planned,
       COUNT(*) FILTER (WHERE status = 'skipped')::text AS skipped
     FROM workout_sessions
     WHERE scheduled_for >= $1::date
       AND scheduled_for <= $2::date`,
    [start, today],
  )

  const prs = await getPrs()
  const recentBodyMetrics = await getRecentBodyMetrics()
  const completed = Number(adherence?.completed ?? 0)
  const planned = Number(adherence?.planned ?? 0)
  const skipped = Number(adherence?.skipped ?? 0)

  return {
    range,
    totalVolume,
    muscleVolume: [...muscleVolume.entries()]
      .map(([muscle, volume]) => ({ muscle, volume }))
      .sort((a, b) => b.volume - a.volume),
    movementVolume: [...movementVolume.entries()]
      .map(([exerciseName, volume]) => ({ exerciseName, volume }))
      .sort((a, b) => b.volume - a.volume),
    adherence: {
      completed,
      planned,
      skipped,
      percent: planned > 0 ? Math.round((completed / planned) * 100) : 0,
    },
    prs,
    recentBodyMetrics,
  }
}

export async function getPrs(exerciseName?: string): Promise<PrRecord[]> {
  const params: unknown[] = []
  let filter = ''
  if (exerciseName) {
    const exercise = await findExerciseByName(exerciseName)
    if (!exercise) return []
    params.push(exercise.id)
    filter = 'WHERE pr.exercise_id = $1'
  }

  const { rows } = await getWorkoutPool().query(
    `SELECT
       pr.id,
       pr.exercise_id,
       ex.canonical_name,
       pr.type,
       pr.value,
       pr.unit,
       pr.achieved_at
     FROM workout_pr_records pr
     JOIN workout_exercises ex ON ex.id = pr.exercise_id
     ${filter}
     ORDER BY ex.canonical_name, pr.type`,
    params,
  )

  return rows.map((row) => ({
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.canonical_name,
    type: row.type,
    value: Number(row.value),
    unit: row.unit,
    achievedAt: isoOrNull(row.achieved_at) ?? new Date().toISOString(),
  }))
}

export async function getRecentBodyMetrics(): Promise<BodyMetricEntry[]> {
  const { rows } = await getWorkoutPool().query(`
    SELECT *
    FROM workout_body_metric_entries
    ORDER BY measured_at DESC, created_at DESC
    LIMIT 12
  `)
  return rows.map(mapBodyMetric)
}

export async function getAuditLog(limit = 100) {
  const { rows } = await getWorkoutPool().query(
    `SELECT
       id,
       actor_type,
       actor_id,
       action,
       entity_type,
       entity_id,
       before_json,
       after_json,
       source,
       source_message_id,
       created_at
     FROM workout_audit_log
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  )
  return rows.map((row) => ({
    id: String(row.id),
    actorType: String(row.actor_type),
    actorId: String(row.actor_id),
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: nullableString(row.entity_id),
    before: row.before_json ?? null,
    after: row.after_json ?? null,
    source: String(row.source),
    sourceMessageId: nullableString(row.source_message_id),
    createdAt: isoOrNull(row.created_at),
  }))
}

export async function ensureActiveSession(source: Source = 'chat'): Promise<WorkoutSession> {
  const profile = await getProfile()
  const today = dateInTimeZone(profile.timezone)
  let session = await getSessionForDate(today)
  if (!session) {
    await generateWeekPlan(source)
    session = await getSessionForDate(today)
  }
  if (!session) {
    session = await createAdhocSession(today, source)
  }
  if (session.status === 'planned') {
    session = await startSession(session.id, source)
  }
  if (!session) throw new Error('Unable to start workout session')
  return session
}

export async function startExerciseByName(
  exerciseName: string,
  source: Source = 'chat',
): Promise<ExercisePerformance> {
  return withWorkoutTransaction(async (client) => {
    const exercise = await findExerciseByName(exerciseName, client)
    if (!exercise) throw new Error(`I could not find an exercise matching "${exerciseName}".`)

    const activeSession = await ensureActiveSession(source)
    const existing = activeSession.performances.find(
      (performance) => performance.exerciseId === exercise.id,
    )
    if (existing) {
      await client.query(
        `UPDATE workout_exercise_performances
         SET status = 'in_progress', updated_at = now()
         WHERE id = $1`,
        [existing.id],
      )
      const refreshed = await getPerformancesForSession(activeSession.id, client)
      return refreshed.find((performance) => performance.id === existing.id) ?? existing
    }

    const decision = await buildAdhocDecision(client, exercise.id)
    const inserted = await one<{ id: string }>(
      client,
      `INSERT INTO workout_exercise_performances (
         workout_session_id, exercise_id, order_index, prescribed_sets,
         prescribed_reps_min, prescribed_reps_max, prescribed_load, suggested_load,
         prescribed_intensity_type, prescribed_intensity_value, decision_json, status, notes
       )
       VALUES ($1, $2, $3, 3, 8, 12, $4, $4, 'rpe', 8, $5::jsonb, 'in_progress', 'Added from chat/UI.')
       RETURNING id`,
      [
        activeSession.id,
        exercise.id,
        activeSession.performances.length,
        decision.suggestedLoad,
        JSON.stringify(decision.decision),
      ],
    )
    if (!inserted) throw new Error('Unable to start exercise')
    await audit(client, {
      actorType: source === 'ui' ? 'user' : 'assistant',
      action: 'start_exercise',
      entityType: 'workout_exercise_performance',
      entityId: inserted.id,
      after: { exerciseName: exercise.canonicalName },
      source,
    })

    const performance = await getPerformanceViewById(inserted.id, client)
    if (!performance) throw new Error('Unable to create exercise performance')
    return performance
  })
}

export async function getCurrentPerformance(): Promise<ExercisePerformance | null> {
  const profile = await getProfile()
  const today = dateInTimeZone(profile.timezone)
  const session = await getSessionForDate(today) ?? await getNextSession(today)
  return session ? pickActivePerformance(session) : null
}

export async function markPerformanceComplete(
  exerciseName: string,
  source: Source = 'chat',
) {
  return withWorkoutTransaction(async (client) => {
    const exercise = await findExerciseByName(exerciseName, client)
    if (!exercise) throw new Error(`I could not find an exercise matching "${exerciseName}".`)
    const activeSession = await ensureActiveSession(source)
    const performance = activeSession.performances.find((item) => item.exerciseId === exercise.id)
    if (!performance) throw new Error(`${exercise.canonicalName} is not in the active session.`)

    await client.query(
      `UPDATE workout_exercise_performances
       SET status = 'completed', updated_at = now()
       WHERE id = $1`,
      [performance.id],
    )
    await audit(client, {
      actorType: source === 'ui' ? 'user' : 'assistant',
      action: 'complete_exercise',
      entityType: 'workout_exercise_performance',
      entityId: performance.id,
      after: { exerciseName: exercise.canonicalName },
      source,
    })
    return getPerformanceViewById(performance.id, client)
  })
}

export async function swapExerciseInNextSession(
  fromName: string,
  toName: string,
  source: Source = 'chat',
) {
  return withWorkoutTransaction(async (client) => {
    const from = await findExerciseByName(fromName, client)
    const to = await findExerciseByName(toName, client)
    if (!from || !to) throw new Error('I could not resolve both exercises for the swap.')

    const profile = await getProfile(client)
    const session = await getNextSession(dateInTimeZone(profile.timezone), client)
    if (!session) throw new Error('No upcoming session is available to edit.')

    const performance = session.performances.find((item) => item.exerciseId === from.id)
    if (!performance) throw new Error(`${from.canonicalName} is not in the next session.`)

    const before = performance
    const decision = await buildAdhocDecision(client, to.id)
    await client.query(
      `UPDATE workout_exercise_performances
       SET exercise_id = $2,
           suggested_load = $3,
           prescribed_load = COALESCE($3, prescribed_load),
           decision_json = $4::jsonb,
           notes = CONCAT(notes, CASE WHEN notes = '' THEN '' ELSE E'\n' END, $5),
           updated_at = now()
       WHERE id = $1`,
      [
        performance.id,
        to.id,
        decision.suggestedLoad,
        JSON.stringify(decision.decision),
        `Swapped from ${from.canonicalName} to ${to.canonicalName}.`,
      ],
    )
    await audit(client, {
      actorType: source === 'ui' ? 'user' : 'assistant',
      action: 'swap_exercise',
      entityType: 'workout_exercise_performance',
      entityId: performance.id,
      before,
      after: { from: from.canonicalName, to: to.canonicalName },
      source,
    })
    return getSessionById(session.id, client)
  })
}

export async function applyDeloadToUpcoming(source: Source = 'chat') {
  return withWorkoutTransaction(async (client) => {
    const profile = await getProfile(client)
    const today = dateInTimeZone(profile.timezone)
    const end = addDays(today, 14)
    const { rows } = await client.query(
      `UPDATE workout_exercise_performances ep
       SET suggested_load = ROUND(COALESCE(suggested_load, prescribed_load) * 0.9, 2),
           decision_json = jsonb_set(
             COALESCE(decision_json, '{}'::jsonb),
             '{deload}',
             '{"applied":true,"reason":"Requested deload","percent":0.9}'::jsonb,
             true
           ),
           updated_at = now()
       FROM workout_sessions ws
       WHERE ws.id = ep.workout_session_id
         AND ws.scheduled_for > $1::date
         AND ws.scheduled_for <= $2::date
         AND ws.status IN ('planned', 'in_progress')
         AND COALESCE(ep.suggested_load, ep.prescribed_load) IS NOT NULL
       RETURNING ep.id`,
      [today, end],
    )
    await audit(client, {
      actorType: source === 'ui' ? 'user' : 'assistant',
      action: 'apply_deload',
      entityType: 'workout_plan',
      after: { affectedMovements: rows.length, from: today, to: end },
      source,
    })
    return rows.length
  })
}

export async function appendInjuryNote(note: string, source: Source = 'chat') {
  const profile = await getProfile()
  const cleanNote = note.trim()
  const nextNotes = [profile.injuryNotes, `${new Date().toISOString().slice(0, 10)}: ${cleanNote}`]
    .filter(Boolean)
    .join('\n')
  return patchProfile({ injuryNotes: nextNotes }, source)
}

export async function setEquipmentProfile(
  equipmentProfile: Record<string, unknown>,
  source: Source = 'chat',
) {
  return patchProfile({ equipmentProfile }, source)
}

async function createAdhocSession(date: string, source: Source): Promise<WorkoutSession> {
  return withWorkoutTransaction(async (client) => {
    const row = await one<{ id: string }>(
      client,
      `INSERT INTO workout_sessions (scheduled_for, status, created_by_source, notes)
       VALUES ($1::date, 'in_progress', $2, 'Ad hoc workout session.')
       RETURNING id`,
      [date, source],
    )
    if (!row) throw new Error('Unable to create ad hoc workout session')
    await audit(client, {
      actorType: source === 'ui' ? 'user' : 'assistant',
      action: 'create_adhoc_session',
      entityType: 'workout_session',
      entityId: row.id,
      after: { scheduledFor: date },
      source,
    })
    const session = await getSessionById(row.id, client)
    if (!session) throw new Error('Unable to create ad hoc workout session')
    return session
  })
}

async function createPerformancesForSession(client: Queryable, sessionId: string) {
  const existing = await one<{ count: string }>(
    client,
    `SELECT COUNT(*)::text AS count
     FROM workout_exercise_performances
     WHERE workout_session_id = $1`,
    [sessionId],
  )
  if (Number(existing?.count ?? 0) > 0) return

  const session = await one<{ routine_day_id: string | null; scheduled_for: string }>(
    client,
    `SELECT routine_day_id, scheduled_for::text
     FROM workout_sessions
     WHERE id = $1`,
    [sessionId],
  )
  if (!session?.routine_day_id) return

  const movements = await getPlannedMovements(session.routine_day_id, client)
  for (const movement of movements) {
    const decision = await buildProgressionDecision(client, movement, session.scheduled_for)
    const inserted = await one<{ id: string }>(
      client,
      `INSERT INTO workout_exercise_performances (
         workout_session_id,
         exercise_id,
         planned_movement_id,
         order_index,
         prescribed_sets,
         prescribed_reps_min,
         prescribed_reps_max,
         prescribed_load,
         prescribed_intensity_type,
         prescribed_intensity_value,
         suggested_load,
         progression_rule_id,
         progression_rule_snapshot_json,
         decision_json,
         notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15)
       RETURNING id`,
      [
        sessionId,
        movement.exercise_id,
        movement.id,
        movement.order_index,
        movement.target_sets,
        movement.target_reps_min,
        movement.target_reps_max,
        numOrNull(movement.target_load),
        movement.target_intensity_type,
        numOrNull(movement.target_intensity_value),
        decision.suggestedLoad,
        movement.progression_rule_id,
        JSON.stringify(decision.ruleSnapshot),
        JSON.stringify(decision.decision),
        movement.notes,
      ],
    )
    if (!inserted) throw new Error('Unable to create workout movement')

    await client.query(
      `INSERT INTO workout_plan_decisions (
         workout_session_id, exercise_performance_id, decision_type,
         explanation, inputs_json, output_json, created_by_source
       )
       VALUES ($1, $2, 'progression', $3, $4::jsonb, $5::jsonb, 'system')`,
      [
        sessionId,
        inserted.id,
        decision.explanation,
        JSON.stringify(decision.inputs),
        JSON.stringify(decision.output),
      ],
    )
  }
}

async function buildProgressionDecision(
  client: Queryable,
  movement: PlannedMovementRow,
  scheduledFor: string,
) {
  const config = objectJson(movement.config_json)
  const increment = Number(config.loadIncrementLb ?? 5)
  const highRpeThreshold = Number(config.highRpeThreshold ?? 9)
  const deloadPercent = Number(config.deloadPercent ?? 0.9)
  const targetLoad = numOrNull(movement.target_load)
  const summaries = await getLastSessionSummaries(client, movement.exercise_id, scheduledFor, 2)
  const last = summaries[0]
  const previous = summaries[1]
  const warnings = await getMovementWarnings(client, movement)

  let suggestedLoad = targetLoad
  let explanation = `Use the routine target for ${movement.exercise_name}.`
  let ruleOutcome = 'use_target'

  if (last) {
    suggestedLoad = last.maxLoad ?? targetLoad
    explanation = `Repeat last working load for ${movement.exercise_name}.`
    ruleOutcome = 'repeat_last_load'

    const hitTopOfRange =
      last.workingSets >= movement.target_sets &&
      last.minReps >= movement.target_reps_max &&
      (last.avgRpe === null || last.avgRpe <= highRpeThreshold)

    const repeatedRegression =
      previous &&
      last.totalReps < previous.totalReps &&
      (last.avgRpe ?? 0) >= highRpeThreshold &&
      (previous.avgRpe ?? 0) >= highRpeThreshold

    if (repeatedRegression && suggestedLoad !== null) {
      suggestedLoad = roundLoad(suggestedLoad * deloadPercent)
      explanation = `Reduce load because the last two sessions regressed while RPE stayed high.`
      ruleOutcome = 'reduce_after_regression'
    } else if (hitTopOfRange && suggestedLoad !== null) {
      suggestedLoad = roundLoad(suggestedLoad + increment)
      explanation = `Increase load because last time all working sets reached the top of the rep range without repeated high RPE.`
      ruleOutcome = 'increase_after_top_range'
    } else if ((last.avgRpe ?? 0) > highRpeThreshold && suggestedLoad !== null) {
      explanation = `Keep load steady because last session was above the target effort.`
      ruleOutcome = 'hold_after_high_rpe'
    }
  }

  if (warnings.length) {
    explanation = `${explanation} Check current constraints before starting.`
  }

  return {
    suggestedLoad,
    explanation,
    ruleSnapshot: {
      id: movement.progression_rule_id,
      name: movement.rule_name,
      type: movement.rule_type,
      version: movement.rule_version,
      config,
    },
    decision: {
      explanation,
      outcome: ruleOutcome,
      warnings,
      targetLoad,
      suggestedLoad,
      lastSession: last ?? null,
      previousSession: previous ?? null,
    },
    inputs: {
      movement,
      lastSession: last ?? null,
      previousSession: previous ?? null,
      warnings,
    },
    output: {
      suggestedLoad,
      explanation,
      outcome: ruleOutcome,
    },
  }
}

async function buildAdhocDecision(client: Queryable, exerciseId: string) {
  const last = (await getLastSessionSummaries(client, exerciseId, addDays(new Date().toISOString().slice(0, 10), 1), 1))[0]
  const suggestedLoad = last?.maxLoad ?? null
  return {
    suggestedLoad,
    decision: {
      explanation: last
        ? 'Use the last working load for this ad hoc exercise.'
        : 'No previous working set found; choose a conservative starting load.',
      outcome: last ? 'repeat_last_load' : 'choose_starting_load',
      lastSession: last ?? null,
    },
  }
}

async function getLastSessionSummaries(
  client: Queryable,
  exerciseId: string,
  beforeDate: string,
  limit: number,
) {
  const { rows } = await client.query(
    `SELECT
       ws.id AS session_id,
       ws.scheduled_for::text AS scheduled_for,
       se.reps,
       se.load,
       se.rpe
     FROM workout_sessions ws
     JOIN workout_exercise_performances ep ON ep.workout_session_id = ws.id
     JOIN workout_set_entries se ON se.exercise_performance_id = ep.id
     WHERE ep.exercise_id = $1
       AND ws.scheduled_for < $2::date
       AND se.deleted_at IS NULL
       AND se.completed = true
       AND se.is_warmup = false
     ORDER BY ws.scheduled_for DESC, se.set_number ASC`,
    [exerciseId, beforeDate],
  )

  const summaries: Array<{
    sessionId: string
    scheduledFor: string
    workingSets: number
    totalReps: number
    minReps: number
    maxLoad: number | null
    avgRpe: number | null
  }> = []

  for (const row of rows) {
    let summary = summaries.find((item) => item.sessionId === row.session_id)
    if (!summary) {
      if (summaries.length >= limit) break
      summary = {
        sessionId: row.session_id,
        scheduledFor: row.scheduled_for,
        workingSets: 0,
        totalReps: 0,
        minReps: Number.POSITIVE_INFINITY,
        maxLoad: null,
        avgRpe: null,
      }
      summaries.push(summary)
    }

    const reps = Number(row.reps)
    const load = numOrNull(row.load)
    const rpe = numOrNull(row.rpe)
    summary.workingSets += 1
    summary.totalReps += reps
    summary.minReps = Math.min(summary.minReps, reps)
    summary.maxLoad = Math.max(summary.maxLoad ?? 0, load ?? 0)
    if (rpe !== null) {
      const priorTotal = (summary.avgRpe ?? 0) * (summary.workingSets - 1)
      summary.avgRpe = (priorTotal + rpe) / summary.workingSets
    }
  }

  return summaries.map((summary) => ({
    ...summary,
    minReps: summary.minReps === Number.POSITIVE_INFINITY ? 0 : summary.minReps,
    maxLoad: summary.maxLoad === 0 ? null : summary.maxLoad,
    avgRpe: summary.avgRpe === null ? null : Number(summary.avgRpe.toFixed(1)),
  }))
}

async function getMovementWarnings(client: Queryable, movement: PlannedMovementRow) {
  const warnings: string[] = []
  const profile = await getProfile(client)
  const constraints = await getConstraints(client)
  if (!constraints) return warnings
  const movementConstraints = objectJson(constraints.movement_constraints_json)
  const haystack = [
    movement.exercise_name,
    movement.movement_pattern,
    ...arrayJson(movement.primary_muscles_json),
  ].map(normalizeName)

  for (const [key, value] of Object.entries(movementConstraints)) {
    if (value === false || value === null) continue
    if (haystack.some((item) => item.includes(normalizeName(key)))) {
      warnings.push(`Current movement constraint references ${key}.`)
    }
  }
  if (profile.injuryNotes.trim()) {
    warnings.push('Current injury notes are present; adjust range, load, or exercise if needed.')
  }
  return warnings
}

async function getActiveRoutine(client: Queryable) {
  return one<{ id: string; name: string }>(
    client,
    `SELECT id, name
     FROM workout_routine_templates
     WHERE active = true
     ORDER BY updated_at DESC
     LIMIT 1`,
  )
}

async function getRoutineDays(routineId: string, client: Queryable) {
  const { rows } = await client.query(
    `SELECT id, label, day_index
     FROM workout_routine_days
     WHERE routine_template_id = $1
     ORDER BY order_index, day_index`,
    [routineId],
  )
  return rows as Array<{ id: string; label: string; day_index: number }>
}

async function getPlannedMovements(routineDayId: string, client: Queryable) {
  const { rows } = await client.query(
    `SELECT
       pm.*,
       ex.canonical_name AS exercise_name,
       ex.movement_pattern,
       ex.primary_muscles_json,
       ex.equipment_type,
       pr.name AS rule_name,
       pr.type AS rule_type,
       pr.version AS rule_version,
       pr.config_json
     FROM workout_planned_movements pm
     JOIN workout_exercises ex ON ex.id = pm.exercise_id
     LEFT JOIN workout_progression_rules pr ON pr.id = pm.progression_rule_id
     WHERE pm.routine_day_id = $1
     ORDER BY pm.order_index`,
    [routineDayId],
  )
  return rows as PlannedMovementRow[]
}

async function getConstraints(client: Queryable) {
  await client.query(`
    INSERT INTO workout_constraints (id)
    VALUES ('default')
    ON CONFLICT (id) DO NOTHING
  `)
  return one<Record<string, unknown>>(
    client,
    `SELECT *
     FROM workout_constraints
     WHERE id = 'default'`,
  )
}

async function getPerformancesForSession(sessionId: string, client: Queryable) {
  const { rows } = await client.query(
    `SELECT
       ep.*,
       ex.canonical_name,
       ex.movement_pattern,
       ex.primary_muscles_json,
       ex.equipment_type
     FROM workout_exercise_performances ep
     JOIN workout_exercises ex ON ex.id = ep.exercise_id
     WHERE ep.workout_session_id = $1
     ORDER BY ep.order_index`,
    [sessionId],
  )

  const performances = rows.map(mapPerformance)
  if (!performances.length) return performances

  const { rows: setRows } = await client.query(
    `SELECT *
     FROM workout_set_entries
     WHERE exercise_performance_id = ANY($1)
       AND deleted_at IS NULL
     ORDER BY exercise_performance_id, set_number`,
    [performances.map((performance) => performance.id)],
  )

  const setsByPerformance = new Map<string, SetEntry[]>()
  for (const row of setRows) {
    const performanceId = String(row.exercise_performance_id)
    setsByPerformance.set(performanceId, [
      ...(setsByPerformance.get(performanceId) ?? []),
      mapSet(row),
    ])
  }

  return performances.map((performance) => ({
    ...performance,
    sets: setsByPerformance.get(performance.id) ?? [],
  }))
}

async function getPerformanceById(id: string, client: Queryable) {
  return one<{ id: string; workout_session_id: string; exercise_id: string }>(
    client,
    `SELECT id, workout_session_id, exercise_id
     FROM workout_exercise_performances
     WHERE id = $1`,
    [id],
  )
}

async function getPerformanceViewById(id: string, client: Queryable) {
  const row = await one<{ workout_session_id: string }>(
    client,
    `SELECT workout_session_id
     FROM workout_exercise_performances
     WHERE id = $1`,
    [id],
  )
  if (!row) return null
  const performances = await getPerformancesForSession(row.workout_session_id, client)
  return performances.find((performance) => performance.id === id) ?? null
}

function pickActivePerformance(session: WorkoutSession): ExercisePerformance | null {
  return (
    session.performances.find((performance) => performance.status === 'in_progress') ??
    session.performances.find((performance) => performance.status === 'planned') ??
    session.performances.find((performance) => performance.status !== 'completed' && performance.status !== 'skipped') ??
    session.performances[0] ??
    null
  )
}

async function updatePrRecords(
  client: Queryable,
  exerciseId: string,
  sessionId: string,
  setRow: Record<string, unknown>,
) {
  const load = numOrNull(setRow.load)
  const reps = Number(setRow.reps)
  if (load === null || !Number.isFinite(reps)) return

  const estimatedOneRepMax = roundLoad(load * (1 + reps / 30))
  const prs = [
    { type: 'max_load', value: load },
    { type: 'estimated_1rm', value: estimatedOneRepMax },
  ]

  for (const pr of prs) {
    await client.query(
      `INSERT INTO workout_pr_records (
         exercise_id, type, value, unit, achieved_at, workout_session_id, set_entry_id
       )
       VALUES ($1, $2, $3, $4, now(), $5, $6)
       ON CONFLICT (exercise_id, type) DO UPDATE SET
         value = EXCLUDED.value,
         unit = EXCLUDED.unit,
         achieved_at = EXCLUDED.achieved_at,
         workout_session_id = EXCLUDED.workout_session_id,
         set_entry_id = EXCLUDED.set_entry_id
       WHERE workout_pr_records.value < EXCLUDED.value`,
      [
        exerciseId,
        pr.type,
        pr.value,
        String(setRow.unit ?? 'lb'),
        sessionId,
        String(setRow.id),
      ],
    )
  }
}

async function audit(client: Queryable, input: AuditInput) {
  await client.query(
    `INSERT INTO workout_audit_log (
       actor_type, actor_id, action, entity_type, entity_id,
       before_json, after_json, source, source_message_id
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
    [
      input.actorType ?? (input.source === 'chat' || input.source === 'telegram' ? 'assistant' : 'user'),
      input.actorId ?? 'ken',
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
      input.source ?? 'ui',
      input.sourceMessageId ?? null,
    ],
  )
}

async function one<T = Record<string, unknown>>(
  client: Queryable,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const result = await client.query(sql, params)
  return (result.rows[0] as T | undefined) ?? null
}

function mapExercise(row: Record<string, unknown>): Exercise {
  return {
    id: String(row.id),
    canonicalName: String(row.canonical_name),
    aliases: arrayJson(row.aliases_json),
    movementPattern: String(row.movement_pattern),
    primaryMuscles: arrayJson(row.primary_muscles_json),
    equipmentType: String(row.equipment_type),
    defaultRestSeconds: Number(row.default_rest_seconds),
    notes: String(row.notes ?? ''),
    active: Boolean(row.active),
  }
}

function mapPerformance(row: Record<string, unknown>): ExercisePerformance {
  return {
    id: String(row.id),
    exerciseId: String(row.exercise_id),
    exerciseName: String(row.canonical_name),
    movementPattern: String(row.movement_pattern),
    primaryMuscles: arrayJson(row.primary_muscles_json),
    equipmentType: String(row.equipment_type),
    orderIndex: Number(row.order_index),
    prescribedSets: Number(row.prescribed_sets),
    prescribedRepsMin: Number(row.prescribed_reps_min),
    prescribedRepsMax: Number(row.prescribed_reps_max),
    prescribedLoad: numOrNull(row.prescribed_load),
    prescribedIntensityType: String(row.prescribed_intensity_type),
    prescribedIntensityValue: numOrNull(row.prescribed_intensity_value),
    suggestedLoad: numOrNull(row.suggested_load),
    decision: objectJson(row.decision_json),
    status: String(row.status),
    notes: String(row.notes ?? ''),
    sets: [],
  }
}

function mapSet(row: Record<string, unknown>): SetEntry {
  return {
    id: String(row.id),
    setNumber: Number(row.set_number),
    reps: Number(row.reps),
    load: numOrNull(row.load),
    unit: String(row.unit ?? 'lb'),
    rpe: numOrNull(row.rpe),
    completed: Boolean(row.completed),
    isWarmup: Boolean(row.is_warmup),
    isFailure: Boolean(row.is_failure),
    notes: String(row.notes ?? ''),
    source: String(row.source ?? 'ui'),
    performedAt: isoOrNull(row.performed_at) ?? new Date().toISOString(),
  }
}

function mapBodyMetric(row: Record<string, unknown>): BodyMetricEntry {
  return {
    id: String(row.id),
    metricType: String(row.metric_type),
    bodyPart: nullableString(row.body_part),
    value: Number(row.value),
    unit: String(row.unit),
    measuredAt: String(row.measured_at),
    source: String(row.source ?? 'ui'),
    notes: String(row.notes ?? ''),
  }
}

function objectJson(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

function arrayJson(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  return []
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return String(value)
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return new Date(String(value)).toISOString()
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function roundLoad(value: number) {
  return Math.round(value * 2) / 2
}
