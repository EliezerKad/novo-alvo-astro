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

type MemorySource = {
  id: string;
  cluster_key?: string;
  slug?: string;
  title: string;
  summary?: string;
  category?: string;
  status?: string;
  source_count?: number;
  score?: number;
  tags?: string;
  keywords?: string;
  updated_at?: string;
  published_at?: string;
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

const slugify = (value: unknown) =>
  clean(value, 180)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

const parseArray = (value: unknown) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const editorialTokens = (value: unknown) => {
  const blocked = new Set([
    'para',
    'com',
    'uma',
    'das',
    'dos',
    'que',
    'por',
    'sobre',
    'apos',
    'entre',
    'como',
    'mais',
    'radar',
    'veja',
    'confira',
    'onde',
    'hoje',
    'noticia',
    'noticias',
  ]);
  return clean(value, 1400)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token, index, values) => token.length > 3 && !blocked.has(token) && values.indexOf(token) === index);
};

const subjectKeyFor = (record: MemorySource) => {
  const category = slugify(record.category || 'Brasil') || 'geral';
  const tags = parseArray(record.tags).join(' ');
  const tokens = editorialTokens(`${record.title} ${record.summary || ''} ${tags} ${record.keywords || ''}`).slice(0, 9);
  const fallback = slugify(record.cluster_key || record.slug || record.title || record.id);
  return `${category}:${tokens.length >= 3 ? tokens.join('-') : fallback}`;
};

const requireAdmin = (request: Request, env: Env) => {
  if (!env.ADMIN_TOKEN) return json({ error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-admin-token') || '';
  if (token !== env.ADMIN_TOKEN) return json({ error: 'Token editorial invalido.' }, { status: 401 });
  return null;
};

const remember = async (db: D1Database, record: MemorySource, status: string) => {
  const subjectKey = subjectKeyFor(record);
  const now = new Date().toISOString();
  const lastSeenAt = clean(record.updated_at || record.published_at || now, 40) || now;
  const articleSlug = status === 'published' ? clean(record.slug, 160) : '';
  const expiresAt =
    status === 'dismissed'
      ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
      : '';

  await db
    .prepare(
      `INSERT INTO editorial_memory (
        id, subject_key, category, title, status, source_count, strength,
        first_seen_at, last_seen_at, last_pitch_id, article_slug, metadata, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(subject_key) DO UPDATE SET
        category = excluded.category,
        title = CASE
          WHEN excluded.source_count >= editorial_memory.source_count OR excluded.strength >= editorial_memory.strength
          THEN excluded.title
          ELSE editorial_memory.title
        END,
        status = CASE
          WHEN editorial_memory.status = 'published' THEN editorial_memory.status
          WHEN excluded.status = 'published' THEN excluded.status
          WHEN editorial_memory.status = 'dismissed' THEN editorial_memory.status
          ELSE excluded.status
        END,
        source_count = MAX(editorial_memory.source_count, excluded.source_count),
        strength = MAX(editorial_memory.strength, excluded.strength),
        last_seen_at = excluded.last_seen_at,
        last_pitch_id = excluded.last_pitch_id,
        article_slug = CASE WHEN excluded.article_slug != '' THEN excluded.article_slug ELSE editorial_memory.article_slug END,
        metadata = excluded.metadata,
        expires_at = CASE WHEN excluded.expires_at != '' THEN excluded.expires_at ELSE editorial_memory.expires_at END`,
    )
    .bind(
      `memory:${subjectKey}`,
      subjectKey,
      clean(record.category, 80) || 'Brasil',
      clean(record.title, 240) || 'Pauta sem titulo',
      status,
      Number(record.source_count || 0),
      Number(record.score || 0),
      lastSeenAt,
      lastSeenAt,
      clean(record.id, 140),
      articleSlug,
      JSON.stringify({ clusterKey: record.cluster_key || '', slug: record.slug || '', keywords: record.keywords || '' }),
      expiresAt,
    )
    .run();
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = env.EDITORIAL_DB;
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  try {
    const result = await db
      .prepare(
        `SELECT status, category, COUNT(*) AS total
         FROM editorial_memory
         GROUP BY status, category
         ORDER BY status ASC, total DESC`,
      )
      .all();
    return json({ memory: result.results || [] });
  } catch (error) {
    return json({ error: 'Tabela editorial_memory nao encontrada. Rode migrations/0005_editorial_memory.sql no D1.' }, { status: 503 });
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = env.EDITORIAL_DB;
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  try {
    const pitches = await db
      .prepare(
        `SELECT id, cluster_key, title, summary, category, status, source_count, score, tags, keywords, updated_at
         FROM editorial_pitches
         WHERE status IN ('new', 'reviewed', 'queued', 'dismissed', 'converted')
         ORDER BY updated_at DESC
         LIMIT 700`,
      )
      .all<MemorySource>();

    const articles = await db
      .prepare(
        `SELECT id, slug, title, summary, category, status, tags, keywords, published_at, updated_at
         FROM articles
         WHERE status = 'published' OR COALESCE(NULLIF(published_at, ''), '') != ''
         ORDER BY COALESCE(NULLIF(published_at, ''), updated_at) DESC
         LIMIT 700`,
      )
      .all<MemorySource>();

    let pitchesBackfilled = 0;
    let articlesBackfilled = 0;

    for (const pitch of pitches.results || []) {
      await remember(db, pitch, pitch.status === 'converted' ? 'published' : clean(pitch.status, 24) || 'seen');
      pitchesBackfilled += 1;
    }

    for (const article of articles.results || []) {
      await remember(db, { ...article, source_count: 100, score: 1000 }, 'published');
      articlesBackfilled += 1;
    }

    return json({ ok: true, pitchesBackfilled, articlesBackfilled, total: pitchesBackfilled + articlesBackfilled });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida';
    if (message.toLowerCase().includes('no such table: editorial_memory')) {
      return json({ error: 'Tabela editorial_memory nao encontrada. Rode migrations/0005_editorial_memory.sql no D1.' }, { status: 503 });
    }
    return json({ error: message }, { status: 500 });
  }
};
