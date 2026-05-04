CREATE TABLE IF NOT EXISTS honestfit_marketing_experiments (
  id text PRIMARY KEY,
  title text NOT NULL,
  hypothesis text NOT NULL,
  channel text NOT NULL,
  target_url text NOT NULL,
  post_draft text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'waiting_for_data', 'learning_captured')),
  post_url text,
  posted_at timestamptz,
  check_after_hours integer NOT NULL DEFAULT 24,
  learning_what_happened text NOT NULL DEFAULT '',
  learning_what_was_confusing text NOT NULL DEFAULT '',
  next_message_angle text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS honestfit_marketing_experiments_status_updated_idx
  ON honestfit_marketing_experiments (status, updated_at DESC);
