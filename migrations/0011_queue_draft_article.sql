ALTER TABLE editorial_queue ADD COLUMN draft_article_id TEXT;

CREATE INDEX IF NOT EXISTS idx_editorial_queue_draft_article_id
  ON editorial_queue (draft_article_id);
