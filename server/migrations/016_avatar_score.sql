-- Binary approved/rejected was too strict for HeyGen's actual catalog (0/80
-- passed a strict "underground techno artist" bar in live testing) — add a
-- graded fit score so the best AVAILABLE option can be picked and reported
-- honestly, instead of hard-failing when nothing is a perfect match.
ALTER TABLE avatar_vision_cache ADD COLUMN IF NOT EXISTS score INTEGER;
