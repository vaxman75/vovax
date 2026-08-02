-- Publishing queue for both channels
-- VOVAX posts require manual approval (status: pending → approved/rejected → published)
-- Signal Detected posts are fully automatic (status: pending → published directly)
CREATE TABLE IF NOT EXISTS publish_queue (
  id           TEXT PRIMARY KEY,
  channel      TEXT NOT NULL CHECK (channel IN ('vovax', 'signal')),
  platform     TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
  topic        TEXT NOT NULL,
  script       TEXT NOT NULL,
  script_hash  TEXT NOT NULL,
  avatar_id    TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected', 'published')),
  notes        TEXT,
  created_at   BIGINT NOT NULL,
  decided_at   BIGINT,
  published_at BIGINT
);
