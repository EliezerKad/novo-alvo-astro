CREATE TABLE IF NOT EXISTS editorial_pitches (
  id TEXT PRIMARY KEY,
  cluster_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  category TEXT NOT NULL DEFAULT 'Brasil',
  status TEXT NOT NULL DEFAULT 'new',
  source_count INTEGER NOT NULL DEFAULT 0,
  primary_url TEXT,
  sources TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  keywords TEXT,
  internal_links TEXT NOT NULL DEFAULT '[]',
  image_candidates TEXT NOT NULL DEFAULT '[]',
  score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_editorial_pitches_status ON editorial_pitches(status);
CREATE INDEX IF NOT EXISTS idx_editorial_pitches_category ON editorial_pitches(category);
CREATE INDEX IF NOT EXISTS idx_editorial_pitches_updated_at ON editorial_pitches(updated_at);
CREATE INDEX IF NOT EXISTS idx_editorial_pitches_expires_at ON editorial_pitches(expires_at);
