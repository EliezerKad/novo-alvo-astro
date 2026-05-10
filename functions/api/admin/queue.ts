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
    .replace(/<(?!\/?(p|h2|h3|strong|em|ul|ol|li|blockquote)(\s|>|\/))/gi, '&lt;')
    .trim();

const htmlFromModelField = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/<(p|h2|h3|strong|em|ul|ol|li|blockquote)\b/i.test(raw)) return safeHtml(raw);
  return raw
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');
};

const hasEditorialBody = (html: string) => {
  const text = plain(html, 5000);
  if (text.length < 450) return false;
  if (/pauta consolidada por \d+ fontes/i.test(text)) return false;
  if (/o rascunho exige angulo proprio|o rascunho exige ângulo próprio/i.test(text)) return false;
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
  const popCategory = ['Esportes', 'Futebol', 'Entretenimento', 'Famosos', 'Games'].includes(clean(row.category, 80));
  const categoryPersona = popCategory
    ? `
PERSONA DE CATEGORIA:
- Para ${row.category}, mantenha o Brutalismo, mas escreva como um analista de Substack/Twitter assistindo ao evento em tempo real.
- Linguagem direta, veloz e com punch. Menos palavras abstratas, mais impacto.
- Foque no sentimento técnico: pressão, ruptura, domínio, queda, virada, desgaste, controle, palco, fatura, ruído, pancada, resposta.
- Evite frases acadêmicas como "obteve êxito", "apresentou desempenho satisfatório" ou "configura um movimento relevante".
- Prefira formulações vivas e factuais: "liquidou a fatura", "travou o jogo", "dominou a janela", "perdeu tração", "virou ativo de atenção".
- O público é Gen Z e Millennial: verdade nua e crua, com velocidade e pegada, sem meme barato e sem exagero vazio.
- Nao escreva como editor-chefe resumindo pauta. Escreva como jornalista de arquibancada, bastidor e feed: direto, vivo, com leitura tecnica e pulso de quem esta vendo a cena acontecer.
- Troque o "relatorio da CIA" por "Brutalismo Pop": suor, atrito, hype, queda, pressao e impacto real.
- Proibido soar como consultoria. Evite "gestao de imagem publica", "ativo estrategico", "inegociavel", "consolidada" e "estrategico".
- Substitua esse vocabulario por formulacoes vivas: "virou assunto", "segurou o palco", "tomou pancada", "comprou a pressao", "entregou impacto real".
- Para esporte, escreva com energia de jogo: placar emocional, pressao da arquibancada, erro que custa caro, time com corda no pescoco, decisao tomada no detalhe. Nada de tratado militar.
- Para famosos, games e entretenimento, trate imagem, desejo, exposicao, jogo e repercussao como cultura pop em movimento. Nada de museu de palavras dificeis.
`
    : '';
  const sourceLines = sources
    .slice(0, 8)
    .map((source) => {
      if (!source || typeof source !== 'object') return '';
      const record = source as Record<string, unknown>;
      return `- ${plain(record.publisher, 80)}: ${plain(record.title, 180)} (${plain(record.url, 400)})`;
    })
    .filter(Boolean)
    .join('\n');

  const system = popCategory
    ? 'Aja como jornalista redator do Portal Novo Alvo, com voz de analista de Substack/Twitter. Sua funcao e transformar dados brutos em texto vivo, direto e factual para publico Gen Z e Millennial. Escreva em portugues do Brasil, com acentos corretos. Comece a resposta imediatamente com JSON puro e valido.'
    : 'Aja como o Mainframe de Inteligência da Nexa Media. Sua função é sintetizar dados brutos em uma narrativa de autoridade absoluta para o Portal Novo Alvo. Escreva em português do Brasil, com acentos corretos. Comece a resposta imediatamente com JSON puro e válido.';
  const prompt = `
Transforme este cluster de dados brutos em uma análise jornalística de alta densidade.

REGRAS DE NULIFICAÇÃO CRÍTICAS:
- Proibição de Inventário: não faça listas de "quem está exibindo o quê". Integre títulos de obras, clubes, produtos, empresas ou personagens em uma análise sobre tendência, mercado, gênero, disputa, risco ou comportamento.
- Proibição de Créditos Externos: não cite nomes de outros veículos no corpo do texto, incluindo CNN, G1, UOL, Folha, Estadão, Globo, Reuters ou similares. O dado é do Portal Novo Alvo.
- Proibição de Marcadores: não use <3>, *, bullets decorativos ou qualquer caractere de depuração. Use apenas <h2> e <h3> para hierarquia.
- Filtro de Ruído: não escreva frases introdutórias como "Aqui está", "Aqui estão as pautas" ou "Segue o texto". Comece o JSON imediatamente.

ARQUITETURA DO CONTEÚDO:
- Lide Brutalista: comece com uma afirmação de mercado, poder, comportamento ou um fato incontestável.
- Exemplo de abertura: "A fragmentação do catálogo de streaming força uma reestruturação nas janelas de exibição nesta semana."
- Desenvolvimento: una as informações das fontes do cluster. Se várias fontes falam de uma mesma obra ou evento, analise o impacto desse movimento, não apenas cite que ele existe.
- Encerramento: termine com uma projeção ou fechamento seco. Nunca termine com chamada de serviço como "Aproveite e assista".
- Soberania do dado: use a informação das fontes para construir afirmação técnica própria.
- Information Gain: cada parágrafo precisa trazer um dado novo.
${categoryPersona}

REGRAS TÉCNICAS:
- Analise apenas as fontes fornecidas abaixo como material invisível de apuração.
- Estrutura: 5 a 8 parágrafos curtos.
- Use <h2> e <h3> para hierarquia editorial. Evite subtítulos óbvios como "Conclusão", "Contexto" ou "O que vem agora".
- Não crie links externos.
- Onde houver placeholder de link interno, mantenha a estrutura.
- Use as fontes do cluster como base de apuração. O padrão editorial esperado é síntese de 8 fontes distintas.
- Não cite Google News como fonte editorial.
- Não cite Reddit como fonte, a menos que Reddit esteja literalmente listado no cluster abaixo.
- Produza texto pronto para publicação.
- content_html deve usar apenas <p>, <h2>, <h3>, <strong>, <em>, <ul>, <li>.
- Parágrafos devem ser curtos, mas densos em informação.
- Em Esportes, Futebol, Entretenimento, Famosos e Games, cada parágrafo deve ter no máximo 3 linhas visuais no celular: 1 a 3 frases curtas, sem bloco cansativo.

DADOS DO CLUSTER:
[CATEGORIA]: ${row.category}
[PAUTA]: ${row.title}
[RESUMO]: ${row.summary}
[PALAVRAS-CHAVE]: ${row.keywords}
[SCORE EDITORIAL]: ${score}
[FONTES CONSOLIDADAS]: ${sourceCount}
[FONTES]:
${sourceLines || 'Fontes não listadas.'}

OBJETIVO FINAL:
O leitor deve sentir que está lendo um relatório de inteligência técnica, não uma postagem de blog comum.

Responda exatamente neste formato:
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
