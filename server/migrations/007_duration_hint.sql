ALTER TABLE publish_queue
  ADD COLUMN IF NOT EXISTS duration_hint TEXT;
