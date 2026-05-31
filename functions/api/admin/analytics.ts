type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      all: <T = unknown>() => Promise<{ results?: T[] }>;
    };
    first: <T = unknown>() => Promise<T | null>;
    all: <T = unknown>() => Promise<{ results?: T[] }>;
  };
};

type Env = {
  ADMIN_TOKEN?: string;
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

const clean = (value: unknown, max = 1000) =>
  String(value || '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);

const num = (value: unknown) => Number(value || 0) || 0;

const requireAdmin = (request: Request, env: Env) => {
  if (!env.ADMIN_TOKEN) return json({ ok: false, error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-admin-token') || '';
  if (token !== env.ADMIN_TOKEN) return json({ ok: false, error: 'Token editorial invalido.' }, { status: 401 });
  return null;
};

const pct = (part: number, total: number) => (total > 0 ? Number(((part / total) * 100).toFixed(1)) : 0);

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = env.EDITORIAL_DB;
  if (!db) return json({ ok: false, error: 'EDITORIAL_DB nao configurado.' }, { status: 503 });

  const url = new URL(request.url);
  const days = Math.max(1, Math.min(60, Number(url.searchParams.get('days') || 14)));
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const previousSince = new Date(Date.now() - (days * 2 - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [totals, rangeTotals, previousTotals, publishedArticles, rangePublishedArticles, hourly, daily, categories, topArticles, visitors, returningVisitors] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS views,
                COUNT(DISTINCT visitor_id) AS visitors,
                COUNT(DISTINCT slug) AS articles,
                MIN(viewed_at) AS first_viewed_at,
                MAX(viewed_at) AS last_viewed_at
           FROM article_view_events`,
      )
      .first(),
    db
      .prepare(
        `SELECT COUNT(*) AS views,
                COUNT(DISTINCT visitor_id) AS visitors,
                COUNT(DISTINCT slug) AS articles,
                MIN(viewed_at) AS first_viewed_at,
                MAX(viewed_at) AS last_viewed_at
           FROM article_view_events
          WHERE substr(viewed_at, 1, 10) >= ?`,
      )
      .bind(since)
      .first(),
    db
      .prepare(
        `SELECT COUNT(*) AS views,
                COUNT(DISTINCT visitor_id) AS visitors,
                COUNT(DISTINCT slug) AS articles
           FROM article_view_events
          WHERE substr(viewed_at, 1, 10) >= ?
            AND substr(viewed_at, 1, 10) < ?`,
      )
      .bind(previousSince, since)
      .first(),
    db.prepare(`SELECT COUNT(*) AS articles FROM articles WHERE status = 'published'`).first(),
    db
      .prepare(
        `SELECT COUNT(*) AS articles
           FROM articles
          WHERE status = 'published'
            AND substr(COALESCE(NULLIF(published_at, ''), scheduled_at, updated_at), 1, 10) >= ?`,
      )
      .bind(since)
      .first(),
    db
      .prepare(
        `SELECT substr(viewed_at, 12, 2) AS hour,
                COUNT(*) AS views,
                COUNT(DISTINCT visitor_id) AS visitors
           FROM article_view_events
          WHERE substr(viewed_at, 1, 10) >= ?
          GROUP BY hour
          ORDER BY hour ASC`,
      )
      .bind(since)
      .all(),
    db
      .prepare(
        `SELECT substr(viewed_at, 1, 10) AS day,
                COUNT(*) AS views,
                COUNT(DISTINCT visitor_id) AS visitors,
                COUNT(DISTINCT slug) AS articles
           FROM article_view_events
          WHERE substr(viewed_at, 1, 10) >= ?
          GROUP BY day
          ORDER BY day ASC`,
      )
      .bind(since)
      .all(),
    db
      .prepare(
        `SELECT COALESCE(NULLIF(a.category, ''), 'Sem categoria') AS category,
                COUNT(e.event_key) AS views,
                COUNT(DISTINCT e.visitor_id) AS visitors,
                COUNT(DISTINCT e.slug) AS articles
           FROM article_view_events e
           LEFT JOIN articles a ON a.slug = e.slug
          WHERE substr(e.viewed_at, 1, 10) >= ?
          GROUP BY category
          ORDER BY views DESC
          LIMIT 24`,
      )
      .bind(since)
      .all(),
    db
      .prepare(
        `SELECT COALESCE(a.title, v.slug) AS title,
                COALESCE(NULLIF(a.category, ''), 'Sem categoria') AS category,
                v.slug,
                v.total_views AS views,
                v.last_viewed_at
           FROM article_views v
           LEFT JOIN articles a ON a.slug = v.slug
          ORDER BY v.total_views DESC, v.last_viewed_at DESC
          LIMIT 24`,
      )
      .all(),
    db
      .prepare(
        `SELECT visitor_id,
                COUNT(*) AS views,
                COUNT(DISTINCT slug) AS articles,
                MIN(viewed_at) AS first_seen,
                MAX(viewed_at) AS last_seen
           FROM article_view_events
          GROUP BY visitor_id
          ORDER BY views DESC, last_seen DESC
          LIMIT 8`,
      )
      .all(),
    db
      .prepare(
        `SELECT COUNT(*) AS visitors
           FROM (
             SELECT visitor_id, COUNT(*) AS views, COUNT(DISTINCT substr(viewed_at, 1, 10)) AS active_days
               FROM article_view_events
              WHERE substr(viewed_at, 1, 10) >= ?
              GROUP BY visitor_id
             HAVING views > 1 OR active_days > 1
           )`,
      )
      .bind(since)
      .first(),
  ]);

  const totalViews = num((totals as { views?: number } | null)?.views);
  const leadingVisitor = ((visitors.results || []) as Array<{ views?: number }>)[0];
  const leadingVisitorViews = num(leadingVisitor?.views);
  const rangeViews = num((rangeTotals as { views?: number } | null)?.views);
  const previousViews = num((previousTotals as { views?: number } | null)?.views);
  const totalPublished = num((publishedArticles as { articles?: number } | null)?.articles);
  const rangePublished = num((rangePublishedArticles as { articles?: number } | null)?.articles);
  const rangeVisitors = num((rangeTotals as { visitors?: number } | null)?.visitors);
  const returning = num((returningVisitors as { visitors?: number } | null)?.visitors);

  return json({
    ok: true,
    days,
    since,
    generatedAt: new Date().toISOString(),
    totals: {
      views: totalViews,
      visitors: num((totals as { visitors?: number } | null)?.visitors),
      articles: num((totals as { articles?: number } | null)?.articles),
      firstViewedAt: clean((totals as { first_viewed_at?: string } | null)?.first_viewed_at, 80),
      lastViewedAt: clean((totals as { last_viewed_at?: string } | null)?.last_viewed_at, 80),
      viewsWithoutLeadingVisitor: Math.max(0, totalViews - leadingVisitorViews),
      leadingVisitorShare: pct(leadingVisitorViews, totalViews),
    },
    range: {
      views: rangeViews,
      visitors: rangeVisitors,
      articles: num((rangeTotals as { articles?: number } | null)?.articles),
      publishedArticles: rangePublished,
      firstViewedAt: clean((rangeTotals as { first_viewed_at?: string } | null)?.first_viewed_at, 80),
      lastViewedAt: clean((rangeTotals as { last_viewed_at?: string } | null)?.last_viewed_at, 80),
      viewsPerArticle: rangePublished > 0 ? Number((rangeViews / rangePublished).toFixed(2)) : 0,
      pagesPerVisitor: rangeVisitors > 0 ? Number((rangeViews / rangeVisitors).toFixed(2)) : 0,
      returningVisitors: returning,
      returnRate: pct(returning, rangeVisitors),
      previousViews,
      growth: previousViews > 0 ? Number((((rangeViews - previousViews) / previousViews) * 100).toFixed(1)) : null,
      internalCtr: null,
    },
    content: {
      publishedArticles: totalPublished,
      viewsPerArticle: totalPublished > 0 ? Number((totalViews / totalPublished).toFixed(2)) : 0,
    },
    hourly: ((hourly.results || []) as Array<{ hour?: string; views?: number; visitors?: number }>).map((row) => ({
      hour: clean(row.hour, 4),
      views: num(row.views),
      visitors: num(row.visitors),
    })),
    daily: ((daily.results || []) as Array<{ day?: string; views?: number; visitors?: number; articles?: number }>).map((row) => ({
      day: clean(row.day, 20),
      views: num(row.views),
      visitors: num(row.visitors),
      articles: num(row.articles),
    })),
    categories: ((categories.results || []) as Array<{ category?: string; views?: number; visitors?: number; articles?: number }>).map((row) => ({
      category: clean(row.category || 'Sem categoria', 80),
      views: num(row.views),
      visitors: num(row.visitors),
      articles: num(row.articles),
      share: pct(num(row.views), rangeViews),
      viewsPerArticle: num(row.articles) > 0 ? Number((num(row.views) / num(row.articles)).toFixed(2)) : 0,
    })),
    topArticles: ((topArticles.results || []) as Array<{ title?: string; category?: string; slug?: string; views?: number; last_viewed_at?: string }>).map(
      (row) => ({
        title: clean(row.title, 240),
        category: clean(row.category || 'Sem categoria', 80),
        slug: clean(row.slug, 180),
        views: num(row.views),
        lastViewedAt: clean(row.last_viewed_at, 80),
      }),
    ),
    topVisitors: ((visitors.results || []) as Array<{ views?: number; articles?: number; first_seen?: string; last_seen?: string }>).map((row, index) => ({
      visitorId: index === 0 ? 'maior visitante' : `visitante ${index + 1}`,
      views: num(row.views),
      articles: num(row.articles),
      firstSeen: clean(row.first_seen, 80),
      lastSeen: clean(row.last_seen, 80),
      share: pct(num(row.views), totalViews),
    })),
  });
};
