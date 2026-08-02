-- SoundCloud track catalogue
CREATE TABLE IF NOT EXISTS tracks (
  id           BIGINT  PRIMARY KEY,
  title        TEXT    NOT NULL,
  description  TEXT,
  genre        TEXT,
  tags         TEXT,
  release_date TEXT,
  duration_ms  INTEGER,
  play_count   INTEGER NOT NULL DEFAULT 0,
  permalink_url TEXT,
  synced_at    BIGINT  NOT NULL
);

-- Link publish posts back to the track they were generated from
ALTER TABLE publish_queue ADD COLUMN IF NOT EXISTS track_id BIGINT;
