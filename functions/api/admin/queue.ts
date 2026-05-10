import { DEFAULT_GEMINI_MODEL, runGeminiJson } from '../../lib/gemini';

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

export const MODEL = DEFAULT_GEMINI_MODEL;
const WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';

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
  if (!env.GEMINI_API_KEY && !env.AI) {
    return { ...fallback, generatedWithAi: false, generationModel: 'fallback-editorial-template', generationError: 'IA editorial nao configurada.' };
  }

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

  const system =
    'Você não é um assistente. Você é o jornalista redator de alto nível do Portal Novo Alvo. Escreva em português do Brasil, com acentos corretos. Responda somente JSON válido.';
  const prompt = `
Transforme este cluster de dados brutos em uma análise jornalística de alta densidade.

ORDENS CRÍTICAS:
- NÃO CITE AS FONTES NO TEXTO. Nunca use frases como "Segundo o G1", "A CNN relata" ou qualquer construção equivalente. Use os dados das fontes para construir afirmações próprias e absolutas do Portal Novo Alvo.
- SOBERANIA DO DADO. Remova todas as menções nominais a outros portais brasileiros no corpo do texto. Use a informação deles para construir a nossa afirmação técnica.
- PROIBIDO CLICHÊS. Delete do vocabulário: "Além disso", "Vale notar", "Em resumo", "No cenário atual", "No vasto cenário", "Importante ressaltar" e "Desvendar".
- PIRÂMIDE INVERTIDA REAL. O primeiro parágrafo deve ser uma marretada de informação: dado frio, impacto direto e relevância imediata.
- SÍNTESE UNITÁRIA. O leitor não deve perceber que existem várias fontes. Ele deve ler um texto único, coeso, denso e autoral.
- TOM BRUTALISTA. Escreva de forma seca, pragmática e factual. Elimine adjetivos e advérbios desnecessários.
- INFORMATION GAIN. Se fontes diferentes repetem o mesmo fato, cite uma vez. Se uma fonte traz dado técnico, divergente ou mais concreto, priorize esse dado.
- MORTE ÀS LISTAS. É proibido listar itens como "o que ver na TV", "a plataforma X tem o filme Y" ou "a fonte X publicou Y". Transforme listas em fluxo narrativo analítico.
- FIM DA REDUNDÂNCIA. É proibido repetir a pauta no primeiro e no último parágrafo. Cada linha deve trazer um dado novo.
- EXEMPLO RUIM: "A Netflix tem o filme X. A HBO tem o Y."
- EXEMPLO NEXA: "O ecossistema de streaming prioriza esta semana narrativas de suspense documental, com destaque para a cinebiografia de Marco Aurélio, que domina as principais janelas digitais."

REGRAS TÉCNICAS:
- Analise apenas as fontes fornecidas abaixo como material invisível de apuração.
- Estrutura: 5 a 8 parágrafos curtos.
- Use <h3> para quebrar os blocos editoriais. Evite subtítulos óbvios como "Conclusão", "Contexto" ou "O que vem agora".
- Não crie links externos.
- Onde houver placeholder de link interno, mantenha a estrutura.
- Use as fontes do cluster como base de apuração. O padrão editorial esperado é síntese de 8 fontes distintas.
- Não cite Google News como fonte editorial.
- Não cite Reddit como fonte, a menos que Reddit esteja literalmente listado no cluster abaixo.
- Produza texto pronto para publicação.
- content_html deve usar apenas <p>, <h2>, <h3>, <strong>, <em>, <ul>, <li>.
- Prefira <h3> a <h2> dentro do content_html.
- Parágrafos devem ser curtos, mas densos em informação.

DADOS DO CLUSTER:
[CATEGORIA]: ${row.category}
[PAUTA]: ${row.title}
[RESUMO]: ${row.summary}
[PALAVRAS-CHAVE]: ${row.keywords}
[FONTES]:
${sourceLines || 'Fontes não listadas.'}

OBJETIVO FINAL:
O leitor deve sentir que está lendo um relatório de inteligência técnica, não uma postagem de blog comum.

Responda exatamente neste formato:
{"title":"...","slug":"...","meta_description":"...","summary":"...","keywords":"...","content_html":"..."}
`;

  try {
    let generationModel = WORKERS_AI_MODEL;
    const result = env.GEMINI_API_KEY
      ? await runGeminiJson({
            apiKey: env.GEMINI_API_KEY,
            model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
            system,
            prompt,
            maxOutputTokens: 1600,
            temperature: 0.35,
          })
          .then((gemini) => {
            generationModel = gemini.model;
            return gemini.result;
          })
      : parseModelJson(
          extractText(
            await env.AI!.run(WORKERS_AI_MODEL, {
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: prompt },
              ],
              max_tokens: 1400,
              temperature: 0.35,
            }),
          ),
        );

    return {
      title: plain(result.title, 220) || fallback.title,
      summary: plain(result.summary, 700) || fallback.summary,
      seoDescription: plain(result.meta_description || result.seoDescription, 155) || fallback.seoDescription,
      keywords: plain(result.keywords, 700) || fallback.keywords,
      bodyHtml: safeHtml(result.content_html || result.bodyHtml) || fallback.bodyHtml,
      generatedWithAi: true,
      generationModel,
      generationError: '',
    };
  } catch (error) {
    return {
      ...fallback,
      generatedWithAi: false,
      generationModel: env.GEMINI_API_KEY ? env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL : WORKERS_AI_MODEL,
      generationError: error instanceof Error ? error.message : 'Falha desconhecida na geracao por IA.',
    };
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
    generatedWithAi: aiArticle.generatedWithAi,
    generationModel: aiArticle.generationModel,
    generationError: aiArticle.generationError,
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
