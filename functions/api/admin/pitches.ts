type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      all: <T = unknown>() => Promise<{ results?: T[] }>;
      run: () => Promise<unknown>;
    };
  };
};

type Env = {
  EDITORIAL_DB?: D1Database;
  ADMIN_TOKEN?: string;
};

type PitchPayload = {
  id?: string;
  clusterKey?: string;
  title?: string;
  summary?: string;
  category?: string;
  status?: string;
  sourceCount?: number;
  primaryUrl?: string;
  sources?: unknown[];
  tags?: unknown[];
  keywords?: string;
  internalLinks?: unknown[];
  imageCandidates?: unknown[];
  score?: number;
  expiresAt?: string;
};

type PitchRecord = {
  id: string;
  category: string;
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

const asJson = (value: unknown) => JSON.stringify(Array.isArray(value) ? value : []);

const requireAdmin = (request: Request, env: Env) => {
  if (!env.ADMIN_TOKEN) return json({ error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-admin-token') || '';
  if (token !== env.ADMIN_TOKEN) return json({ error: 'Token editorial invalido.' }, { status: 401 });
  return null;
};

const getDb = (env: Env) => env.EDITORIAL_DB;

const normalizePitch = (payload: PitchPayload) => {
  const title = clean(payload.title, 240);
  const clusterKey = clean(payload.clusterKey, 180) || slugify(title);
  const now = new Date().toISOString();
  const status = ['new', 'reviewed', 'queued', 'dismissed', 'converted'].includes(clean(payload.status, 24))
    ? clean(payload.status, 24)
    : 'new';

  return {
    id: clean(payload.id, 120) || `pitch:${clusterKey || crypto.randomUUID()}`,
    clusterKey: clusterKey || crypto.randomUUID(),
    title: title || 'Pauta sem titulo',
    summary: clean(payload.summary, 900),
    category: clean(payload.category, 80) || 'Brasil',
    status,
    sourceCount: Math.max(0, Math.min(100, Number(payload.sourceCount || 0))),
    primaryUrl: clean(payload.primaryUrl, 900),
    sources: asJson(payload.sources),
    tags: asJson(payload.tags),
    keywords: clean(payload.keywords, 700),
    internalLinks: asJson(payload.internalLinks),
    imageCandidates: asJson(payload.imageCandidates),
    score: Math.max(0, Math.min(1000, Number(payload.score || 0))),
    expiresAt: clean(payload.expiresAt, 40),
    updatedAt: now,
  };
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  const url = new URL(request.url);
  const status = clean(url.searchParams.get('status'), 24);
  const category = clean(url.searchParams.get('category'), 80);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 50)));
  const minSources = Math.max(1, Math.min(20, Number(url.searchParams.get('minSources') || 8)));

  let result;
  if (status && category) {
    result = await db
      .prepare(
        `SELECT * FROM editorial_pitches
         WHERE status = ? AND category = ? AND source_count >= ?
         ORDER BY score DESC, updated_at DESC
         LIMIT ?`,
      )
      .bind(status, category, minSources, limit)
      .all();
  } else if (status) {
    result = await db
      .prepare(
        `SELECT * FROM editorial_pitches
         WHERE status = ? AND source_count >= ?
         ORDER BY score DESC, updated_at DESC
         LIMIT ?`,
      )
      .bind(status, minSources, limit)
      .all();
  } else {
    result = await db
      .prepare(
        `SELECT * FROM editorial_pitches
         WHERE source_count >= ?
         ORDER BY score DESC, updated_at DESC
         LIMIT ?`,
      )
      .bind(minSources, limit)
      .all();
  }

  return json({ pitches: result.results || [] });
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  let rawPayload: PitchPayload;
  try {
    rawPayload = await request.json();
  } catch {
    return json({ error: 'JSON invalido.' }, { status: 400 });
  }

  const pitch = normalizePitch(rawPayload);
  await db
    .prepare(
      `INSERT INTO editorial_pitches (
        id, cluster_key, title, summary, category, status, source_count, primary_url,
        sources, tags, keywords, internal_links, image_candidates, score, expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cluster_key) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        category = excluded.category,
        source_count = excluded.source_count,
        primary_url = excluded.primary_url,
        sources = excluded.sources,
        tags = excluded.tags,
        keywords = excluded.keywords,
        internal_links = excluded.internal_links,
        image_candidates = excluded.image_candidates,
        score = excluded.score,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      pitch.id,
      pitch.clusterKey,
      pitch.title,
      pitch.summary,
      pitch.category,
      pitch.status,
      pitch.sourceCount,
      pitch.primaryUrl,
      pitch.sources,
      pitch.tags,
      pitch.keywords,
      pitch.internalLinks,
      pitch.imageCandidates,
      pitch.score,
      pitch.expiresAt,
      pitch.updatedAt,
    )
    .run();

  return json({ ok: true, pitch: { id: pitch.id, clusterKey: pitch.clusterKey, status: pitch.status } });
};

export const onRequestPatch = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  let payload: { id?: string; clusterKey?: string; status?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON invalido.' }, { status: 400 });
  }

  const id = clean(payload.id, 120);
  const clusterKey = clean(payload.clusterKey, 180);
  const status = clean(payload.status, 24);
  if (!id && !clusterKey) return json({ error: 'ID ausente.' }, { status: 400 });
  if (!['new', 'reviewed', 'queued', 'dismissed', 'converted'].includes(status)) {
    return json({ error: 'Status invalido.' }, { status: 400 });
  }

  const lookupKey = clusterKey || id;
  const existing = await db
    .prepare('SELECT id, category FROM editorial_pitches WHERE id = ? OR cluster_key = ? LIMIT 1')
    .bind(id || lookupKey, lookupKey)
    .first<PitchRecord>();

  if (!existing) {
    if (status === 'dismissed') return json({ ok: true, alreadyRemoved: true, queue: null });
    return json({ error: 'Pauta nao encontrada.' }, { status: 404 });
  }

  await db
    .prepare('UPDATE editorial_pitches SET status = ?, updated_at = ? WHERE id = ? OR cluster_key = ?')
    .bind(status, new Date().toISOString(), existing.id, lookupKey)
    .run();

  let queue = null;
  if (status === 'queued') {
    const queueId = `queue:${existing.id}`;
    const gapMinutes = 40 + Math.floor(Math.random() * 51);
    const category = existing.category || 'Brasil';
    const lastQueued = await db
      .prepare(
        `SELECT publish_after FROM editorial_queue
         WHERE category = ? AND status = 'queued'
         ORDER BY publish_after DESC
         LIMIT 1`,
      )
      .bind(category)
      .first<{ publish_after?: string }>();
    const lastArticle = await db
      .prepare(
        `SELECT published_at FROM articles
         WHERE category = ? AND COALESCE(NULLIF(published_at, ''), '') != ''
         ORDER BY published_at DESC
         LIMIT 1`,
      )
      .bind(category)
      .first<{ published_at?: string }>();
    const baseTime = Math.max(
      Date.now(),
      lastQueued?.publish_after ? Date.parse(lastQueued.publish_after) || 0 : 0,
      lastArticle?.published_at ? Date.parse(lastArticle.published_at) || 0 : 0,
    );
    const publishAfter = new Date(baseTime + gapMinutes * 60 * 1000).toISOString();

    await db
      .prepare(
        `INSERT INTO editorial_queue (id, pitch_id, category, status, publish_after, updated_at)
         VALUES (?, ?, ?, 'queued', ?, ?)
         ON CONFLICT(pitch_id) DO UPDATE SET
           category = excluded.category,
           status = 'queued',
           publish_after = excluded.publish_after,
           error = '',
           updated_at = excluded.updated_at`,
      )
      .bind(queueId, existing.id, category, publishAfter, new Date().toISOString())
      .run();
    queue = { id: queueId, publishAfter, gapMinutes };
  }

  return json({ ok: true, queue });
};

export const onRequestDelete = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  const url = new URL(request.url);
  const olderThanDays = Math.max(1, Math.min(180, Number(url.searchParams.get('olderThanDays') || 30)));
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare(
      `DELETE FROM editorial_pitches
       WHERE (status IN ('dismissed', 'converted') AND updated_at < ?)
          OR (expires_at IS NOT NULL AND expires_at != '' AND expires_at < ?)`,
    )
    .bind(cutoff, new Date().toISOString())
    .run();

  return json({ ok: true, cutoff });
};
