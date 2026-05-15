CREATE TABLE IF NOT EXISTS editorial_memory (
  id TEXT PRIMARY KEY,
  subject_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'seen',
  source_count INTEGER NOT NULL DEFAULT 0,
  strength INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_pitch_id TEXT,
  article_slug TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_editorial_memory_subject_key ON editorial_memory(subject_key);
CREATE INDEX IF NOT EXISTS idx_editorial_memory_category ON editorial_memory(category);
CREATE INDEX IF NOT EXISTS idx_editorial_memory_status ON editorial_memory(status);
CREATE INDEX IF NOT EXISTS idx_editorial_memory_last_seen_at ON editorial_memory(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_editorial_memory_expires_at ON editorial_memory(expires_at);
