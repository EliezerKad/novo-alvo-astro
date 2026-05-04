type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      all: <T = unknown>() => Promise<{ results?: T[] }>;
      first: <T = unknown>() => Promise<T | null>;
    };
  };
};

type Env = {
  EDITORIAL_DB?: D1Database;
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60',
      ...(init.headers || {}),
    },
  });

const clean = (value: unknown, max = 2000) =>
  String(value || '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const db = env.EDITORIAL_DB;
  if (!db) return json({ articles: [] });

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(30, Number(url.searchParams.get('limit') || 12)));
  const category = clean(url.searchParams.get('category'), 80);
  const now = new Date().toISOString();

  const query = category
    ? `SELECT id, slug, title, summary, category, author, status, cover_url, cover_alt, reading_minutes, scheduled_at, published_at, created_at, updated_at
       FROM articles
       WHERE category = ?
         AND (status = 'published' OR (status = 'scheduled' AND scheduled_at <= ?))
       ORDER BY COALESCE(NULLIF(published_at, ''), scheduled_at, updated_at) DESC
       LIMIT ?`
    : `SELECT id, slug, title, summary, category, author, status, cover_url, cover_alt, reading_minutes, scheduled_at, published_at, created_at, updated_at
       FROM articles
       WHERE status = 'published' OR (status = 'scheduled' AND scheduled_at <= ?)
       ORDER BY COALESCE(NULLIF(published_at, ''), scheduled_at, updated_at) DESC
       LIMIT ?`;

  const result = category
    ? await db.prepare(query).bind(category, now, limit).all()
    : await db.prepare(query).bind(now, limit).all();

  return json({ articles: result.results || [] });
};
