ALTER TABLE honestfit_marketing_experiments
  DROP CONSTRAINT IF EXISTS honestfit_marketing_experiments_status_check;

ALTER TABLE honestfit_marketing_experiments
  ADD COLUMN IF NOT EXISTS post_body text,
  ADD COLUMN IF NOT EXISTS hook text,
  ADD COLUMN IF NOT EXISTS angle text,
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS posted_url text,
  ADD COLUMN IF NOT EXISTS check_after timestamptz,
  ADD COLUMN IF NOT EXISTS suggested_screenshot text,
  ADD COLUMN IF NOT EXISTS feedback_ask text;

UPDATE honestfit_marketing_experiments
SET post_body = COALESCE(post_body, post_draft),
    posted_url = COALESCE(posted_url, post_url),
    check_after = COALESCE(
      check_after,
      posted_at + (check_after_hours || ' hours')::interval
    )
WHERE post_body IS NULL
   OR posted_url IS NULL
   OR (check_after IS NULL AND posted_at IS NOT NULL);

ALTER TABLE honestfit_marketing_experiments
  ADD CONSTRAINT honestfit_marketing_experiments_status_check
  CHECK (status IN (
    'draft',
    'ready',
    'posted',
    'waiting_for_data',
    'learning_captured',
    'archived'
  ));
