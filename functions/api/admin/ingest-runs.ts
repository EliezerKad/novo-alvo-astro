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

type IngestRunPayload = {
  id?: string;
  status?: string;
  itemsTotal?: number;
  topicClusters?: number;
  radarClusters?: number;
  selectedPitches?: number;
  savedPitches?: number;
  skippedPitches?: number;
  feedCounts?: Record<string, number>;
  notes?: string;
  startedAt?: string;
  finishedAt?: string;
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

const number = (value: unknown, max = 100000) => Math.max(0, Math.min(max, Number(value || 0)));

const requireAdmin = (request: Request, env: Env) => {
  if (!env.ADMIN_TOKEN) return json({ error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-admin-token') || '';
  if (token !== env.ADMIN_TOKEN) return json({ error: 'Token editorial invalido.' }, { status: 401 });
  return null;
};

const normalizeRun = (payload: IngestRunPayload) => {
  const now = new Date().toISOString();
  const status = ['success', 'partial', 'error'].includes(clean(payload.status, 24)) ? clean(payload.status, 24) : 'success';
  const feedCounts = payload.feedCounts && typeof payload.feedCounts === 'object' ? payload.feedCounts : {};

  return {
    id: clean(payload.id, 120) || `ingest:${now}:${crypto.randomUUID()}`,
    status,
    itemsTotal: number(payload.itemsTotal),
    topicClusters: number(payload.topicClusters),
    radarClusters: number(payload.radarClusters),
    selectedPitches: number(payload.selectedPitches),
    savedPitches: number(payload.savedPitches),
    skippedPitches: number(payload.skippedPitches),
    feedCounts: JSON.stringify(feedCounts),
    notes: clean(payload.notes, 900),
    startedAt: clean(payload.startedAt, 40) || now,
    finishedAt: clean(payload.finishedAt, 40) || now,
  };
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = env.EDITORIAL_DB;
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  try {
    const result = await db
      .prepare(
        `SELECT *
         FROM ingest_runs
         ORDER BY finished_at DESC
         LIMIT 12`,
      )
      .bind()
      .all();

    return json({ ok: true, configured: true, runs: result.results || [] });
  } catch {
    return json({
      ok: true,
      configured: false,
      runs: [],
      warning: 'Historico de ingestao ainda nao ativado. Rode migrations/0004_ingest_runs.sql no D1.',
    });
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = env.EDITORIAL_DB;
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  let rawPayload: IngestRunPayload;
  try {
    rawPayload = await request.json();
  } catch {
    return json({ error: 'JSON invalido.' }, { status: 400 });
  }

  const run = normalizeRun(rawPayload);

  try {
    await db
      .prepare(
        `INSERT INTO ingest_runs (
          id, status, items_total, topic_clusters, radar_clusters, selected_pitches,
          saved_pitches, skipped_pitches, feed_counts, notes, started_at, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          items_total = excluded.items_total,
          topic_clusters = excluded.topic_clusters,
          radar_clusters = excluded.radar_clusters,
          selected_pitches = excluded.selected_pitches,
          saved_pitches = excluded.saved_pitches,
          skipped_pitches = excluded.skipped_pitches,
          feed_counts = excluded.feed_counts,
          notes = excluded.notes,
          finished_at = excluded.finished_at`,
      )
      .bind(
        run.id,
        run.status,
        run.itemsTotal,
        run.topicClusters,
        run.radarClusters,
        run.selectedPitches,
        run.savedPitches,
        run.skippedPitches,
        run.feedCounts,
        run.notes,
        run.startedAt,
        run.finishedAt,
      )
      .run();

    return json({ ok: true, run: { id: run.id, status: run.status } });
  } catch {
    return json({ ok: false, error: 'Tabela ingest_runs nao encontrada. Rode migrations/0004_ingest_runs.sql no D1.' }, { status: 503 });
  }
};
