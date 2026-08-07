-- Trend intelligence: living, refreshing signal from real charts (Beatport etc.)
-- Fed into every creative brief instead of a static one-time SKILL.md snapshot.
CREATE TABLE IF NOT EXISTS trend_intelligence (
  id                   SERIAL PRIMARY KEY,
  pulled_at            BIGINT NOT NULL,
  bpm_min              INTEGER,
  bpm_max              INTEGER,
  major_keys           TEXT,   -- comma list, e.g. "E,C,D"
  minor_keys           TEXT,   -- comma list, e.g. "G,F,B"
  vocal_feature_trend  TEXT,   -- free text signal on vocal-collab chart performance
  dominant_labels      TEXT,   -- comma list, e.g. "Afterlife,Anjunadeep,Innervisions,Keinemusik"
  remix_ratio          TEXT,   -- free text, e.g. "~25% of Hype 100 are remixes"
  guri_opportunity_flag BOOLEAN NOT NULL DEFAULT FALSE,
  raw_summary          TEXT,   -- full research synthesis, kept for audit/transparency
  source               TEXT NOT NULL DEFAULT 'claude_web_search'
);

-- Variation quota log: what axes actually changed per track, so sameness is
-- visible/measured rather than assumed. Team A = autonomous (עמית), Team B = Studio (human-driven).
CREATE TABLE IF NOT EXISTS creative_variation_log (
  id                  SERIAL PRIMARY KEY,
  team                TEXT NOT NULL CHECK (team IN ('A','B')),
  track_ref           TEXT,   -- music_queue.id, or a Studio session label
  key_signature       TEXT,
  is_major            BOOLEAN,
  bpm                 INTEGER,
  has_vocal_feature   BOOLEAN NOT NULL DEFAULT FALSE,
  reference_artist    TEXT,
  arrangement_energy  TEXT,
  axes_varied         TEXT,   -- comma list of axis names that differ from the immediately previous entry for this team
  created_at          BIGINT NOT NULL
);
