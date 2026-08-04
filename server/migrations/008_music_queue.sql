-- Music creation queue: autonomous ACE-Step generation pipeline
-- States: generating → talia_qa → amit_review → user_pending → user_approved/user_rejected → published/failed
CREATE TABLE IF NOT EXISTS music_queue (
  id               TEXT PRIMARY KEY,
  status           TEXT NOT NULL DEFAULT 'generating'
                   CHECK (status IN ('generating','talia_qa','amit_review','user_pending','user_approved','user_rejected','published','failed')),
  request_id       TEXT,
  prompt           TEXT NOT NULL,
  lyrics           TEXT,
  duration_s       INTEGER NOT NULL DEFAULT 180,
  bpm              INTEGER,
  model            TEXT NOT NULL DEFAULT 'ace-step-xl',
  batch_size       INTEGER NOT NULL DEFAULT 1,
  context_hour     TEXT,
  platform         TEXT,
  mood             TEXT,
  weirdness        INTEGER DEFAULT 0,
  energy_level     INTEGER,
  audio_urls       JSONB,
  talia_verdict    TEXT,
  talia_result     JSONB,
  talia_at         BIGINT,
  amit_approved    BOOLEAN,
  amit_reason      TEXT,
  amit_at          BIGINT,
  rejection_count  INTEGER NOT NULL DEFAULT 0,
  regenerated_from TEXT,
  created_at       BIGINT NOT NULL,
  updated_at       BIGINT NOT NULL
);
