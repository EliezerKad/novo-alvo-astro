CREATE TABLE IF NOT EXISTS editorial_queue (
  id TEXT PRIMARY KEY,
  pitch_id TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  publish_after TEXT NOT NULL,
  published_at TEXT,
  article_slug TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_editorial_queue_status ON editorial_queue(status);
CREATE INDEX IF NOT EXISTS idx_editorial_queue_category ON editorial_queue(category);
CREATE INDEX IF NOT EXISTS idx_editorial_queue_publish_after ON editorial_queue(publish_after);
