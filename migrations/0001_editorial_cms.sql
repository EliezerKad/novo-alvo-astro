CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  body_html TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Política',
  author TEXT NOT NULL DEFAULT 'Redação Novo Alvo',
  status TEXT NOT NULL DEFAULT 'draft',
  cover_url TEXT,
  cover_alt TEXT,
  seo_description TEXT,
  keywords TEXT,
  tags TEXT,
  sources TEXT,
  media TEXT,
  reading_minutes INTEGER NOT NULL DEFAULT 0,
  scheduled_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_scheduled_at ON articles(scheduled_at);
