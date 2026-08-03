ALTER TABLE publish_queue
  ADD COLUMN IF NOT EXISTS heygen_video_id  TEXT,
  ADD COLUMN IF NOT EXISTS video_url        TEXT,
  ADD COLUMN IF NOT EXISTS rejection_count  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS regenerated_from TEXT;
