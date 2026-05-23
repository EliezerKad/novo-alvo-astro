type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      all: <T = unknown>() => Promise<{ results?: T[] }>;
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

const slugify = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 180);

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const db = env.EDITORIAL_DB;
  if (!db) return json({ views: {} });

  const url = new URL(request.url);
  const slugs = Array.from(
    new Set(
      String(url.searchParams.get('slugs') || '')
        .split(',')
        .map(slugify)
        .filter(Boolean),
    ),
  ).slice(0, 60);

  if (!slugs.length) return json({ views: {} });

  const placeholders = slugs.map(() => '?').join(',');
  const result = await db
    .prepare(`SELECT slug, total_views FROM article_views WHERE slug IN (${placeholders})`)
    .bind(...slugs)
    .all<{ slug: string; total_views: number }>();

  const views: Record<string, number> = Object.fromEntries(slugs.map((slug) => [slug, 0]));
  for (const row of result.results || []) {
    views[row.slug] = Number(row.total_views || 0);
  }

  return json({ views });
};
