const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });

const clean = (value, max = 1000) =>
  String(value || '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);

const safeSlug = (value) => clean(value, 180).replace(/[^a-z0-9-]/gi, '');
const safeVisitor = (value) => clean(value, 96).replace(/[^a-zA-Z0-9:-]/g, '');
const safeChannel = (value) => {
  const channel = clean(value, 40).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return ['whatsapp', 'x', 'facebook', 'copy', 'native'].includes(channel) ? channel : '';
};

const slugFromPath = (value) => {
  const match = clean(value, 240).match(/^\/noticia\/([^/?#]+)\/?/);
  if (!match) return '';
  try {
    return safeSlug(decodeURIComponent(match[1]));
  } catch {
    return safeSlug(match[1]);
  }
};

const ensureTables = async (db) => {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS article_shares (
        slug TEXT NOT NULL,
        channel TEXT NOT NULL,
        total_shares INTEGER NOT NULL DEFAULT 0,
        last_shared_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (slug, channel)
      )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS article_share_events (
        event_key TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        channel TEXT NOT NULL,
        visitor_id TEXT NOT NULL,
        path TEXT NOT NULL DEFAULT '',
        shared_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_article_shares_total ON article_shares(total_shares DESC, last_shared_at DESC)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_article_share_events_slug ON article_share_events(slug)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_article_share_events_channel ON article_share_events(channel, shared_at DESC)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_article_share_events_shared_at ON article_share_events(shared_at)').run();
};

export async function onRequestPost({ request, env }) {
  const db = env.EDITORIAL_DB;
  if (!db) return json({ ok: false, error: 'EDITORIAL_DB nao configurado.' }, { status: 503 });

  let payload = {};
  try {
    payload = await request.json();
  } catch {}

  const path = clean(payload.path, 240);
  const slug = safeSlug(payload.slug) || slugFromPath(path);
  const channel = safeChannel(payload.channel);
  const visitorId = safeVisitor(payload.visitorId);

  if (!slug || !channel || !visitorId) return json({ ok: false, error: 'Evento incompleto.' }, { status: 400 });

  const now = new Date().toISOString();
  const bucket = now.slice(0, 10);
  const eventKey = `${slug}:${channel}:${visitorId}:${bucket}`;

  await ensureTables(db);

  const inserted = await db
    .prepare('INSERT OR IGNORE INTO article_share_events (event_key, slug, channel, visitor_id, path, shared_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(eventKey, slug, channel, visitorId, path, now)
    .run();

  const changes = Number(inserted?.meta?.changes || inserted?.changes || 0);
  if (changes > 0) {
    await db
      .prepare(
        `INSERT INTO article_shares (slug, channel, total_shares, last_shared_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(slug, channel) DO UPDATE SET
           total_shares = total_shares + 1,
           last_shared_at = excluded.last_shared_at`,
      )
      .bind(slug, channel, now)
      .run();
  }

  const row = await db
    .prepare('SELECT COALESCE(SUM(total_shares), 0) AS shares FROM article_shares WHERE slug = ?')
    .bind(slug)
    .first();

  return json({
    ok: true,
    slug,
    channel,
    counted: changes > 0,
    shares: Number(row?.shares || 0),
  });
}
