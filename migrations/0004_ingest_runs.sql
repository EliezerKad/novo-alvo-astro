CREATE TABLE IF NOT EXISTS ingest_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'success',
  items_total INTEGER NOT NULL DEFAULT 0,
  topic_clusters INTEGER NOT NULL DEFAULT 0,
  radar_clusters INTEGER NOT NULL DEFAULT 0,
  selected_pitches INTEGER NOT NULL DEFAULT 0,
  saved_pitches INTEGER NOT NULL DEFAULT 0,
  skipped_pitches INTEGER NOT NULL DEFAULT 0,
  feed_counts TEXT NOT NULL DEFAULT '{}',
  notes TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ingest_runs_finished_at ON ingest_runs(finished_at);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_status ON ingest_runs(status);
