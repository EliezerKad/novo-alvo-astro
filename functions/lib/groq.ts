export const DEFAULT_GROQ_MODEL = 'deepseek-r1-distill-llama-70b';

const extractGroqText = (response: Record<string, unknown>) => {
  const choices = response.choices;
  if (!Array.isArray(choices)) return '';
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  return String(message?.content || first?.text || '').trim();
};

export const parseGroqJsonText = (text: string) => {
  const clean = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(clean) as Record<string, unknown>;
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return { text: clean };
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return { text: clean };
    }
  }
};

export async function runGroqJson({
  apiKey,
  model,
  system,
  prompt,
  maxOutputTokens = 1800,
  temperature = 0.35,
}: {
  apiKey?: string;
  model?: string;
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}) {
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('GROQ_API_KEY nao configurada.');

  const modelName = String(model || DEFAULT_GROQ_MODEL).trim() || DEFAULT_GROQ_MODEL;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxOutputTokens,
      response_format: { type: 'json_object' },
    }),
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = data.error as Record<string, unknown> | undefined;
    throw new Error(String(error?.message || `Groq HTTP ${response.status}`));
  }

  const rawText = extractGroqText(data);
  if (!rawText) throw new Error('Groq nao retornou texto.');

  return {
    model: modelName,
    result: parseGroqJsonText(rawText),
    rawText,
  };
}
