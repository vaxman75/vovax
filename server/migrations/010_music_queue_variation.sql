-- Stores the varied descriptor selections so amitBrief() can deduplicate across cycles
ALTER TABLE music_queue ADD COLUMN IF NOT EXISTS key_signature TEXT;
ALTER TABLE music_queue ADD COLUMN IF NOT EXISTS bassline_desc TEXT;
ALTER TABLE music_queue ADD COLUMN IF NOT EXISTS pad_desc      TEXT;
ALTER TABLE music_queue ADD COLUMN IF NOT EXISTS kick_desc     TEXT;
