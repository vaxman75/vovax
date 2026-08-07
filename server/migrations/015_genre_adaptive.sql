-- Genre is per-track, not company-wide: trend_intelligence now stores one row
-- per genre per pull, instead of one fixed "melodic house & techno" snapshot.
ALTER TABLE trend_intelligence ADD COLUMN IF NOT EXISTS genre TEXT;

-- creative_variation_log gains genre as a tracked/varied axis alongside key/bpm/etc.
ALTER TABLE creative_variation_log ADD COLUMN IF NOT EXISTS genre TEXT;

-- Real visual verification of HeyGen avatars — replaces blind name-keyword matching.
-- One row per (avatar_id, persona) since brand fit can differ by persona (vovax vs signal).
CREATE TABLE IF NOT EXISTS avatar_vision_cache (
  avatar_id    TEXT NOT NULL,
  persona      TEXT NOT NULL,
  verdict      TEXT NOT NULL CHECK (verdict IN ('approved','rejected')),
  energy       TEXT CHECK (energy IN ('high','calm','neutral')),
  visual_notes TEXT,
  checked_at   BIGINT NOT NULL,
  PRIMARY KEY (avatar_id, persona)
);
