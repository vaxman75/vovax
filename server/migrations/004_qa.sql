ALTER TABLE publish_queue
  ADD COLUMN IF NOT EXISTS qa_status   TEXT,
  ADD COLUMN IF NOT EXISTS qa_reason   TEXT,
  ADD COLUMN IF NOT EXISTS qa_issues   TEXT[],
  ADD COLUMN IF NOT EXISTS qa_at       BIGINT,
  ADD COLUMN IF NOT EXISTS qa_employee TEXT;

-- Revert two posts that were mistakenly approved by Claude (not by human) and then rejected
UPDATE publish_queue
SET status='pending', decided_at=NULL, notes=NULL
WHERE id IN ('msca3okxaay14', 'msca3g0u8t3lj')
  AND channel='vovax'
  AND status='rejected';
