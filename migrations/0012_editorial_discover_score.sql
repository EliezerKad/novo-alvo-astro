ALTER TABLE editorial_pitches ADD COLUMN discover_score INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_editorial_pitches_discover_score ON editorial_pitches(discover_score);
