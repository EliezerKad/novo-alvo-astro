type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      all: <T = unknown>() => Promise<{ results?: T[] }>;
      first: <T = unknown>() => Promise<T | null>;
      run: () => Promise<unknown>;
    };
  };
};

type Env = {
  EDITORIAL_DB?: D1Database;
  ADMIN_TOKEN?: string;
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

type ScheduledArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body_html: string;
  category: string;
  author: string;
  cover_url: string;
  cover_alt: string;
  seo_description: string;
  keywords: string;
  tags: string;
  sources: string;
  media: string;
  reading_minutes: number;
  scheduled_at: string;
};

const parseArray = (value: string) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const publishDueScheduled = async (request: Request, env: Env, now: string) => {
  const db = env.EDITORIAL_DB;
  if (!db || !env.ADMIN_TOKEN) return;

  const due = await db
    .prepare(
      `SELECT
        id, slug, title, summary, body_html, category, author, cover_url, cover_alt,
        seo_description, keywords, tags, sources, media, reading_minutes, scheduled_at
       FROM articles
       WHERE status = 'scheduled' AND scheduled_at <= ?
       ORDER BY scheduled_at ASC
       LIMIT 2`,
    )
    .bind(now)
    .all<ScheduledArticle>();

  const origin = new URL(request.url).origin;
  for (const article of due.results || []) {
    const response = await fetch(`${origin}/api/admin/articles`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.ADMIN_TOKEN}`,
      },
      body: JSON.stringify({
        id: article.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        bodyHtml: article.body_html,
        category: article.category,
        author: article.author,
        status: 'published',
        coverUrl: article.cover_url,
        coverAlt: article.cover_alt,
        seoDescription: article.seo_description,
        keywords: article.keywords,
        tags: parseArray(article.tags),
        sources: parseArray(article.sources),
        media: parseArray(article.media),
        readingMinutes: article.reading_minutes,
        scheduledAt: article.scheduled_at,
        publishedAt: now,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.staticPublish?.ok !== true) {
      await db
        .prepare("UPDATE articles SET status = 'scheduled', published_at = '', updated_at = ? WHERE id = ?")
        .bind(now, article.id)
        .run();
    }
  }
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const db = env.EDITORIAL_DB;
  if (!db) return json({ articles: [] });

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(30, Number(url.searchParams.get('limit') || 12)));
  const category = clean(url.searchParams.get('category'), 80);
  const now = new Date().toISOString();
  await publishDueScheduled(request, env, now).catch(() => {});
  const safeScheduledPublishedAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const query = category
    ? `SELECT id, slug, title, summary, category, author, status, cover_url, cover_alt, reading_minutes, scheduled_at, published_at, created_at, updated_at
       FROM articles
       WHERE category = ?
         AND status = 'published'
         AND (
           COALESCE(NULLIF(scheduled_at, ''), '') = ''
           OR COALESCE(NULLIF(published_at, ''), updated_at) <= ?
         )
       ORDER BY COALESCE(NULLIF(published_at, ''), scheduled_at, updated_at) DESC
       LIMIT ?`
    : `SELECT id, slug, title, summary, category, author, status, cover_url, cover_alt, reading_minutes, scheduled_at, published_at, created_at, updated_at
       FROM articles
       WHERE status = 'published'
         AND (
           COALESCE(NULLIF(scheduled_at, ''), '') = ''
           OR COALESCE(NULLIF(published_at, ''), updated_at) <= ?
         )
       ORDER BY COALESCE(NULLIF(published_at, ''), scheduled_at, updated_at) DESC
       LIMIT ?`;

  const result = category
    ? await db.prepare(query).bind(category, safeScheduledPublishedAt, limit).all()
    : await db.prepare(query).bind(safeScheduledPublishedAt, limit).all();

  return json({ articles: result.results || [] });
};
