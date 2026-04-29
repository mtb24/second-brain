CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workout_user_profile (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  display_name text NOT NULL DEFAULT 'Ken',
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  goal_type text NOT NULL DEFAULT 'strength_hypertrophy',
  training_age text NOT NULL DEFAULT 'experienced',
  available_days jsonb NOT NULL DEFAULT '["mon","wed","fri"]'::jsonb,
  session_length_minutes integer NOT NULL DEFAULT 60,
  equipment_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  injury_notes text NOT NULL DEFAULT '',
  preferred_units text NOT NULL DEFAULT 'lb',
  exercise_aliases_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  accessibility_settings jsonb NOT NULL DEFAULT '{"largeText":true,"highContrast":true,"reduceMotion":false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL UNIQUE,
  aliases_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  movement_pattern text NOT NULL,
  primary_muscles_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  equipment_type text NOT NULL DEFAULT 'any',
  default_rest_seconds integer NOT NULL DEFAULT 90,
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_progression_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

CREATE TABLE IF NOT EXISTS workout_routine_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  goal_type text NOT NULL DEFAULT 'strength_hypertrophy',
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_routine_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_template_id uuid NOT NULL REFERENCES workout_routine_templates(id) ON DELETE CASCADE,
  day_index integer NOT NULL,
  label text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (routine_template_id, day_index)
);

CREATE TABLE IF NOT EXISTS workout_planned_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_day_id uuid NOT NULL REFERENCES workout_routine_days(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES workout_exercises(id),
  target_sets integer NOT NULL DEFAULT 3,
  target_reps_min integer NOT NULL DEFAULT 8,
  target_reps_max integer NOT NULL DEFAULT 12,
  target_load numeric(8, 2),
  target_intensity_type text NOT NULL DEFAULT 'rpe',
  target_intensity_value numeric(4, 1),
  progression_rule_id uuid REFERENCES workout_progression_rules(id),
  notes text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_constraints (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  available_days_json jsonb NOT NULL DEFAULT '["mon","wed","fri"]'::jsonb,
  unavailable_dates_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  equipment_constraints_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  movement_constraints_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  travel_mode boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_for date NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'planned',
  routine_template_id uuid REFERENCES workout_routine_templates(id),
  routine_day_id uuid REFERENCES workout_routine_days(id),
  notes text NOT NULL DEFAULT '',
  created_by_source text NOT NULL DEFAULT 'system',
  rule_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workout_sessions_scheduled_for_idx
  ON workout_sessions (scheduled_for);

CREATE INDEX IF NOT EXISTS workout_sessions_status_idx
  ON workout_sessions (status);

CREATE TABLE IF NOT EXISTS workout_exercise_performances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_session_id uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES workout_exercises(id),
  planned_movement_id uuid REFERENCES workout_planned_movements(id),
  order_index integer NOT NULL DEFAULT 0,
  prescribed_sets integer NOT NULL DEFAULT 3,
  prescribed_reps_min integer NOT NULL DEFAULT 8,
  prescribed_reps_max integer NOT NULL DEFAULT 12,
  prescribed_load numeric(8, 2),
  prescribed_intensity_type text NOT NULL DEFAULT 'rpe',
  prescribed_intensity_value numeric(4, 1),
  suggested_load numeric(8, 2),
  progression_rule_id uuid REFERENCES workout_progression_rules(id),
  progression_rule_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'planned',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workout_exercise_performances_session_idx
  ON workout_exercise_performances (workout_session_id, order_index);

CREATE INDEX IF NOT EXISTS workout_exercise_performances_exercise_idx
  ON workout_exercise_performances (exercise_id);

CREATE TABLE IF NOT EXISTS workout_set_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_performance_id uuid NOT NULL REFERENCES workout_exercise_performances(id) ON DELETE CASCADE,
  set_number integer NOT NULL,
  reps integer NOT NULL,
  load numeric(8, 2),
  unit text NOT NULL DEFAULT 'lb',
  rpe numeric(4, 1),
  completed boolean NOT NULL DEFAULT true,
  is_warmup boolean NOT NULL DEFAULT false,
  is_failure boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'ui',
  source_message_id text,
  idempotency_key text,
  performed_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workout_set_entries_idempotency_key_idx
  ON workout_set_entries (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS workout_set_entries_performance_idx
  ON workout_set_entries (exercise_performance_id, set_number)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS workout_pr_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES workout_exercises(id),
  type text NOT NULL,
  value numeric(10, 2) NOT NULL,
  unit text NOT NULL DEFAULT 'lb',
  achieved_at timestamptz NOT NULL DEFAULT now(),
  workout_session_id uuid REFERENCES workout_sessions(id) ON DELETE SET NULL,
  set_entry_id uuid REFERENCES workout_set_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exercise_id, type)
);

CREATE TABLE IF NOT EXISTS workout_body_metric_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL,
  body_part text,
  value numeric(10, 2) NOT NULL,
  unit text NOT NULL,
  measured_at date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'ui',
  notes text NOT NULL DEFAULT '',
  source_message_id text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workout_body_metric_entries_idempotency_key_idx
  ON workout_body_metric_entries (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS workout_body_metric_entries_lookup_idx
  ON workout_body_metric_entries (metric_type, body_part, measured_at DESC);

CREATE TABLE IF NOT EXISTS workout_plan_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_session_id uuid REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_performance_id uuid REFERENCES workout_exercise_performances(id) ON DELETE CASCADE,
  decision_type text NOT NULL,
  explanation text NOT NULL,
  inputs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_source text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL DEFAULT 'user',
  actor_id text NOT NULL DEFAULT 'ken',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_json jsonb,
  after_json jsonb,
  source text NOT NULL DEFAULT 'ui',
  source_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workout_audit_log_created_at_idx
  ON workout_audit_log (created_at DESC);
