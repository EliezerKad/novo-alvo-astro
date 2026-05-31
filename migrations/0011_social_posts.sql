CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  article_id TEXT,
  article_slug TEXT,
  article_title TEXT,
  channel TEXT NOT NULL DEFAULT 'x',
  status TEXT NOT NULL DEFAULT 'draft',
  text TEXT NOT NULL,
  tweet_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  posted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_social_posts_channel_status ON social_posts(channel, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_article ON social_posts(article_slug);
