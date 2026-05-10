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
  score?: number;
  source_count?: number;
};

const CATEGORY_IMAGES: Record<string, string> = {
  Brasil: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=1600&q=80',
  Mundo: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80',
  Economia: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1600&q=80',
  Tecnologia: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
  Entretenimento: 'https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=1600&q=80',
  Esportes: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1600&q=80',
  Ciencia: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1600&q=80',
  Saude: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1600&q=80',
  Famosos: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1600&q=80',
  Futebol: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1600&q=80',
  Games: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1600&q=80',
  Lifestyle: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
  Educacao: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1600&q=80',
  Moda: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1600&q=80',
  Cinema: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80',
};

const fallbackImageForCategory = (category: unknown) => CATEGORY_IMAGES[clean(category, 80)] || '/og-default.svg';

const isUsableImage = (value: unknown) => {
  const url = clean(value, 1000);
  if (!/^https:\/\//i.test(url)) return false;
  if (/source\.unsplash\.com/i.test(url)) return false;
  if (/\.(svg|gif)(\?|$)/i.test(url)) return false;
  return true;
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
    .replace(/<3/g, '')
    .replace(/\*+/g, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/<p[^>]*>[\s\S]*?(?:gera[cç][aã]o\s*x|millennials?|gen\s*z)[\s\S]*?<\/p>/gi, '')
    .replace(/(?:^|[.!?]\s+)[^.!?]*(?:gera[cç][aã]o\s*x|millennials?|gen\s*z)[^.!?]*[.!?]/gi, ' ')
    .replace(/<(?!\/?(p|h2|h3|strong|em|ul|ol|li|blockquote)(\s|>|\/))/gi, '&lt;')
    .trim();

const splitLongText = (text: string) => {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) return [];
  const sentences = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences.map((item) => item.trim()).filter(Boolean)) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > 280 && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
};

const buildStructuredArticleHtml = (html: string) => {
  const chunks = splitLongText(plain(html, 12000)).slice(0, 12);
  if (chunks.length < 4) return html;

  const splitAt = Math.max(3, Math.ceil(chunks.length / 2));
  return [
    `<p>${escapeHtml(chunks[0])}</p>`,
    '<h2>O ponto de press\u00e3o</h2>',
    ...chunks.slice(1, splitAt).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    '<h3>O efeito imediato</h3>',
    ...chunks.slice(splitAt).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
  ].join('');
};

const normalizeArticleHtml = (html: string) => {
  const normalized = safeHtml(html)
    .replace(/<\/(h2|h3|p|blockquote|li)>\s*/gi, '</$1>\n')
    .replace(/<(h2|h3)[^>]*>\s*(.*?)\s*<\/\1>/gi, (_match, tag, text) => `<${tag}>${plain(text, 140)}</${tag}>`)
    .replace(/<p[^>]*>\s*([\s\S]*?)\s*<\/p>/gi, (_match, text) =>
      splitLongText(String(text).replace(/<[^>]+>/g, ' '))
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join(''),
    )
    .replace(/<blockquote[^>]*>\s*([\s\S]*?)\s*<\/blockquote>/gi, (_match, text) => `<blockquote>${escapeHtml(plain(text, 360))}</blockquote>`)
    .replace(/<li[^>]*>\s*([\s\S]*?)\s*<\/li>/gi, (_match, text) => `<li>${escapeHtml(plain(text, 220))}</li>`);

  const hasHeading = /<h[23]>/i.test(normalized);
  const paragraphs = (normalized.match(/<p>/gi) || []).length;
  if (paragraphs >= 5 && hasHeading) return normalized;
  if (paragraphs >= 4) return buildStructuredArticleHtml(normalized);

  const text = plain(normalized, 9000);
  const chunks = splitLongText(text).slice(0, 10);
  if (!chunks.length) return normalized;
  const midpoint = Math.max(2, Math.floor(chunks.length / 2));
  return chunks
    .map((paragraph, index) => {
      if (index === midpoint) return `<h2>O ponto de press\u00e3o</h2><p>${escapeHtml(paragraph)}</p>`;
      if (index === chunks.length - 2 && chunks.length > 5) return `<h3>O efeito imediato</h3><p>${escapeHtml(paragraph)}</p>`;
      return `<p>${escapeHtml(paragraph)}</p>`;
    })
    .join('');
};

