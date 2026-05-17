CREATE TABLE IF NOT EXISTS editorial_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  site_url TEXT,
  feed_url TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL DEFAULT 'rss',
  country TEXT NOT NULL DEFAULT 'BR',
  language TEXT NOT NULL DEFAULT 'pt-BR',
  trust_level INTEGER NOT NULL DEFAULT 3,
  weight INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'untested',
  last_checked_at TEXT,
  last_item_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  notes TEXT,
  discovered_from TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_editorial_sources_category_active
  ON editorial_sources(category, active);

CREATE INDEX IF NOT EXISTS idx_editorial_sources_status
  ON editorial_sources(status);

CREATE INDEX IF NOT EXISTS idx_editorial_sources_updated
  ON editorial_sources(updated_at);

CREATE INDEX IF NOT EXISTS idx_editorial_sources_feed_url
  ON editorial_sources(feed_url);
