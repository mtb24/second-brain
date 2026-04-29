import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg

loadEnv(path.resolve(process.cwd(), '..', '.env'))
loadEnv(path.resolve(process.cwd(), '.env'))

const connectionString = process.env.DB_URL ?? process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DB_URL or DATABASE_URL must be set before seeding workouts')
}

const pool = new Pool({ connectionString })

const exercises = [
  ['Barbell Back Squat', ['squat', 'back squat'], 'squat', ['quads', 'glutes', 'hamstrings'], 'barbell', 150],
  ['Incline Bench Machine', ['incline bench', 'incline machine', 'chest press'], 'horizontal_push', ['chest', 'triceps', 'front_delts'], 'machine', 120],
  ['Romanian Deadlift', ['rdl', 'dumbbell rdl'], 'hinge', ['hamstrings', 'glutes', 'back'], 'barbell_or_dumbbell', 120],
  ['Trap Bar Deadlift', ['deadlift', 'trap deadlift'], 'hinge', ['glutes', 'hamstrings', 'back', 'quads'], 'trap_bar', 150],
  ['Leg Press', ['sled press'], 'squat', ['quads', 'glutes'], 'machine', 120],
  ['Seated Hamstring Curl', ['ham curl', 'leg curl'], 'knee_flexion', ['hamstrings'], 'machine', 90],
  ['Lat Pulldown', ['pulldown'], 'vertical_pull', ['lats', 'biceps', 'upper_back'], 'cable', 90],
  ['Cable Row', ['row', 'seated row'], 'horizontal_pull', ['upper_back', 'lats', 'biceps'], 'cable', 90],
  ['Dumbbell Shoulder Press', ['db shoulder press', 'shoulder press'], 'vertical_push', ['delts', 'triceps'], 'dumbbell', 90],
  ['Dumbbell Split Squat', ['split squat', 'bulgarian split squat'], 'single_leg', ['quads', 'glutes'], 'dumbbell', 90],
  ['Cable Triceps Pressdown', ['pressdown', 'triceps'], 'elbow_extension', ['triceps'], 'cable', 60],
  ['Dumbbell Curl', ['curl', 'db curl'], 'elbow_flexion', ['biceps'], 'dumbbell', 60],
]