const htmlFromModelField = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/<(p|h2|h3|strong|em|ul|ol|li|blockquote)\b/i.test(raw)) return normalizeArticleHtml(raw);
  return normalizeArticleHtml(
    raw
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join(''),
  );
};

const hasEditorialBody = (html: string) => {
  const text = plain(html, 5000);
  if (text.length < 450) return false;
  if (/pauta consolidada por \d+ fontes/i.test(text)) return false;
  if (/o rascunho exige angulo proprio|o rascunho exige ângulo próprio/i.test(text)) return false;
  if (/fontes monitoradas|entrou na fila editorial|resumo editorial|cluster de dados/i.test(text)) return false;
  return true;
};

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
  const score = Number(row.score || 0);
  const sourceCount = Number(row.source_count || sources.length || 0);
  const premiumDraft = score > 800;
  const sourceLines = sources
    .slice(0, 20)
    .map((source) => {
      if (!source || typeof source !== 'object') return '';
      const record = source as Record<string, unknown>;
      return `- ${plain(record.publisher, 80)}: ${plain(record.title, 180)} (${plain(record.url, 400)})`;
    })
    .filter(Boolean)
    .join('\n');

  const system =
    'PROMPT: NEXA ENGINE v9.5 - MULTIGENERATIONAL AUDIENCE. Voce e um jornalista redator profissional do Portal Novo Alvo, uma voz independente que opera na fronteira entre analise tecnica profunda e cultura pop viral. As geracoes citadas nas diretrizes sao apenas parametros internos de estilo. Nunca cite Geracao X, Millennials, Gen Z, publico-alvo ou diretrizes editoriais dentro da materia. Escreva em portugues do Brasil, com acentos corretos. Comece a resposta imediatamente com JSON puro e valido.';
  const prompt = `
PROMPT: NEXA ENGINE v9.5 - MULTIGENERATIONAL AUDIENCE

Persona: Voce e um jornalista redator profissional do Portal Novo Alvo, uma voz independente que opera na fronteira entre a analise tecnica profunda e a cultura pop viral. Voce escreve para quem nao tem tempo a perder, mas exige profundidade.

REGRA DE INVISIBILIDADE EDITORIAL:
As diretrizes por geracao abaixo sao apenas calibragem interna de tom. Nunca cite "Geracao X", "Millennials", "Gen Z", "jovens", "publico-alvo", "leitor-alvo" ou qualquer explicacao sobre para quem o texto foi escrito. O texto deve parecer uma materia jornalistica natural, nao um documento de estrategia editorial.

DIRETRIZES DE ESTILO POR GERACAO:

Geracao X (Fatos e Rigor): Nada de "achismos". O dado deve ser frio e a fonte da informacao deve transparecer na densidade do texto, sem precisar ser citada nominalmente.

Millennials (Contexto e Ironia): Use um tom cinico e sarcastico sobre o "obvio". Foque no porque de tal fato importar. Use frases que conectem o assunto ao impacto pratico na vida ou no bolso.

Gen Z (Velocidade e Impacto): Paragrafos curtos (maximo 3 linhas). Linguagem direta. Se o assunto for futebol ou entretenimento, use termos de impacto (punch). Abandone o juridiques e palavras latinas arcaicas.

REGRAS DE NULIFICACAO (INVIOLAVEIS):

PROIBIDO: Listar "quem esta passando o que" (inventario). Transforme a lista em narrativa.

PROIBIDO: Citar portais concorrentes (G1, CNN, Netflix). O dado agora e nosso.

PROIBIDO: Termos de "IA padrao" como: "No vasto cenario", "Vale ressaltar", "Alem disso", "Em suma".

PROIBIDO: Marcadores de depuracao como <3> ou asteriscos. Use apenas HTML limpo (<h2>, <h3>, <p>).

PROIBIDO: Citar diretamente as geracoes usadas na calibragem de estilo. Nao escreva frases como "Para a Geracao X", "Millennials" ou "a Gen Z quer". Use a energia dessas diretrizes sem revelar a regra.

FORMATO EDITORIAL OBRIGATORIO:
- Escreva uma materia completa, nao um resumo de pauta.
- Nunca mencione IA, modelo, prompt, cluster, fontes consolidadas ou processo interno no texto publicado.
- O primeiro paragrafo deve abrir com o dado mais forte.
- Use 6 a 9 paragrafos curtos, com 1 a 3 frases por paragrafo.
- Use ao menos um <h2> e um <h3> analiticos, sem titulos obvios como "Conclusao".
- Feche com uma projecao ou conclusao seca, sem chamada de servico.
- O campo content_html deve usar apenas <p>, <h2>, <h3>, <strong>, <em>, <ul>, <li>.

DADOS DO CLUSTER:
[CATEGORIA]: ${row.category}
[PAUTA]: ${row.title}
[RESUMO]: ${row.summary}
[PALAVRAS-CHAVE]: ${row.keywords}
[SCORE EDITORIAL]: ${score}
[FONTES CONSOLIDADAS]: ${sourceCount}
[FONTES]:
${sourceLines || 'Fontes nao listadas.'}

Responda exatamente neste formato, com JSON valido e sem markdown:
{"title":"...","slug":"...","meta_description":"...","content_html":"..."}
`;

  try {
    let generationModel = WORKERS_AI_MODEL;
    const result = env.GEMINI_API_KEY
      ? await runGeminiJson({
            apiKey: env.GEMINI_API_KEY,
            model: premiumDraft ? DEFAULT_GEMINI_MODEL : env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
            system,
            prompt,
            maxOutputTokens: premiumDraft ? 5200 : 4200,
            temperature: premiumDraft ? 0.28 : 0.35,
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

    const generatedBody = htmlFromModelField(
      result.content_html || result.bodyHtml || result.contentHtml || result.content || result.article || result.text,
    );
    if (!hasEditorialBody(generatedBody)) {
      throw new Error('Gemini respondeu sem uma materia editorial completa em content_html.');
    }

    return {
      title: plain(result.title, 220) || fallback.title,
      summary: plain(result.summary || result.meta_description, 700) || fallback.summary,
      seoDescription: plain(result.meta_description || result.seoDescription, 155) || fallback.seoDescription,
      keywords: plain(result.keywords, 700) || fallback.keywords,
      bodyHtml: generatedBody,
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
  const coverUrl = imageCandidates.find(isUsableImage) || fallbackImageForCategory(row.category);
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
    coverUrl,
    coverAlt: aiArticle.title,
    seoDescription: aiArticle.seoDescription,
    keywords: aiArticle.keywords,
    tags,
    sources: sourceNames,
    media: [coverUrl, ...imageCandidates.filter((src) => src !== coverUrl && isUsableImage(src))].map((src) => ({ src, type: 'image' })),
    readingMinutes: Math.max(1, Math.ceil(aiArticle.bodyHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 220)),
    publishedAt,
    generatedWithAi: aiArticle.generatedWithAi,
    generationModel: aiArticle.generationModel,
    generationTier: Number(row.score || 0) > 800 ? 'nexa-premium' : 'standard',
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
      `SELECT q.id, q.pitch_id, q.category, q.publish_after, p.title, p.summary, p.sources, p.tags, p.keywords, p.image_candidates, p.score, p.source_count
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
