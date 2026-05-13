import { MODEL, buildArticlePayload } from './queue';

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

type AiBinding = {
  run: (model: string, input: unknown) => Promise<unknown>;
};

type Env = {
  EDITORIAL_DB?: D1Database;
  ADMIN_TOKEN?: string;
  AI?: AiBinding;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
};

type PitchRow = {
  id: string;
  cluster_key?: string;
  category: string;
  title: string;
  summary: string;
  sources: string;
  tags: string;
  keywords: string;
  image_candidates: string;
  score?: number;
  source_count?: number;
  updated_at?: string;
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

const requireAdmin = (request: Request, env: Env) => {
  if (!env.ADMIN_TOKEN) return json({ error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-admin-token') || '';
  if (token !== env.ADMIN_TOKEN) return json({ error: 'Token editorial invalido.' }, { status: 401 });
  return null;
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = env.EDITORIAL_DB;
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  const url = new URL(request.url);
  const id = clean(url.searchParams.get('id'), 120);
  const clusterKey = clean(url.searchParams.get('clusterKey') || url.searchParams.get('cluster_key'), 180);
  const title = clean(url.searchParams.get('title'), 240);
  if (!id && !clusterKey && !title) return json({ error: 'Identificador da pauta ausente.' }, { status: 400 });

  const pitch = await db
    .prepare(
      `SELECT id, cluster_key, title, summary, category, sources, tags, keywords, image_candidates, score, source_count, updated_at
       FROM editorial_pitches
       WHERE id = ?
          OR cluster_key = ?
          OR cluster_key = ?
          OR title = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .bind(id, id, clusterKey, title)
    .first<PitchRow>();

  if (!pitch) return json({ error: 'Pauta nao encontrada.' }, { status: 404 });

  const article = await buildArticlePayload(
    {
      id: `preview:${pitch.id}`,
      pitch_id: pitch.id,
      category: pitch.category,
      publish_after: pitch.updated_at || new Date().toISOString(),
      title: pitch.title,
      summary: pitch.summary,
      sources: pitch.sources || '[]',
      tags: pitch.tags || '[]',
      keywords: pitch.keywords || '',
      image_candidates: pitch.image_candidates || '[]',
      score: pitch.score || 0,
      source_count: pitch.source_count || 0,
    },
    env,
  );

  return json({
    ok: true,
    model: (article as { generationModel?: string }).generationModel || (env.GEMINI_API_KEY ? env.GEMINI_MODEL || MODEL : env.AI ? 'workers-ai-fallback' : 'fallback-editorial-template'),
    aiEnabled: Boolean(env.GEMINI_API_KEY || env.AI),
    generatedWithAi: Boolean((article as { generatedWithAi?: boolean }).generatedWithAi),
    generationError: (article as { generationError?: string }).generationError || '',
    article,
  });
};
