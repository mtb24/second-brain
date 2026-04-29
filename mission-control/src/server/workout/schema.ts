import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const workoutUserProfile = pgTable('workout_user_profile', {
  id: text('id').primaryKey().default('default'),
  displayName: text('display_name').notNull().default('Ken'),
  timezone: text('timezone').notNull().default('America/Los_Angeles'),
  goalType: text('goal_type').notNull().default('strength_hypertrophy'),
  trainingAge: text('training_age').notNull().default('experienced'),
  availableDays: jsonb('available_days').notNull().default(['mon', 'wed', 'fri']),
  sessionLengthMinutes: integer('session_length_minutes').notNull().default(60),
  equipmentProfile: jsonb('equipment_profile').notNull().default({}),
  injuryNotes: text('injury_notes').notNull().default(''),
  preferredUnits: text('preferred_units').notNull().default('lb'),
  exerciseAliasesJson: jsonb('exercise_aliases_json').notNull().default({}),
  accessibilitySettings: jsonb('accessibility_settings').notNull().default({
    largeText: true,
    highContrast: true,
    reduceMotion: false,
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workoutExercises = pgTable('workout_exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  canonicalName: text('canonical_name').notNull().unique(),
  aliasesJson: jsonb('aliases_json').notNull().default([]),
  movementPattern: text('movement_pattern').notNull(),
  primaryMusclesJson: jsonb('primary_muscles_json').notNull().default([]),
  equipmentType: text('equipment_type').notNull().default('any'),
  defaultRestSeconds: integer('default_rest_seconds').notNull().default(90),
  notes: text('notes').notNull().default(''),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workoutProgressionRules = pgTable('workout_progression_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  version: integer('version').notNull().default(1),
  configJson: jsonb('config_json').notNull().default({}),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workoutRoutineTemplates = pgTable('workout_routine_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  goalType: text('goal_type').notNull().default('strength_hypertrophy'),
  description: text('description').notNull().default(''),
  active: boolean('active').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workoutRoutineDays = pgTable('workout_routine_days', {
  id: uuid('id').primaryKey().defaultRandom(),
  routineTemplateId: uuid('routine_template_id').notNull(),
  dayIndex: integer('day_index').notNull(),
  label: text('label').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workoutPlannedMovements = pgTable('workout_planned_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  routineDayId: uuid('routine_day_id').notNull(),
  exerciseId: uuid('exercise_id').notNull(),
  targetSets: integer('target_sets').notNull().default(3),
  targetRepsMin: integer('target_reps_min').notNull().default(8),
  targetRepsMax: integer('target_reps_max').notNull().default(12),
  targetLoad: numeric('target_load', { precision: 8, scale: 2 }),
  targetIntensityType: text('target_intensity_type').notNull().default('rpe'),
  targetIntensityValue: numeric('target_intensity_value', { precision: 4, scale: 1 }),
  progressionRuleId: uuid('progression_rule_id'),
  notes: text('notes').notNull().default(''),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workoutSessions = pgTable('workout_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  scheduledFor: date('scheduled_for').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: text('status').notNull().default('planned'),
  routineTemplateId: uuid('routine_template_id'),
  routineDayId: uuid('routine_day_id'),
  notes: text('notes').notNull().default(''),
  createdBySource: text('created_by_source').notNull().default('system'),
  ruleSnapshotJson: jsonb('rule_snapshot_json').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
