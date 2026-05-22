const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });

const safeId = (value) => String(value || '').replace(/[^a-zA-Z0-9:-]/g, '').slice(0, 96);

const articleSlugFromPath = (value) => {
  const match = String(value || '').match(/^\/noticia\/([^/?#]+)\/?/);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]).replace(/[^a-z0-9-]/gi, '').slice(0, 180);
  } catch {
    return match[1].replace(/[^a-z0-9-]/gi, '').slice(0, 180);
  }
};

const registerArticleView = async (env, visitorId, path, now) => {
  const db = env.EDITORIAL_DB;
  if (!db) return null;

  const slug = articleSlugFromPath(path);
  if (!slug) return null;

  const bucket = new Date(now).toISOString().slice(0, 10);
  const eventKey = `${slug}:${visitorId}:${bucket}`;

  const inserted = await db
    .prepare('INSERT OR IGNORE INTO article_view_events (event_key, slug, visitor_id, viewed_at) VALUES (?, ?, ?, ?)')
    .bind(eventKey, slug, visitorId, new Date(now).toISOString())
    .run();

  const changes = Number(inserted?.meta?.changes || inserted?.changes || 0);
  if (changes > 0) {
    await db
      .prepare(
        `INSERT INTO article_views (slug, total_views, last_viewed_at)
         VALUES (?, 1, ?)
         ON CONFLICT(slug) DO UPDATE SET
           total_views = total_views + 1,
           last_viewed_at = excluded.last_viewed_at`,
      )
      .bind(slug, new Date(now).toISOString())
      .run();
  }

  const row = await db.prepare('SELECT total_views FROM article_views WHERE slug = ? LIMIT 1').bind(slug).first();
  return {
    slug,
    counted: changes > 0,
    views: Number(row?.total_views || 0),
  };
};

export async function onRequestPost({ request, env }) {
  const store = env.VISITOR_COUNTER;
  if (!store && !env.EDITORIAL_DB) return json({ enabled: false });

  let payload = {};
  try {
    payload = await request.json();
  } catch {}

  const visitorId = safeId(payload.visitorId);
  if (!visitorId) return json({ enabled: false }, { status: 400 });

  const now = Date.now();
  const onlineKey = `online:${visitorId}`;

  if (store) {
    await store.put(
      onlineKey,
      JSON.stringify({
        path: String(payload.path || '/').slice(0, 160),
        updatedAt: now,
      }),
      { expirationTtl: 600 },
    );
  }

  const online = store ? await store.list({ prefix: 'online:', limit: 1000 }) : { keys: [] };
  const article = await registerArticleView(env, visitorId, payload.path, now).catch(() => null);

  return json({
    enabled: true,
    online: online.keys.length,
    article,
  });
}
