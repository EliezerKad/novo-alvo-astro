type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      all: <T = unknown>() => Promise<{ results?: T[] }>;
      run: () => Promise<unknown>;
    };
    all: <T = unknown>() => Promise<{ results?: T[] }>;
  };
};

type Env = {
  EDITORIAL_DB?: D1Database;
  ADMIN_TOKEN?: string;
};

type ArticlePayload = {
  id?: string;
  slug?: string;
  title?: string;
  summary?: string;
  bodyHtml?: string;
  category?: string;
  author?: string;
  status?: string;
  coverUrl?: string;
  coverAlt?: string;
  seoDescription?: string;
  keywords?: string;
  tags?: unknown[];
  sources?: unknown[];
  media?: unknown[];
  readingMinutes?: number;
  scheduledAt?: string;
  publishedAt?: string;
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

const uid = () => crypto.randomUUID();

const clean = (value: unknown, max = 2000) =>
  String(value || '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);

const slugify = (value: unknown) =>
  clean(value, 180)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

const asJson = (value: unknown) => JSON.stringify(Array.isArray(value) ? value : []);

const requireAdmin = (request: Request, env: Env) => {
  if (!env.ADMIN_TOKEN) {
    return json(
      {
        error:
          'ADMIN_TOKEN não configurado. Crie uma variável secreta ADMIN_TOKEN no Cloudflare Pages antes de usar o CMS.',
      },
      { status: 503 },
    );
  }

  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-admin-token') || '';
  if (token !== env.ADMIN_TOKEN) return json({ error: 'Token editorial inválido.' }, { status: 401 });
  return null;
};

const getDb = (env: Env) => env.EDITORIAL_DB;

const normalizePayload = (payload: ArticlePayload) => {
  const title = clean(payload.title, 220);
  const status = ['draft', 'scheduled', 'published'].includes(clean(payload.status, 24)) ? clean(payload.status, 24) : 'draft';
  const now = new Date().toISOString();
  return {
    id: clean(payload.id, 80) || uid(),
    slug: slugify(payload.slug || title || uid()),
    title: title || 'Matéria sem título',
    summary: clean(payload.summary, 700),
    bodyHtml: clean(payload.bodyHtml, 250000),
    category: clean(payload.category, 80) || 'Política',
    author: clean(payload.author, 120) || 'Redação Novo Alvo',
    status,
    coverUrl: clean(payload.coverUrl, 1200),
    coverAlt: clean(payload.coverAlt, 240),
    seoDescription: clean(payload.seoDescription, 220),
    keywords: clean(payload.keywords, 700),
    tags: asJson(payload.tags),
    sources: asJson(payload.sources),
    media: asJson(payload.media),
    readingMinutes: Math.max(0, Math.min(999, Number(payload.readingMinutes || 0))),
    scheduledAt: clean(payload.scheduledAt, 40),
    publishedAt: clean(payload.publishedAt, 40),
    updatedAt: now,
  };
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB não configurado.' }, { status: 503 });

  const url = new URL(request.url);
  const status = clean(url.searchParams.get('status'), 24);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 50)));

  const result = status
    ? await db
        .prepare(
          'SELECT id, slug, title, summary, category, author, status, cover_url, scheduled_at, published_at, created_at, updated_at FROM articles WHERE status = ? ORDER BY updated_at DESC LIMIT ?',
        )
        .bind(status, limit)
        .all()
    : await db
        .prepare(
          'SELECT id, slug, title, summary, category, author, status, cover_url, scheduled_at, published_at, created_at, updated_at FROM articles ORDER BY updated_at DESC LIMIT ?',
        )
        .bind(limit)
        .all();

  return json({ articles: result.results || [] });
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB não configurado.' }, { status: 503 });

  let rawPayload: ArticlePayload;
  try {
    rawPayload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const article = normalizePayload(rawPayload);
  const existing = await db.prepare('SELECT id FROM articles WHERE id = ? OR slug = ? LIMIT 1').bind(article.id, article.slug).first<{ id: string }>();
  const id = existing?.id || article.id;
  const publishedAt = article.status === 'published' ? article.publishedAt || article.updatedAt : article.publishedAt || '';

  await db
    .prepare(
      `INSERT INTO articles (
        id, slug, title, summary, body_html, category, author, status, cover_url, cover_alt,
        seo_description, keywords, tags, sources, media, reading_minutes, scheduled_at, published_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        title = excluded.title,
        summary = excluded.summary,
        body_html = excluded.body_html,
        category = excluded.category,
        author = excluded.author,
        status = excluded.status,
        cover_url = excluded.cover_url,
        cover_alt = excluded.cover_alt,
        seo_description = excluded.seo_description,
        keywords = excluded.keywords,
        tags = excluded.tags,
        sources = excluded.sources,
        media = excluded.media,
        reading_minutes = excluded.reading_minutes,
        scheduled_at = excluded.scheduled_at,
        published_at = excluded.published_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      article.slug,
      article.title,
      article.summary,
      article.bodyHtml,
      article.category,
      article.author,
      article.status,
      article.coverUrl,
      article.coverAlt,
      article.seoDescription,
      article.keywords,
      article.tags,
      article.sources,
      article.media,
      article.readingMinutes,
      article.scheduledAt,
      publishedAt,
      article.updatedAt,
    )
    .run();

  return json({
    ok: true,
    article: {
      id,
      slug: article.slug,
      status: article.status,
      updatedAt: article.updatedAt,
    },
  });
};
