CREATE TABLE IF NOT EXISTS article_shares (
  slug TEXT NOT NULL,
  channel TEXT NOT NULL,
  total_shares INTEGER NOT NULL DEFAULT 0,
  last_shared_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (slug, channel)
);

CREATE TABLE IF NOT EXISTS article_share_events (
  event_key TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  channel TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  shared_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_article_shares_total ON article_shares(total_shares DESC, last_shared_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_share_events_slug ON article_share_events(slug);
CREATE INDEX IF NOT EXISTS idx_article_share_events_channel ON article_share_events(channel, shared_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_share_events_shared_at ON article_share_events(shared_at);
