type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      run: () => Promise<unknown>;
    };
    run: () => Promise<unknown>;
  };
};

type Env = {
  EDITORIAL_DB?: D1Database;
  RESEND_WEBHOOK_SECRET?: string;
};

type ResendWebhookPayload = {
  type?: string;
  created_at?: string;
  data?: ResendWebhookData;
};

type ResendWebhookData = {
  email_id?: string;
  broadcast_id?: string;
  to?: string[] | string;
  subject?: string;
  tags?: Array<{ name?: string; value?: string }>;
  click?: { link?: string; url?: string };
};

const clean = (value: unknown, max = 1000) =>
  String(value || '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });

const ensureTables = async (db: D1Database) => {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS newsletter_events (
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
      )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS newsletter_sends (
        id TEXT PRIMARY KEY,
        resend_email_id TEXT UNIQUE,
        email TEXT NOT NULL,
        subject TEXT,
        campaign TEXT,
        provider_status TEXT NOT NULL DEFAULT 'sent',
        last_event TEXT,
        sent_at TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
};

const normalizeEvent = (event: string) => {
  const value = clean(event, 80).toLowerCase();
  if (value === 'email.sent') return 'sent';
  if (value === 'email.delivered') return 'delivered';
  if (value === 'email.delivery_delayed') return 'delivery_delayed';
  if (value === 'email.opened') return 'opened';
  if (value === 'email.clicked') return 'clicked';
  if (value === 'email.bounced') return 'bounced';
  if (value === 'email.complained') return 'complained';
  return value.replace(/^email\./, '') || 'unknown';
};

const tagValue = (tags: ResendWebhookData['tags'], name: string) =>
  (Array.isArray(tags) ? tags : []).find((tag) => clean(tag?.name, 80).toLowerCase() === name)?.value || '';

const recipient = (value: ResendWebhookData['to']) => {
  if (Array.isArray(value)) return clean(value[0], 254).toLowerCase();
  return clean(value, 254).toLowerCase();
};

const timingSafeEqual = (left: string, right: string) => {
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const secret = clean(env.RESEND_WEBHOOK_SECRET, 500);
  if (secret) {
    const provided = clean(request.headers.get('x-resend-webhook-secret') || new URL(request.url).searchParams.get('secret'), 500);
    if (!timingSafeEqual(provided, secret)) return json({ ok: false, error: 'Webhook nao autorizado.' }, { status: 401 });
  }

  const db = env.EDITORIAL_DB;
  if (!db) return json({ ok: false, error: 'Banco editorial nao configurado.' }, { status: 503 });
  await ensureTables(db);

  const payload = (await request.json().catch(() => null)) as ResendWebhookPayload | null;
  if (!payload?.type) return json({ ok: false, error: 'Payload invalido.' }, { status: 400 });

  const event = normalizeEvent(payload.type);
  const data = payload.data || {};
  const resendEmailId = clean(data.email_id, 120);
  const email = recipient(data.to);
  const subject = clean(data.subject, 240);
  const campaign = clean(tagValue(data.tags, 'campaign'), 120);
  const broadcastId = clean(data.broadcast_id, 120);
  const createdAt = clean(payload.created_at, 80) || new Date().toISOString();
  const linkUrl = clean(data.click?.link || data.click?.url, 1000);
  const rawPayload = JSON.stringify(payload).slice(0, 8000);
  const dedupeKey = [resendEmailId, email, event, linkUrl, createdAt].join('|') || crypto.randomUUID();

  await db
    .prepare(
      `INSERT OR IGNORE INTO newsletter_events (
        id, resend_email_id, broadcast_id, campaign, email, event, subject, link_url, raw_payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(dedupeKey, resendEmailId, broadcastId, campaign, email, event, subject, linkUrl, rawPayload, createdAt)
    .run();

  if (email) {
    await db
      .prepare(
        `INSERT INTO newsletter_sends (
          id, resend_email_id, email, subject, campaign, provider_status, last_event, sent_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(resend_email_id) DO UPDATE SET
          email = COALESCE(NULLIF(excluded.email, ''), newsletter_sends.email),
          subject = COALESCE(NULLIF(excluded.subject, ''), newsletter_sends.subject),
          campaign = COALESCE(NULLIF(excluded.campaign, ''), newsletter_sends.campaign),
          provider_status = excluded.provider_status,
          last_event = excluded.last_event,
          updated_at = excluded.updated_at`,
      )
      .bind(
        resendEmailId || crypto.randomUUID(),
        resendEmailId || null,
        email,
        subject,
        campaign,
        event,
        event,
        createdAt,
        new Date().toISOString(),
      )
      .run();
  }

  return json({ ok: true, event, email, resendEmailId });
};
