ALTER TABLE publish_queue
  ADD COLUMN IF NOT EXISTS avatar_gender   TEXT,
  ADD COLUMN IF NOT EXISTS heygen_voice_id TEXT,
  ADD COLUMN IF NOT EXISTS el_voice_id     TEXT;
