const MODEL = '@cf/meta/llama-3.1-8b-instruct';

type AiBinding = {
  run: (model: string, input: unknown) => Promise<unknown>;
};

type EditorialPayload = {
  action?: string;
  title?: string;
  summary?: string;
  category?: string;
  body?: string;
  selection?: string;
  seoDescription?: string;
  keywords?: string;
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

const isAuthorized = (request: Request, token?: string) => {
  if (!token) return false;
  const header = request.headers.get('authorization') || request.headers.get('x-admin-token') || '';
  const value = header.toLowerCase().startsWith('bearer ') ? header.slice(7) : header;
  return value.trim() === token;
};

const clip = (value: unknown, max: number) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const normalizeAction = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const extractText = (response: unknown) => {
  if (typeof response === 'string') return response;
  if (!response || typeof response !== 'object') return '';
  const record = response as Record<string, unknown>;
  return String(record.response || record.result || record.text || '');
};

const parseModelJson = (text: string) => {
  const clean = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return { text: clean };
    try {
      return JSON.parse(match[0]);
    } catch {
      return { text: clean };
    }
  }
};

const cleanPlainText = (value: unknown) =>
  String(value || '')
    .replace(/\*\*/g, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^\s*(ação editorial|acao editorial|categoria|título atual|titulo atual|resumo atual|texto selecionado).*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const normalizeResult = (action: string, rawResult: Record<string, unknown>) => {
  const actionKey = normalizeAction(action);
  const result = { ...rawResult };

  if (Array.isArray(result.titleOptions)) {
    result.titleOptions = result.titleOptions.map(cleanPlainText).filter(Boolean).slice(0, 4);
  }
  if (Array.isArray(result.keywords)) {
    result.keywords = result.keywords.map(cleanPlainText).filter(Boolean).slice(0, 12);
  }

  ['text', 'subtitle', 'seoDescription', 'push', 'instagram'].forEach((key) => {
    if (result[key]) result[key] = cleanPlainText(result[key]);
  });

  if (actionKey.includes('criar resumo') && result.text) {
    result.text = String(result.text).slice(0, 320);
  }
  if (result.seoDescription) {
    result.seoDescription = String(result.seoDescription).slice(0, 158);
  }
  return result;
};

const buildTask = (payload: Required<EditorialPayload>) => {
  const actionKey = normalizeAction(payload.action);

  if (actionKey.includes('sugerir titulo')) {
    return 'Crie 4 opções de título jornalístico forte, com acentos corretos, sem clickbait exagerado. Responda apenas: {"titleOptions":["...","...","...","..."]}';
  }
  if (actionKey.includes('criar resumo')) {
    return 'Crie um resumo editorial premium para preencher o campo de resumo da matéria. Use até 320 caracteres, português do Brasil com acentos corretos, sem markdown. Responda apenas: {"text":"..."}';
  }
  if (actionKey.includes('resumir')) {
    return 'Resuma o texto selecionado ou corpo da matéria em um parágrafo curto, claro e pronto para entrar no editor. Preserve fatos. Use acentos corretos. Responda apenas: {"text":"..."}';
  }
  if (actionKey.includes('melhorar escrita')) {
    return 'Reescreva o texto selecionado ou corpo da matéria com português correto, acentos corretos, fluidez jornalística e sem alterar os fatos. Responda apenas: {"text":"..."}';
  }
  if (actionKey.includes('subtitulo')) {
    return 'Crie um subtítulo H2 curto, elegante e editorial para a matéria. Use acentos corretos. Responda apenas: {"subtitle":"..."}';
  }
  if (actionKey.includes('push')) {
    return 'Crie uma chamada push curta, direta e jornalística, com até 90 caracteres. Use acentos corretos. Responda apenas: {"push":"..."}';
  }
  if (actionKey.includes('instagram')) {
    return 'Crie uma legenda curta para Instagram com tom editorial jovem, sem exagero e com acentos corretos. Responda apenas: {"instagram":"..."}';
  }
  if (actionKey.includes('seo')) {
    return 'Crie uma descrição SEO com até 155 caracteres e até 12 palavras-chave relevantes. Use acentos corretos. Responda apenas: {"seoDescription":"...","keywords":["...","..."]}';
  }

  return 'Ajude na edição jornalística do texto. Use português do Brasil com acentos corretos. Responda apenas: {"text":"..."}';
};

const buildPrompt = (payload: Required<EditorialPayload>) => `
Tarefa:
${buildTask(payload)}

Contexto editorial:
- Categoria: ${payload.category || 'sem categoria'}
- Título atual: ${payload.title || 'sem título'}
- Resumo atual: ${payload.summary || 'sem resumo'}
- Descrição SEO atual: ${payload.seoDescription || 'vazia'}
- Palavras-chave atuais: ${payload.keywords || 'vazias'}

Texto de trabalho:
${payload.selection || payload.body || 'Texto ainda vazio.'}

Regras obrigatórias:
- Não repita estas instruções.
- Não use markdown.
- Não use rótulos como "Ação editorial", "Categoria" ou "Resumo atual".
- Não remova acentos, cedilha, til ou pontuação correta.
- Responda somente o JSON pedido na tarefa.
`;

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: { AI?: AiBinding; ADMIN_TOKEN?: string };
}) => {
  if (!env.ADMIN_TOKEN) {
    return json({ error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });
  }

  if (!isAuthorized(request, env.ADMIN_TOKEN)) {
    return json({ error: 'Token editorial invalido.' }, { status: 401 });
  }

  if (!env.AI) {
    return json(
      {
        error:
          'Binding AI nao configurado. Adicione Workers AI com o nome AI nas configuracoes do Cloudflare Pages e faca um novo deploy.',
      },
      { status: 503 },
    );
  }

  let rawPayload: EditorialPayload = {};
  try {
    rawPayload = await request.json();
  } catch {
    return json({ error: 'JSON invalido.' }, { status: 400 });
  }

  const payload: Required<EditorialPayload> = {
    action: clip(rawPayload.action, 80),
    title: clip(rawPayload.title, 220),
    summary: clip(rawPayload.summary, 700),
    category: clip(rawPayload.category, 80),
    body: clip(rawPayload.body, 5200),
    selection: clip(rawPayload.selection, 2400),
    seoDescription: clip(rawPayload.seoDescription, 220),
    keywords: clip(rawPayload.keywords, 400),
  };

  if (!payload.action) return json({ error: 'Acao editorial ausente.' }, { status: 400 });

  const response = await env.AI.run(MODEL, {
    messages: [
      {
        role: 'system',
        content:
          'Você é um editor-chefe de um portal de notícias brasileiro. Escreva sempre em português do Brasil, com acentos, cedilha e pontuação corretos. Responda somente JSON válido.',
      },
      { role: 'user', content: buildPrompt(payload) },
    ],
    max_tokens: 650,
    temperature: 0.45,
  });

  const text = extractText(response);
  const result = normalizeResult(payload.action, parseModelJson(text));

  return json({
    action: payload.action,
    model: MODEL,
    result,
  });
};
