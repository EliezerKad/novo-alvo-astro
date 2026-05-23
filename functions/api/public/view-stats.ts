type D1Database = {
  prepare: (query: string) => {
    first: <T = unknown>() => Promise<T | null>;
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
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });

const clean = (value: unknown, max = 2000) =>
  String(value || '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);

const parseSlugs = (value: string) =>
  [...new Set(value.split(',').map((slug) => clean(slug, 180)).filter(Boolean))].slice(0, 80);

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const db = env.EDITORIAL_DB;
  if (!db) return json({ totalViews: 0, views: {}, top: [] });

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(20, Number(url.searchParams.get('limit') || 4)));
  const slugs = parseSlugs(clean(url.searchParams.get('slugs'), 8000));
  const safeScheduledPublishedAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const totalRow = await db.prepare('SELECT COALESCE(SUM(total_views), 0) AS total_views FROM article_views').first<{
    total_views: number;
  }>();

  const topRows = await db
    .prepare(
      `SELECT a.slug, a.title, COALESCE(v.total_views, 0) AS views
       FROM articles a
       INNER JOIN article_views v ON v.slug = a.slug
       WHERE a.status = 'published'
         AND COALESCE(v.total_views, 0) > 0
         AND (
           COALESCE(NULLIF(a.scheduled_at, ''), '') = ''
           OR COALESCE(NULLIF(a.published_at, ''), a.updated_at) <= ?
         )
       ORDER BY COALESCE(v.total_views, 0) DESC, COALESCE(NULLIF(a.published_at, ''), a.scheduled_at, a.updated_at) DESC
       LIMIT ?`,
    )
    .bind(safeScheduledPublishedAt, limit)
    .all<{ slug: string; title: string; views: number }>();

  const views: Record<string, number> = Object.fromEntries(slugs.map((slug) => [slug, 0]));
  if (slugs.length > 0) {
    const placeholders = slugs.map(() => '?').join(',');
    const viewRows = await db
      .prepare(`SELECT slug, total_views FROM article_views WHERE slug IN (${placeholders})`)
      .bind(...slugs)
      .all<{ slug: string; total_views: number }>();

    for (const row of viewRows.results || []) {
      views[row.slug] = Number(row.total_views || 0);
    }
  }

  return json({
    totalViews: Number(totalRow?.total_views || 0),
    views,
    top: (topRows.results || []).map((row) => ({
      slug: row.slug,
      title: row.title,
      views: Number(row.views || 0),
    })),
  });
};
