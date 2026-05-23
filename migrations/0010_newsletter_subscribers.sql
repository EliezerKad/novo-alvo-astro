CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'subscribed',
  source_path TEXT,
  user_agent TEXT,
  unsub_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  last_auto_response_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status_updated
  ON newsletter_subscribers (status, updated_at);
