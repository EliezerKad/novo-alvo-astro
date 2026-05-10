export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    message?: string;
  };
};

export const extractGeminiText = (response: GeminiResponse) =>
  String(response.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '').trim();

export const parseJsonText = (text: string) => {
  const clean = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
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

export async function runGeminiJson({
  apiKey,
  model,
  system,
  prompt,
  maxOutputTokens = 900,
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
  if (!key) throw new Error('GEMINI_API_KEY nao configurada.');

  const preferredModel = String(model || DEFAULT_GEMINI_MODEL).trim();
  const models = [...new Set([preferredModel, DEFAULT_GEMINI_MODEL, 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-flash-latest'])];

  let lastError = '';
  for (const modelName of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: system }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature,
            maxOutputTokens,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    const data = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
      lastError = data.error?.message || `Gemini HTTP ${response.status}`;
      continue;
    }

    const text = extractGeminiText(data);
    if (!text) {
      lastError = 'Gemini nao retornou texto.';
      continue;
    }

    return {
      model: modelName,
      result: parseJsonText(text),
      rawText: text,
    };
  }

  throw new Error(lastError || 'Falha ao chamar Gemini.');
}
