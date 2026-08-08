-- Manager gatekeeping upgrade (2026-08-07): real pre-filter gates for ART,
-- Brand/Voice, Music, and QA — measuring how many items each gate rejects
-- before reaching Alex's queue vs. how many pass through.
CREATE TABLE IF NOT EXISTS gate_log (
  id          SERIAL PRIMARY KEY,
  gate        TEXT NOT NULL CHECK (gate IN ('art_daniel','brand_shira','music_elad','qa_talia_yuval')),
  item_ref    TEXT NOT NULL,
  decision    TEXT NOT NULL CHECK (decision IN ('passed','rejected')),
  reason      TEXT,
  created_at  BIGINT NOT NULL
);

-- music_queue never stored which genre a track targeted — only
-- creative_variation_log did, requiring a join. Store it directly so gates
-- (and anything else reading a music_queue row) can reference the right
-- genre-specific standard without a lookup.
ALTER TABLE music_queue ADD COLUMN IF NOT EXISTS genre TEXT;
