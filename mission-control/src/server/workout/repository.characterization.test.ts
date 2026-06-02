import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  sets: [] as Record<string, unknown>[],
  audits: [] as Record<string, unknown>[],
  prUpserts: [] as Record<string, unknown>[],
  session: {} as Record<string, unknown>,
  performance: {} as Record<string, unknown>,
  exercise: {} as Record<string, unknown>,
  nextSetId: 1,
}))

const fakeClient = {
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('SELECT * FROM workout_set_entries') && sql.includes('WHERE idempotency_key = $1')) {
      return { rows: state.sets.filter((set) => set.idempotency_key === params[0]).slice(0, 1) }
    }

    if (sql.includes('SELECT id, workout_session_id, exercise_id') && sql.includes('FROM workout_exercise_performances')) {
      return {
        rows: [{
          id: state.performance.id,
          workout_session_id: state.performance.workout_session_id,
          exercise_id: state.performance.exercise_id,
        }],
      }
    }

    if (sql.includes('SELECT COALESCE(MAX(set_number), 0) + 1 AS next_set_number')) {
      const maxSetNumber = state.sets.reduce((max, set) => Math.max(max, Number(set.set_number)), 0)
      return { rows: [{ next_set_number: String(maxSetNumber + 1) }] }
    }

    if (sql.includes('INSERT INTO workout_set_entries')) {
      const row = {
        id: `set-${state.nextSetId}`,
        exercise_performance_id: params[0],
        set_number: params[1],
        reps: params[2],
        load: params[3],
        unit: params[4],
        rpe: params[5],
        completed: params[6],
        is_warmup: params[7],
        is_failure: params[8],
        notes: params[9],
        source: params[10],
        source_message_id: params[11],
        idempotency_key: params[12],
        performed_at: '2026-06-01T18:00:00.000Z',
      }
      state.nextSetId += 1
      state.sets.push(row)
      return { rows: [row] }
    }

    if (sql.includes('UPDATE workout_sessions') && sql.includes("SET status = 'in_progress'")) {
      state.session.status = 'in_progress'
      state.session.started_at = state.session.started_at ?? '2026-06-01T18:00:00.000Z'
      return { rows: [] }
    }

    if (sql.includes('SELECT COUNT(*)::text AS count') && sql.includes('FROM workout_set_entries')) {
      const workingSets = state.sets.filter((set) =>
        set.exercise_performance_id === params[0] &&
        set.deleted_at === undefined &&
        set.completed === true &&
        set.is_warmup === false
      )
      return { rows: [{ count: String(workingSets.length) }] }
    }

    if (sql.includes('UPDATE workout_exercise_performances') && sql.includes('CASE WHEN $2::int >= prescribed_sets')) {
      const workingSetCount = Number(params[1])
      state.performance.status = workingSetCount >= Number(state.performance.prescribed_sets)
        ? 'completed'
        : 'in_progress'
      return { rows: [] }
    }

    if (sql.includes('INSERT INTO workout_pr_records')) {
      state.prUpserts.push({
        exerciseId: params[0],
        type: params[1],
        value: params[2],
        unit: params[3],
        sessionId: params[4],
        setId: params[5],
      })
      return { rows: [] }
    }

    if (sql.includes('INSERT INTO workout_audit_log')) {
      state.audits.push({
        actorType: params[0],
        actorId: params[1],
        action: params[2],
        entityType: params[3],
        entityId: params[4],
        source: params[7],
        sourceMessageId: params[8],
      })
      return { rows: [] }
    }

    if (sql.includes('FROM workout_sessions ws') && sql.includes('LEFT JOIN workout_routine_days')) {
      return { rows: [state.session] }
    }

    if (sql.includes('FROM workout_exercise_performances ep') && sql.includes('JOIN workout_exercises ex')) {
      return {
        rows: [{
          ...state.performance,
          canonical_name: state.exercise.canonical_name,
          movement_pattern: state.exercise.movement_pattern,
          primary_muscles_json: state.exercise.primary_muscles_json,
          equipment_type: state.exercise.equipment_type,
        }],
      }
    }

    if (sql.includes('SELECT *') && sql.includes('WHERE exercise_performance_id = ANY')) {
      const performanceIds = params[0] as string[]
      return {
        rows: state.sets.filter((set) => performanceIds.includes(String(set.exercise_performance_id))),
      }
    }

    return { rows: [] }
  }),
}

