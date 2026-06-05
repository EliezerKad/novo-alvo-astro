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
  discoverScore?: number;
  expiresAt?: string;
  forceUpdate?: boolean;
  bypassMemory?: boolean;
};

type PitchRecord = {
  id: string;
  cluster_key?: string;
  category?: string;
  status?: string;
  title?: string;
  summary?: string;
  tags?: string;
  keywords?: string;
  updated_at?: string;
  image_candidates?: string;
  source_count?: number;
  score?: number;
  discover_score?: number;
};

type MemoryRecord = {
  id: string;
  subject_key: string;
  category: string;
  title: string;
  status: string;
  source_count?: number;
  strength?: number;
  last_pitch_id?: string;
  last_seen_at?: string;
  expires_at?: string;
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

const parseArray = (value: unknown) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const imageUrl = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return clean(value, 1200);
  if (typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return clean(record.url || record.src, 1200);
};

const imageKey = (value: unknown) => {
  try {
    const url = new URL(clean(value, 1200));
    return `${url.hostname}${url.pathname}`.toLowerCase().replace(/\/+/g, '/');
  } catch {
    return clean(value, 1200).toLowerCase().split('?')[0];
  }
};

const normalizeImageCandidates = (values: unknown[]) => {
  const seen = new Set<string>();
  const output: Record<string, unknown>[] = [];
  for (const value of values) {
    const url = imageUrl(value);
    if (!/^https:\/\//i.test(url)) continue;
    const key = imageKey(url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(typeof value === 'object' && value ? { ...(value as Record<string, unknown>), url } : { url });
  }
  return output;
};

const mergePreservedImageRoles = (incomingJson: string, existingJson: string) => {
  const incoming = normalizeImageCandidates(parseArray(incomingJson));
  const existing = normalizeImageCandidates(parseArray(existingJson));
  const roleByKey = new Map<string, string>();
  for (const candidate of existing) {
    const role = clean(candidate.role, 24);
    if (!role) continue;
    roleByKey.set(imageKey(candidate.url), role);
  }
  const merged = incoming.map((candidate) => {
    const role = roleByKey.get(imageKey(candidate.url));
    return role ? { ...candidate, role } : candidate;
  });
  for (const candidate of existing) {
    const key = imageKey(candidate.url);
    if (roleByKey.has(key) && !merged.some((item) => imageKey(item.url) === key)) merged.unshift(candidate);
  }
  return JSON.stringify(merged.slice(0, 24));
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
  return clean(value, 1200)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3 && !blocked.has(token));
};

const recordText = (record: Partial<PitchRecord>) =>
  `${record.category || ''} ${record.title || ''} ${record.summary || ''} ${parseArray(record.tags).join(' ')} ${record.keywords || ''}`;

const semanticOverlap = (left: unknown, right: unknown) => {
  const leftTokens = new Set(editorialTokens(left).slice(0, 14));
  const rightTokens = new Set(editorialTokens(right).slice(0, 14));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  return shared / Math.min(leftTokens.size, rightTokens.size);
};

const missingMemoryTable = (error: unknown) =>
  String(error instanceof Error ? error.message : error).toLowerCase().includes('no such table: editorial_memory');

const memorySubjectKey = (pitch: Pick<ReturnType<typeof normalizePitch>, 'category' | 'clusterKey' | 'title' | 'summary' | 'tags' | 'keywords'>) => {
  const category = slugify(pitch.category) || 'geral';
  const tokens = editorialTokens(`${pitch.title} ${parseArray(pitch.tags).join(' ')} ${pitch.keywords} ${pitch.summary}`)
    .filter((token, index, values) => values.indexOf(token) === index)
    .slice(0, 9);
  return `${category}:${tokens.length >= 3 ? tokens.join('-') : slugify(pitch.clusterKey)}`;
};

const readMemory = async (db: D1Database, subjectKey: string) => {
  try {
    return await db
      .prepare('SELECT * FROM editorial_memory WHERE subject_key = ? LIMIT 1')
      .bind(subjectKey)
      .first<MemoryRecord>();
  } catch (error) {
    if (missingMemoryTable(error)) return null;
    throw error;
  }
};

const rememberPitch = async (
  db: D1Database,
  pitch: Pick<ReturnType<typeof normalizePitch>, 'id' | 'clusterKey' | 'title' | 'summary' | 'category' | 'tags' | 'keywords' | 'sourceCount' | 'score'>,
  status = 'seen',
  expiresAt = '',
  articleSlug = '',
) => {
  const subjectKey = memorySubjectKey(pitch);
  const now = new Date().toISOString();
  const metadata = JSON.stringify({ clusterKey: pitch.clusterKey, keywords: pitch.keywords });
  try {
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
          status = excluded.status,
          source_count = MAX(editorial_memory.source_count, excluded.source_count),
          strength = MAX(editorial_memory.strength, excluded.strength),
          last_seen_at = excluded.last_seen_at,
          last_pitch_id = excluded.last_pitch_id,
          article_slug = CASE WHEN excluded.article_slug != '' THEN excluded.article_slug ELSE editorial_memory.article_slug END,
          metadata = excluded.metadata,
          expires_at = excluded.expires_at`,
      )
      .bind(
        `memory:${subjectKey}`,
        subjectKey,
        pitch.category,
        pitch.title,
        status,
        pitch.sourceCount,
        pitch.score,
        now,
        now,
        pitch.id,
        articleSlug,
        metadata,
        expiresAt,
      )
      .run();
  } catch (error) {
    if (!missingMemoryTable(error)) throw error;
  }
};

const rememberExistingPitch = async (db: D1Database, record: PitchRecord, status: string, expiresAt = '') => {
  if (!record.id || !record.title) return;
  await rememberPitch(
    db,
    {
      id: record.id,
      clusterKey: record.cluster_key || record.id,
      title: record.title,
      summary: '',
      category: record.category || 'Brasil',
      tags: record.tags || '[]',
      keywords: record.keywords || '',
      sourceCount: Number(record.source_count || 0),
      score: Number(record.score || 0),
    },
    status,
    expiresAt,
  );
};

const findRecentDuplicate = async (db: D1Database, pitch: ReturnType<typeof normalizePitch>) => {
  const now = new Date().toISOString();
  const recent = await db
    .prepare(
      `SELECT id, cluster_key, title, summary, category, status, tags, keywords, updated_at
       FROM editorial_pitches
       WHERE category = ?
         AND (expires_at IS NULL OR expires_at = '' OR expires_at >= ? OR status IN ('dismissed', 'queued', 'converted'))
       ORDER BY updated_at DESC
       LIMIT 160`,
    )
    .bind(pitch.category, now)
    .all<PitchRecord & { cluster_key?: string }>();

  const incomingText = `${pitch.category} ${pitch.title} ${pitch.summary} ${parseArray(pitch.tags).join(' ')} ${pitch.keywords}`;
  return (recent.results || []).find((record) => {
    if (record.cluster_key === pitch.clusterKey) return false;
    const score = semanticOverlap(incomingText, recordText(record));
    if (record.status === 'dismissed') return score >= 0.55;
    if (['queued', 'converted', 'published', 'reviewed'].includes(clean(record.status, 24))) return score >= 0.58;
    return score >= 0.66;
  });
};

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
    discoverScore: Math.max(0, Math.min(600, Number(payload.discoverScore || 0))),
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
           AND (expires_at IS NULL OR expires_at = '' OR expires_at >= ? OR status IN ('queued', 'converted'))
         ORDER BY score DESC, updated_at DESC
         LIMIT ?`,
      )
      .bind(status, category, minSources, new Date().toISOString(), limit)
      .all();
  } else if (status) {
    result = await db
      .prepare(
        `SELECT * FROM editorial_pitches
         WHERE status = ? AND source_count >= ?
           AND (expires_at IS NULL OR expires_at = '' OR expires_at >= ? OR status IN ('queued', 'converted'))
         ORDER BY score DESC, updated_at DESC
         LIMIT ?`,
      )
      .bind(status, minSources, new Date().toISOString(), limit)
      .all();
  } else {
    result = await db
      .prepare(
        `SELECT * FROM editorial_pitches
         WHERE source_count >= ?
           AND status != 'dismissed'
           AND (expires_at IS NULL OR expires_at = '' OR expires_at >= ? OR status IN ('queued', 'converted'))
         ORDER BY score DESC, updated_at DESC
         LIMIT ?`,
      )
      .bind(minSources, new Date().toISOString(), limit)
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
  const forceUpdate = rawPayload.forceUpdate === true;
  const bypassMemory = rawPayload.bypassMemory === true;
  const subjectKey = memorySubjectKey(pitch);
  const remembered = await readMemory(db, subjectKey);
  const memoryExpiresAt = remembered?.expires_at ? Date.parse(remembered.expires_at) : 0;
  const memoryExpired = Boolean(memoryExpiresAt && memoryExpiresAt < Date.now());
  const sameRememberedPitch = Boolean(forceUpdate && remembered?.last_pitch_id === pitch.id);
  if (remembered && !memoryExpired && !sameRememberedPitch && !bypassMemory) {
    if (remembered.status === 'dismissed') {
      return json({
        ok: true,
        skipped: true,
        reason: 'Assunto descartado pela memoria editorial.',
        pitch: { id: remembered.last_pitch_id || pitch.id, clusterKey: pitch.clusterKey, status: remembered.status },
      });
    }
    if (['queued', 'converted', 'published'].includes(remembered.status)) {
      return json({
        ok: true,
        skipped: true,
        reason: 'Assunto ja esta em fila ou ja virou materia.',
        pitch: { id: remembered.last_pitch_id || pitch.id, clusterKey: pitch.clusterKey, status: remembered.status },
      });
    }
    const lastSeen = remembered.last_seen_at ? Date.parse(remembered.last_seen_at) : 0;
    const freshMemory = lastSeen && Date.now() - lastSeen < 24 * 60 * 60 * 1000;
    const strongerDevelopment = pitch.sourceCount >= Number(remembered.source_count || 0) + 4 || pitch.score >= Number(remembered.strength || 0) + 45;
    if (freshMemory && !strongerDevelopment) {
      return json({
        ok: true,
        skipped: true,
        reason: 'Assunto recente ja memorizado.',
        pitch: { id: remembered.last_pitch_id || pitch.id, clusterKey: pitch.clusterKey, status: remembered.status },
      });
    }
  }

  const existing = await db
    .prepare('SELECT id, status, source_count, score, image_candidates FROM editorial_pitches WHERE cluster_key = ? LIMIT 1')
    .bind(pitch.clusterKey)
    .first<PitchRecord>();

  if (existing?.status === 'dismissed' && !bypassMemory) {
    return json({ ok: true, skipped: true, reason: 'Pauta descartada preservada.', pitch: { id: existing.id, clusterKey: pitch.clusterKey, status: existing.status } });
  }

  if (!existing && !bypassMemory) {
    const duplicate = await findRecentDuplicate(db, pitch);
    if (duplicate?.status === 'dismissed') {
      return json({
        ok: true,
        skipped: true,
        reason: 'Assunto descartado recentemente preservado.',
        pitch: { id: duplicate.id, clusterKey: pitch.clusterKey, status: duplicate.status },
      });
    }
    if (duplicate) {
      return json({
        ok: true,
        skipped: true,
        reason: 'Assunto recente ja existe no banco editorial.',
        pitch: { id: duplicate.id, clusterKey: pitch.clusterKey, status: duplicate.status },
      });
    }
  }

  if (existing?.image_candidates) {
    pitch.imageCandidates = mergePreservedImageRoles(pitch.imageCandidates, existing.image_candidates);
  }

  const shouldReopenReviewed =
    existing?.status === 'reviewed' &&
    (pitch.sourceCount >= Number(existing.source_count || 0) + 4 || pitch.score >= Number(existing.score || 0) + 45);

  await db
    .prepare(
      `INSERT INTO editorial_pitches (
        id, cluster_key, title, summary, category, status, source_count, primary_url,
        sources, tags, keywords, internal_links, image_candidates, score, discover_score, expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        status = CASE
          WHEN editorial_pitches.status = 'reviewed' AND ? = 1
          THEN 'new'
          ELSE editorial_pitches.status
        END,
        score = excluded.score,
        discover_score = excluded.discover_score,
        expires_at = excluded.expires_at,
        updated_at = CASE
          WHEN excluded.source_count > editorial_pitches.source_count OR excluded.score > editorial_pitches.score
          THEN excluded.updated_at
          ELSE editorial_pitches.updated_at
        END`,
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
      pitch.discoverScore,
      pitch.expiresAt,
      pitch.updatedAt,
      shouldReopenReviewed ? 1 : 0,
    )
      .run();

  await rememberPitch(db, pitch, remembered ? 'developing' : 'seen', pitch.expiresAt);

  const stored = await db
    .prepare('SELECT id, status, source_count, score, discover_score FROM editorial_pitches WHERE cluster_key = ? LIMIT 1')
    .bind(pitch.clusterKey)
    .first<PitchRecord>();

  return json({
    ok: true,
    pitch: {
      id: stored?.id || pitch.id,
      clusterKey: pitch.clusterKey,
      status: stored?.status || pitch.status,
      sourceCount: Number(stored?.source_count || pitch.sourceCount || 0),
      score: Number(stored?.score || pitch.score || 0),
      discoverScore: Number(stored?.discover_score || pitch.discoverScore || 0),
      visibleAsNew: (stored?.status || pitch.status) === 'new' && Number(stored?.source_count || pitch.sourceCount || 0) >= 5,
    },
  });
};

const dismissMany = async (db: D1Database, payload: { currentStatus?: string; category?: string; minSources?: number }) => {
  const currentStatus = clean(payload.currentStatus, 24) || 'new';
  const category = clean(payload.category, 80);
  const minSources = Math.max(1, Math.min(20, Number(payload.minSources || 8)));
  const now = new Date().toISOString();
  const tombstoneExpiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

  if (!['new', 'reviewed'].includes(currentStatus)) {
    return { error: 'Descarte em massa permitido apenas para pautas novas ou revisadas.', status: 400 };
  }

  if (category) {
    const targets = await db
      .prepare(
        `SELECT id, cluster_key, title, category, source_count, score, tags, keywords
         FROM editorial_pitches
         WHERE status = ? AND category = ? AND source_count >= ?
           AND (expires_at IS NULL OR expires_at = '' OR expires_at >= ?)
         ORDER BY updated_at DESC
         LIMIT 120`,
      )
      .bind(currentStatus, category, minSources, now)
      .all<PitchRecord>();
    const result = await db
      .prepare(
        `UPDATE editorial_pitches
         SET status = 'dismissed', expires_at = ?, updated_at = ?
         WHERE status = ? AND category = ? AND source_count >= ?
           AND (expires_at IS NULL OR expires_at = '' OR expires_at >= ?)`,
      )
      .bind(tombstoneExpiresAt, now, currentStatus, category, minSources, now)
      .run();
    await Promise.all((targets.results || []).map((record) => rememberExistingPitch(db, record, 'dismissed', tombstoneExpiresAt)));
    return { ok: true, dismissed: (result as { meta?: { changes?: number } })?.meta?.changes || 0 };
  }

  const targets = await db
    .prepare(
      `SELECT id, cluster_key, title, category, source_count, score, tags, keywords
       FROM editorial_pitches
       WHERE status = ? AND source_count >= ?
         AND (expires_at IS NULL OR expires_at = '' OR expires_at >= ?)
       ORDER BY updated_at DESC
       LIMIT 160`,
    )
    .bind(currentStatus, minSources, now)
    .all<PitchRecord>();
  const result = await db
    .prepare(
      `UPDATE editorial_pitches
       SET status = 'dismissed', expires_at = ?, updated_at = ?
       WHERE status = ? AND source_count >= ?
         AND (expires_at IS NULL OR expires_at = '' OR expires_at >= ?)`,
    )
    .bind(tombstoneExpiresAt, now, currentStatus, minSources, now)
    .run();
  await Promise.all((targets.results || []).map((record) => rememberExistingPitch(db, record, 'dismissed', tombstoneExpiresAt)));
  return { ok: true, dismissed: (result as { meta?: { changes?: number } })?.meta?.changes || 0 };
};

export const onRequestPatch = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  let payload: {
    id?: string;
    clusterKey?: string;
    status?: string;
    all?: boolean;
    currentStatus?: string;
    category?: string;
    minSources?: number;
    imageUrl?: string;
    imageRole?: string;
    draftArticleId?: string;
    articleId?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON invalido.' }, { status: 400 });
  }

  if (payload.all && clean(payload.status, 24) === 'dismissed') {
    const result = await dismissMany(db, payload);
    if ('error' in result) return json({ error: result.error }, { status: result.status });
    return json(result);
  }

  const id = clean(payload.id, 120);
  const clusterKey = clean(payload.clusterKey, 180);
  const status = clean(payload.status, 24);
  const requestedCategory = clean(payload.category, 80);
  const draftArticleId = clean(payload.draftArticleId || payload.articleId, 120);
  const imageRole = clean(payload.imageRole, 24);
  const selectedImageUrl = clean(payload.imageUrl, 1200);
  if (!id && !clusterKey) return json({ error: 'ID ausente.' }, { status: 400 });
  if (imageRole) {
    if (!['cover', 'body', 'ignored', 'clear'].includes(imageRole)) return json({ error: 'Papel de imagem invalido.' }, { status: 400 });
  } else if (!['new', 'reviewed', 'queued', 'dismissed', 'converted'].includes(status)) {
    return json({ error: 'Status invalido.' }, { status: 400 });
  }

  const lookupKey = clusterKey || id;
  const existing = await db
    .prepare('SELECT id, cluster_key, title, category, source_count, score, tags, keywords, image_candidates FROM editorial_pitches WHERE id = ? OR cluster_key = ? LIMIT 1')
    .bind(id || lookupKey, lookupKey)
    .first<PitchRecord>();

  if (!existing) {
    if (status === 'dismissed') return json({ ok: true, alreadyRemoved: true, queue: null });
    return json({ error: 'Pauta nao encontrada.' }, { status: 404 });
  }

  const now = new Date().toISOString();
  if (imageRole) {
    const candidates = normalizeImageCandidates(parseArray(existing.image_candidates));
    const selectedKey = imageKey(selectedImageUrl);
    const nextCandidates = candidates.map((candidate) => {
      const key = imageKey(candidate.url);
      if (imageRole === 'clear') return { ...candidate, role: clean(candidate.role, 24) === 'ignored' ? 'ignored' : '' };
      if (key === selectedKey) return { ...candidate, role: imageRole };
      if (imageRole === 'cover' && clean(candidate.role, 24) === 'cover') return { ...candidate, role: '' };
      return candidate;
    });
    if (selectedImageUrl && !nextCandidates.some((candidate) => imageKey(candidate.url) === selectedKey)) {
      nextCandidates.unshift({ url: selectedImageUrl, role: imageRole });
    }
    await db
      .prepare('UPDATE editorial_pitches SET image_candidates = ?, updated_at = ? WHERE id = ? OR cluster_key = ?')
      .bind(JSON.stringify(nextCandidates), now, existing.id, lookupKey)
      .run();
    return json({ ok: true, imageCandidates: nextCandidates });
  }

  const nextCategory = requestedCategory || existing.category || 'Brasil';
  const existingForMemory = { ...existing, category: nextCategory };
  const tombstoneExpiresAt = status === 'dismissed' ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString() : '';
  if (status === 'dismissed') {
    await db
      .prepare('UPDATE editorial_pitches SET status = ?, category = ?, expires_at = ?, updated_at = ? WHERE id = ? OR cluster_key = ?')
      .bind(status, nextCategory, tombstoneExpiresAt, now, existing.id, lookupKey)
      .run();
    await rememberExistingPitch(db, existingForMemory, status, tombstoneExpiresAt);
  } else {
    await db
      .prepare('UPDATE editorial_pitches SET status = ?, category = ?, updated_at = ? WHERE id = ? OR cluster_key = ?')
      .bind(status, nextCategory, now, existing.id, lookupKey)
      .run();
    await rememberExistingPitch(db, existingForMemory, status);
  }

  let queue = null;
  if (status === 'queued') {
    const allowRawPitchQueue = String((env as { ALLOW_RAW_PITCH_QUEUE?: string }).ALLOW_RAW_PITCH_QUEUE || '').toLowerCase() === 'true';
    if (!draftArticleId && !allowRawPitchQueue) {
      await db
        .prepare('UPDATE editorial_pitches SET status = ?, category = ?, updated_at = ? WHERE id = ? OR cluster_key = ?')
        .bind('reviewed', nextCategory, now, existing.id, lookupKey)
        .run();
      await rememberExistingPitch(db, existingForMemory, 'reviewed');
      return json(
        {
          error: 'Pauta automatica precisa virar rascunho revisado antes de entrar na fila de publicacao.',
          ok: false,
          queue: null,
          status: 'reviewed',
        },
        { status: 409 },
      );
    }
    const queueId = `queue:${existing.id}`;
    const gapMinutes = 40 + Math.floor(Math.random() * 51);
    const category = nextCategory;
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
        `INSERT INTO editorial_queue (id, pitch_id, category, status, publish_after, draft_article_id, updated_at)
         VALUES (?, ?, ?, 'queued', ?, ?, ?)
         ON CONFLICT(pitch_id) DO UPDATE SET
           category = excluded.category,
           status = 'queued',
           publish_after = excluded.publish_after,
           draft_article_id = COALESCE(NULLIF(excluded.draft_article_id, ''), editorial_queue.draft_article_id),
           error = '',
           updated_at = excluded.updated_at`,
      )
      .bind(queueId, existing.id, category, publishAfter, draftArticleId, new Date().toISOString())
      .run();
    queue = { id: queueId, publishAfter, gapMinutes, draftArticleId };
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
       WHERE (status = 'converted' AND updated_at < ?)
          OR (status NOT IN ('dismissed', 'converted') AND expires_at IS NOT NULL AND expires_at != '' AND expires_at < ?)`,
    )
    .bind(cutoff, new Date().toISOString())
    .run();

  return json({ ok: true, cutoff });
};
