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

export const MODEL = '@cf/meta/llama-3.1-8b-instruct';

type AiBinding = {
  run: (model: string, input: unknown) => Promise<unknown>;
};

type Env = {
  EDITORIAL_DB?: D1Database;
  ADMIN_TOKEN?: string;
  AI?: AiBinding;
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

const plain = (value: unknown, max: number) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const extractText = (response: unknown) => {
  if (typeof response === 'string') return response;
  if (!response || typeof response !== 'object') return '';
  const record = response as Record<string, unknown>;
  return String(record.response || record.result || record.text || '');
};

const parseModelJson = (text: string) => {
  const cleanText = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleanText) as Record<string, unknown>;
  } catch {
    const match = cleanText.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
};

const safeHtml = (value: unknown) =>
  String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/<(?!\/?(p|h2|h3|strong|em|ul|ol|li|blockquote)(\s|>|\/))/gi, '&lt;')
    .trim();

const requireAdmin = (request: Request, env: Env) => {
  if (!env.ADMIN_TOKEN) return json({ error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-admin-token') || '';
  if (token !== env.ADMIN_TOKEN) return json({ error: 'Token editorial invalido.' }, { status: 401 });
  return null;
};

const generateArticleWithAi = async (
  row: QueueRow,
  fallback: { title: string; summary: string; bodyHtml: string; seoDescription: string; keywords: string },
  env: Env,
) => {
  if (!env.AI) return fallback;

  const sources = parseArray(row.sources);
  const sourceLines = sources
    .slice(0, 8)
    .map((source) => {
      if (!source || typeof source !== 'object') return '';
      const record = source as Record<string, unknown>;
      return `- ${plain(record.publisher, 80)}: ${plain(record.title, 180)} (${plain(record.url, 400)})`;
    })
    .filter(Boolean)
    .join('\n');

  try {
    const response = await env.AI.run(MODEL, {
      messages: [
        {
          role: 'system',
          content:
            'Você é editor-chefe de um portal brasileiro. Escreva em português do Brasil, com acentos corretos, tom seco, direto e pragmático. Não invente fatos. Responda somente JSON válido.',
        },
        {
          role: 'user',
          content: `
Crie uma matéria jornalística original a partir deste cluster de fontes.

Categoria: ${row.category}
Pauta: ${row.title}
Resumo da pauta: ${row.summary}
Palavras-chave: ${row.keywords}

Fontes:
${sourceLines || 'Fontes não listadas.'}

Regras:
- Use pirâmide invertida.
- O primeiro parágrafo deve trazer o dado mais importante.
- Não cite Google News como fonte editorial.
- Não use clichês de IA.
- Não crie links.
- Produza texto pronto para publicação.
- bodyHtml deve usar apenas <p>, <h2>, <h3>, <strong>, <em>, <ul>, <li>.
- Inclua 5 a 8 parágrafos e 2 subtítulos.

Responda exatamente neste formato:
{"title":"...","summary":"...","seoDescription":"...","keywords":"...","bodyHtml":"..."}
`,
        },
      ],
      max_tokens: 1400,
      temperature: 0.35,
    });

    const result = parseModelJson(extractText(response));
    return {
      title: plain(result.title, 220) || fallback.title,
      summary: plain(result.summary, 700) || fallback.summary,
      seoDescription: plain(result.seoDescription, 155) || fallback.seoDescription,
      keywords: plain(result.keywords, 700) || fallback.keywords,
      bodyHtml: safeHtml(result.bodyHtml) || fallback.bodyHtml,
    };
  } catch {
    return fallback;
  }
};

export const buildArticlePayload = async (row: QueueRow, env: Env) => {
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

  const aiArticle = await generateArticleWithAi(
    row,
    {
      title,
      summary,
      bodyHtml,
      seoDescription: summary.slice(0, 155),
      keywords: clean(row.keywords, 700),
    },
    env,
  );

  return {
    id: `article:${slug}`,
    slug,
    title: aiArticle.title,
    summary: aiArticle.summary,
    bodyHtml: aiArticle.bodyHtml,
    category: row.category || 'Brasil',
    author: 'Redação Novo Alvo',
    status: 'published',
    coverUrl: imageCandidates[0] || '',
    coverAlt: aiArticle.title,
    seoDescription: aiArticle.seoDescription,
    keywords: aiArticle.keywords,
    tags,
    sources: sourceNames,
    media: imageCandidates.map((src) => ({ src, type: 'image' })),
    readingMinutes: Math.max(1, Math.ceil(aiArticle.bodyHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 220)),
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
    const article = await buildArticlePayload(item, env);
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