vi.mock('./db', () => ({
  getWorkoutPool: () => fakeClient,
  withWorkoutTransaction: async <T>(fn: (client: typeof fakeClient) => Promise<T>) => fn(fakeClient),
}))

const { addSetToPerformance } = await import('./repository')

describe('addSetToPerformance characterization', () => {
  beforeEach(() => {
    state.sets = []
    state.audits = []
    state.prUpserts = []
    state.nextSetId = 1
    state.session = {
      id: 'session-1',
      scheduled_for: '2026-06-01',
      started_at: null,
      completed_at: null,
      status: 'planned',
      routine_template_id: null,
      routine_day_id: null,
      routine_day_label: null,
      notes: '',
      created_by_source: 'system',
    }
    state.performance = {
      id: 'performance-1',
      workout_session_id: 'session-1',
      exercise_id: 'exercise-1',
      order_index: 0,
      prescribed_sets: 1,
      prescribed_reps_min: 8,
      prescribed_reps_max: 12,
      prescribed_load: 160,
      prescribed_intensity_type: 'rpe',
      prescribed_intensity_value: 8,
      suggested_load: 160,
      decision_json: {},
      status: 'planned',
      notes: '',
    }
    state.exercise = {
      canonical_name: 'Hammer Strength Decline Press',
      movement_pattern: 'horizontal_push',
      primary_muscles_json: ['chest', 'triceps'],
      equipment_type: 'plate_loaded_machine',
    }
    fakeClient.query.mockClear()
  })

  it('logs a working set, starts the session, completes the performance, updates PRs, and audits', async () => {
    const result = await addSetToPerformance('performance-1', {
      reps: 12,
      load: 160,
      unit: 'lb',
      rpe: 8,
      completed: true,
      isWarmup: false,
      isFailure: false,
      notes: '',
      source: 'chat',
      sourceMessageId: 'msg-1',
      idempotencyKey: 'set:chat:msg-1',
    })

    expect(result.set).toMatchObject({
      setNumber: 1,
      reps: 12,
      load: 160,
      unit: 'lb',
      rpe: 8,
    })
    expect(result.session).toMatchObject({
      id: 'session-1',
      status: 'in_progress',
      performances: [{ status: 'completed', sets: [{ id: 'set-1' }] }],
    })
    expect(state.prUpserts).toEqual([
      expect.objectContaining({ type: 'max_load', value: 160, setId: 'set-1' }),
      expect.objectContaining({ type: 'estimated_1rm', value: 224, setId: 'set-1' }),
    ])
    expect(state.audits).toEqual([
      expect.objectContaining({
        actorType: 'assistant',
        action: 'log_set',
        entityType: 'workout_set_entry',
        entityId: 'set-1',
        source: 'chat',
        sourceMessageId: 'msg-1',
      }),
    ])
  })

  it('returns an idempotent set without inserting another set or replaying side effects', async () => {
    state.sets.push({
      id: 'set-existing',
      exercise_performance_id: 'performance-1',
      set_number: 1,
      reps: 10,
      load: 150,
      unit: 'lb',
      rpe: null,
      completed: true,
      is_warmup: false,
      is_failure: false,
      notes: '',
      source: 'telegram',
      source_message_id: 'tg-1',
      idempotency_key: 'set:telegram:tg-1',
      performed_at: '2026-06-01T18:00:00.000Z',
    })

    const result = await addSetToPerformance('performance-1', {
      reps: 10,
      load: 150,
      unit: 'lb',
      rpe: null,
      completed: true,
      isWarmup: false,
      isFailure: false,
      notes: '',
      source: 'telegram',
      sourceMessageId: 'tg-1',
      idempotencyKey: 'set:telegram:tg-1',
    })

    expect(result.set).toMatchObject({
      id: 'set-existing',
      setNumber: 1,
      reps: 10,
      load: 150,
    })
    expect(state.sets).toHaveLength(1)
    expect(state.prUpserts).toHaveLength(0)
    expect(state.audits).toHaveLength(0)
  })
})