try {
  await pool.query('BEGIN')

  await pool.query(`
    INSERT INTO workout_user_profile (id)
    VALUES ('default')
    ON CONFLICT (id) DO NOTHING
  `)

  await pool.query(`
    INSERT INTO workout_constraints (id)
    VALUES ('default')
    ON CONFLICT (id) DO NOTHING
  `)

  for (const [name, aliases, pattern, muscles, equipment, rest] of exercises) {
    await pool.query(
      `INSERT INTO workout_exercises (
         canonical_name, aliases_json, movement_pattern, primary_muscles_json,
         equipment_type, default_rest_seconds
       )
       VALUES ($1, $2::jsonb, $3, $4::jsonb, $5, $6)
       ON CONFLICT (canonical_name) DO UPDATE SET
         aliases_json = EXCLUDED.aliases_json,
         movement_pattern = EXCLUDED.movement_pattern,
         primary_muscles_json = EXCLUDED.primary_muscles_json,
         equipment_type = EXCLUDED.equipment_type,
         default_rest_seconds = EXCLUDED.default_rest_seconds,
         active = true,
         updated_at = now()`,
      [name, JSON.stringify(aliases), pattern, JSON.stringify(muscles), equipment, rest],
    )
  }

  const doubleProgression = await upsertRule('Double progression', 'double_progression', {
    loadIncrementLb: 5,
    deloadPercent: 0.9,
    highRpeThreshold: 9,
    targetRpe: 8,
  })
  const repTarget = await upsertRule('Rep target progression', 'rep_target_progression', {
    loadIncrementLb: 2.5,
    targetRpe: 8,
    highRpeThreshold: 9,
  })

  const routine = await one(
    `INSERT INTO workout_routine_templates (name, goal_type, description, active)
     VALUES ('Strength plus hypertrophy base', 'strength_hypertrophy', 'Seeded push/pull/legs routine for the first workout tracker slice.', true)
     ON CONFLICT DO NOTHING
     RETURNING id`,
  )

  const routineId =
    routine?.id ??
    (await one(`SELECT id FROM workout_routine_templates WHERE name = 'Strength plus hypertrophy base'`)).id

  await pool.query(
    `UPDATE workout_routine_templates
     SET active = (id = $1), updated_at = now()`,
    [routineId],
  )

  const days = [
    { index: 0, label: 'Lower strength', movements: [
      ['Barbell Back Squat', 4, 5, 8, 185, doubleProgression, 'Stop if knee irritation changes mechanics.'],
      ['Romanian Deadlift', 3, 8, 10, 155, doubleProgression, 'Hinge cleanly; no grip heroics required.'],
      ['Leg Press', 3, 10, 15, 250, repTarget, 'Smooth reps, full control.'],
      ['Seated Hamstring Curl', 2, 10, 15, 90, repTarget, 'Leave 1-2 reps in reserve.'],
    ] },
    { index: 1, label: 'Upper push/pull', movements: [
      ['Incline Bench Machine', 4, 6, 10, 140, doubleProgression, 'Primary press for this day.'],
      ['Lat Pulldown', 3, 8, 12, 120, repTarget, 'Drive elbows down.'],
      ['Cable Row', 3, 8, 12, 120, repTarget, 'Pause without yanking.'],
      ['Dumbbell Shoulder Press', 3, 8, 12, 45, repTarget, 'Use dumbbell value per hand.'],
      ['Cable Triceps Pressdown', 2, 10, 15, 70, repTarget, 'Easy elbows.'],
    ] },
    { index: 2, label: 'Lower hypertrophy', movements: [
      ['Trap Bar Deadlift', 3, 5, 8, 225, doubleProgression, 'Swap to RDL if low back or travel setup says so.'],
      ['Dumbbell Split Squat', 3, 8, 12, 35, repTarget, 'Dumbbell value per hand.'],
      ['Seated Hamstring Curl', 3, 10, 15, 90, repTarget, 'Controlled eccentric.'],
      ['Dumbbell Curl', 2, 10, 15, 30, repTarget, 'Accessory, do not overthink it.'],
    ] },
  ]

  for (const day of days) {
    const dayRow = await one(
      `INSERT INTO workout_routine_days (routine_template_id, day_index, label, order_index)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (routine_template_id, day_index) DO UPDATE SET
         label = EXCLUDED.label,
         order_index = EXCLUDED.order_index,
         updated_at = now()
       RETURNING id`,
      [routineId, day.index, day.label, day.index],
    )

    await pool.query('DELETE FROM workout_planned_movements WHERE routine_day_id = $1', [dayRow.id])
    let order = 0
    for (const movement of day.movements) {
      const [exerciseName, sets, repsMin, repsMax, load, ruleId, notes] = movement
      const exercise = await one('SELECT id FROM workout_exercises WHERE canonical_name = $1', [exerciseName])
      await pool.query(
        `INSERT INTO workout_planned_movements (
           routine_day_id, exercise_id, target_sets, target_reps_min, target_reps_max,
           target_load, target_intensity_type, target_intensity_value,
           progression_rule_id, notes, order_index
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'rpe', 8, $7, $8, $9)`,
        [dayRow.id, exercise.id, sets, repsMin, repsMax, load, ruleId, notes, order],
      )
      order += 1
    }
  }

  await pool.query(
    `INSERT INTO workout_audit_log (actor_type, actor_id, action, entity_type, entity_id, after_json, source)
     VALUES ('system', 'seed', 'seed_workout_data', 'routine_template', $1, $2::jsonb, 'seed')`,
    [routineId, JSON.stringify({ routine: 'Strength plus hypertrophy base', days: days.length })],
  )

  await pool.query('COMMIT')
  console.log('seeded workout profile, exercises, progression rules, and routine')
} catch (error) {
  await pool.query('ROLLBACK')
  throw error
} finally {
  await pool.end()
}

async function upsertRule(name, type, config) {
  const row = await one(
    `INSERT INTO workout_progression_rules (name, type, version, config_json, active)
     VALUES ($1, $2, 1, $3::jsonb, true)
     ON CONFLICT (name, version) DO UPDATE SET
       type = EXCLUDED.type,
       config_json = EXCLUDED.config_json,
       active = true,
       updated_at = now()
     RETURNING id`,
    [name, type, JSON.stringify(config)],
  )
  return row.id
}

async function one(sql, params = []) {
  const result = await pool.query(sql, params)
  return result.rows[0]
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return
  const contents = fs.readFileSync(filePath, 'utf8')
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key]) continue
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
}
