const MODEL = '@cf/meta/llama-3.2-1b-instruct';

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

const clip = (value: unknown, max: number) =>
  String(value || '')
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

const buildPrompt = (payload: Required<EditorialPayload>) => `
Acao editorial: ${payload.action}
Categoria: ${payload.category || 'sem categoria'}
Titulo atual: ${payload.title || 'sem titulo'}
Resumo atual: ${payload.summary || 'sem resumo'}
Descricao SEO atual: ${payload.seoDescription || 'vazia'}
Palavras-chave atuais: ${payload.keywords || 'vazias'}

Texto selecionado ou corpo da materia:
${payload.selection || payload.body || 'Texto ainda vazio.'}

Retorne apenas JSON valido, sem markdown, neste formato:
{
  "titleOptions": ["opcao 1", "opcao 2", "opcao 3"],
  "subtitle": "subtitulo quando fizer sentido",
  "text": "resultado principal curto e pronto para uso",
  "seoDescription": "ate 155 caracteres",
  "keywords": ["termo 1", "termo 2", "termo 3"],
  "push": "chamada push curta",
  "instagram": "legenda curta com tom editorial"
}
Use pt-BR, tom editorial jornalistico, claro, sem clickbait exagerado.
Para SEO automatico, priorize title, category, summary e termos reais do texto.
Para melhorar escrita, preserve fatos e nao invente informacoes.
`;

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: { AI?: AiBinding };
}) => {
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
          'Voce e um editor-chefe de um portal de noticias brasileiro. Responda sempre com JSON valido, util para um CMS editorial.',
      },
      { role: 'user', content: buildPrompt(payload) },
    ],
    max_tokens: 650,
    temperature: 0.45,
  });

  const text = extractText(response);
  const result = parseModelJson(text);

  return json({
    action: payload.action,
    model: MODEL,
    result,
  });
};
