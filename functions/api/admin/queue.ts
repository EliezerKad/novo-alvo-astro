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

type QueueRow = {
  id: string;
  pitch_id: string;
  category: string;
  publish_after: string;
  title: string;
  summary: string;
  sources: string;
  tags: string;
  keywords: string;
  image_candidates: string;
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

const parseArray = (value: string) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const escapeHtml = (value: unknown) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const requireAdmin = (request: Request, env: Env) => {
  if (!env.ADMIN_TOKEN) return json({ error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-admin-token') || '';
  if (token !== env.ADMIN_TOKEN) return json({ error: 'Token editorial invalido.' }, { status: 401 });
  return null;
};

const buildArticlePayload = (row: QueueRow) => {
  const sources = parseArray(row.sources);
  const tags = parseArray(row.tags).map(String).filter(Boolean);
  const imageCandidates = parseArray(row.image_candidates).map(String).filter(Boolean);
  const sourceNames = [
    ...new Set(
      sources
        .map((source) => (source && typeof source === 'object' ? (source as Record<string, unknown>).publisher : ''))
        .map((source) => clean(source, 120))
        .filter(Boolean),
    ),
  ];
  const title = clean(row.title, 220);
  const summary = clean(row.summary, 700) || `Pauta consolidada a partir de ${sourceNames.length || sources.length} fontes monitoradas.`;
  const slug = slugify(title);
  const publishedAt = new Date().toISOString();
  const bodyHtml = `
    <p>${escapeHtml(summary)}</p>
    <p>O ponto central é simples: a pauta apareceu de forma recorrente em veículos distintos e entrou na fila editorial por relevância, volume de cobertura e aderência à categoria ${escapeHtml(row.category)}.</p>
    <h2>O que importa agora</h2>
    <p>O Portal Novo Alvo registra o movimento como sinal editorial consolidado, priorizando contexto, impacto público e acompanhamento dos próximos desdobramentos.</p>
    ${
      sourceNames.length
        ? `<section class="article-sources"><h2>Fontes e transparência</h2><ul>${sourceNames
            .slice(0, 8)
            .map((source) => `<li>${escapeHtml(source)}</li>`)
            .join('')}</ul></section>`
        : ''
    }
  `;

  return {
    id: `article:${slug}`,
    slug,
    title,
    summary,
    bodyHtml,
    category: row.category || 'Brasil',
    author: 'Redação Novo Alvo',
    status: 'published',
    coverUrl: imageCandidates[0] || '',
    coverAlt: title,
    seoDescription: summary.slice(0, 155),
    keywords: clean(row.keywords, 700),
    tags,
    sources: sourceNames,
    media: imageCandidates.map((src) => ({ src, type: 'image' })),
    readingMinutes: Math.max(1, Math.ceil(bodyHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 220)),
    publishedAt,
  };
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = env.EDITORIAL_DB;
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  const result = await db
    .prepare(
      `SELECT q.*, p.title, p.summary
       FROM editorial_queue q
       JOIN editorial_pitches p ON p.id = q.pitch_id
       ORDER BY q.publish_after ASC
       LIMIT 100`,
    )
    .all();
  return json({ queue: result.results || [] });
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = env.EDITORIAL_DB;
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(5, Number(url.searchParams.get('limit') || 2)));
  const now = new Date().toISOString();
  const due = await db
    .prepare(
      `SELECT q.id, q.pitch_id, q.category, q.publish_after, p.title, p.summary, p.sources, p.tags, p.keywords, p.image_candidates
       FROM editorial_queue q
       JOIN editorial_pitches p ON p.id = q.pitch_id
       WHERE q.status = 'queued' AND q.publish_after <= ?
       ORDER BY q.publish_after ASC
       LIMIT ?`,
    )
    .bind(now, limit)
    .all<QueueRow>();

  const published: unknown[] = [];
  const origin = new URL(request.url).origin;

  for (const item of due.results || []) {
    const article = buildArticlePayload(item);
    try {
      const response = await fetch(`${origin}/api/admin/articles`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.ADMIN_TOKEN}`,
        },
        body: JSON.stringify(article),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String((data as { error?: string }).error || response.status));

      await db
        .prepare(
          `UPDATE editorial_queue
           SET status = 'published', published_at = ?, article_slug = ?, error = '', updated_at = ?
           WHERE id = ?`,
        )
        .bind(new Date().toISOString(), article.slug, new Date().toISOString(), item.id)
        .run();
      await db
        .prepare("UPDATE editorial_pitches SET status = 'converted', updated_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), item.pitch_id)
        .run();
      published.push({ queueId: item.id, slug: article.slug, title: article.title, staticPublish: (data as { staticPublish?: unknown }).staticPublish });
    } catch (error) {
      await db
        .prepare("UPDATE editorial_queue SET status = 'failed', error = ?, updated_at = ? WHERE id = ?")
        .bind(error instanceof Error ? error.message : 'Falha desconhecida', new Date().toISOString(), item.id)
        .run();
    }
  }

  return json({ ok: true, checked: due.results?.length || 0, published });
};
