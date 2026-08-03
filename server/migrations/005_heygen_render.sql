ALTER TABLE publish_queue
  ADD COLUMN IF NOT EXISTS heygen_video_id  TEXT,
  ADD COLUMN IF NOT EXISTS video_url        TEXT,
  ADD COLUMN IF NOT EXISTS rejection_count  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS regenerated_from TEXT;

-- Expand status enum to include rendering (HeyGen job submitted) and failed
ALTER TABLE publish_queue DROP CONSTRAINT IF EXISTS publish_queue_status_check;
ALTER TABLE publish_queue
  ADD CONSTRAINT publish_queue_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'published', 'rendering', 'failed'));
