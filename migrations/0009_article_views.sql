CREATE TABLE IF NOT EXISTS article_views (
  slug TEXT PRIMARY KEY,
  total_views INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_view_events (
  event_key TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_article_views_total ON article_views(total_views DESC, last_viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_view_events_slug ON article_view_events(slug);
CREATE INDEX IF NOT EXISTS idx_article_view_events_viewed_at ON article_view_events(viewed_at);
