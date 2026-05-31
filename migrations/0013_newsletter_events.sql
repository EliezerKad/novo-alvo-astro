CREATE TABLE IF NOT EXISTS newsletter_events (
  id TEXT PRIMARY KEY,
  resend_email_id TEXT,
  broadcast_id TEXT,
  campaign TEXT,
  email TEXT,
  event TEXT NOT NULL,
  subject TEXT,
  link_url TEXT,
  raw_payload TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_newsletter_events_resend_email
  ON newsletter_events (resend_email_id);

CREATE INDEX IF NOT EXISTS idx_newsletter_events_email_event
  ON newsletter_events (email, event, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_newsletter_events_campaign_event
  ON newsletter_events (campaign, event, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_newsletter_events_created_at
  ON newsletter_events (created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_sends (
  id TEXT PRIMARY KEY,
  resend_email_id TEXT UNIQUE,
  email TEXT NOT NULL,
  subject TEXT,
  campaign TEXT,
  provider_status TEXT NOT NULL DEFAULT 'sent',
  last_event TEXT,
  sent_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_newsletter_sends_email
  ON newsletter_sends (email);

CREATE INDEX IF NOT EXISTS idx_newsletter_sends_campaign
  ON newsletter_sends (campaign, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_newsletter_sends_last_event
  ON newsletter_sends (last_event, updated_at DESC);
