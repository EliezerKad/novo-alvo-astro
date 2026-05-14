import { DEFAULT_GEMINI_MODEL, runGeminiJson } from '../../lib/gemini';
import { DEFAULT_GROQ_MODEL, runGroqJson } from '../../lib/groq';

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
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  EDITORIAL_AI_PROVIDER?: string;
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

type ImageCandidate = {
  url: string;
  sourceTitle?: string;
  sourcePublisher?: string;
  sourceUrl?: string;
  category?: string;
  role?: string;
};

const imageCreditFor = (url: string, candidates: ImageCandidate[]) => {
  const candidate = candidates.find((item) => item.url === url);
  const publisher = plain(candidate?.sourcePublisher, 80);
  if (!publisher) return '';
  if (/google\s*news/i.test(publisher)) return '';
  return `Credito: ${publisher}`;
};

const CATEGORY_IMAGES: Record<string, string> = {
  Politica: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1600&q=80',
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
  Cultura: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=1600&q=80',
  Moda: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1600&q=80',
  Musica: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1600&q=80',
  Cinema: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80',
};

const fallbackImageForCategory = (category: unknown) => CATEGORY_IMAGES[clean(category, 80)] || '/og-default.svg';

const isBlockedImageUrl = (value: unknown) => {
  const url = clean(value, 1000).toLowerCase();
  return (
    /(logo|avatar|icon|sprite|profile|pixel|tracking|blank|placeholder|favicon|author|badge|watermark)/i.test(url) ||
    /(^|\/\/|\.)news\.google\./i.test(url) ||
    /google(?:logo|news)|google\.com\/images\/branding|gstatic\.com\/images\/branding|www\.gstatic\.com\/images\/branding/i.test(url)
  );
};

const isUsableImage = (value: unknown) => {
  const url = clean(value, 1000);
  if (!/^https:\/\//i.test(url)) return false;
  if (/source\.unsplash\.com/i.test(url)) return false;
  if (/\.(svg|gif|ico)(\?|$)/i.test(url)) return false;
  if (isBlockedImageUrl(url)) return false;
  return true;
};

const attrFromTag = (tag: string, attr: string) => {
  const match = String(tag || '').match(new RegExp(`\\s${attr}=["']([^"']+)["']`, 'i'));
  return clean(match?.[1], 2000);
};

const absoluteImageUrl = (value: unknown, base: string) => {
  try {
    return new URL(clean(value, 2000), base).toString();
  } catch {
    return '';
  }
};

const isGoogleNewsUrl = (value: unknown) => /^https?:\/\/([^/]+\.)?news\.google\./i.test(clean(value, 2000));

const resolveArticleUrl = async (value: unknown) => {
  const url = clean(value, 2000);
  if (!url || !isGoogleNewsUrl(url)) return url;

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'PortalNovoAlvoImageScout/1.0',
      },
      signal: AbortSignal.timeout(7000),
    });
    if (response.url && !isGoogleNewsUrl(response.url)) return response.url;
    const html = await response.text().catch(() => '');
    const external = [...html.matchAll(/https?:\/\/(?![^"'\s]*?(?:news\.google|google\.com|gstatic\.com|googleusercontent\.com))[^"'\s<>]+/gi)]
      .map((match) => match[0])
      .find(Boolean);
    return external || url;
  } catch {
    return url;
  }
};

const imagesFromArticleHtml = (html: string, baseUrl: string) => {
  const output: string[] = [];
  const push = (value: unknown) => {
    const url = absoluteImageUrl(value, baseUrl);
    if (isUsableImage(url)) output.push(url);
  };

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const name = `${attrFromTag(tag, 'property')} ${attrFromTag(tag, 'name')}`.toLowerCase();
    if (/(^|\s)(og:image|twitter:image|twitter:image:src)(\s|$)/i.test(name)) push(attrFromTag(tag, 'content'));
  }

  for (const match of html.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const tag = match[0];
    if (/alt=["'][^"']*(logo|avatar|marca|perfil|icone|ícone|google)[^"']*["']/i.test(tag)) continue;
    push(attrFromTag(tag, 'src') || attrFromTag(tag, 'data-src') || attrFromTag(tag, 'data-original') || attrFromTag(tag, 'data-lazy-src'));
    const srcset = attrFromTag(tag, 'srcset') || attrFromTag(tag, 'data-srcset');
    if (srcset) {
      const urls = srcset
        .split(',')
        .map((item) => item.trim().split(/\s+/)[0])
        .filter(Boolean);
      push(urls.at(-1) || urls[0]);
    }
  }

  return [...new Set(output)].slice(0, 8);
};

const fetchArticleImageCandidates = async (source: Record<string, unknown>, category: string) => {
  const sourceUrl = clean(source.url, 2000);
  if (!sourceUrl) return [];

  try {
    const articleUrl = await resolveArticleUrl(sourceUrl);
    if (!articleUrl || /^https?:\/\/([^/]+\.)?news\.google\./i.test(articleUrl)) return [];
    const response = await fetch(articleUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'PortalNovoAlvoImageScout/1.0',
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok || !/text\/html|application\/xhtml/i.test(response.headers.get('content-type') || '')) return [];
    return imagesFromArticleHtml(await response.text(), response.url || articleUrl).map((url) => ({
      url,
      sourceTitle: clean(source.title, 240),
      sourcePublisher: clean(source.publisher, 120),
      sourceUrl: articleUrl,
      category,
    }));
  } catch {
    return [];
  }
};

const enrichImageCandidatesFromSources = async (candidates: ImageCandidate[], sources: unknown[], category: string) => {
  if (candidates.length >= 3) return candidates;
  const sourceRecords = sources.filter((source): source is Record<string, unknown> => Boolean(source && typeof source === 'object'));
  const found = (
    await Promise.all(sourceRecords.slice(0, 5).map((source) => fetchArticleImageCandidates(source, category)))
  ).flat();
  return uniqueImageCandidates([...candidates, ...found]).slice(0, 12);
};

const imageKey = (value: unknown) => {
  try {
    const url = new URL(clean(value, 1000));
    return `${url.hostname}${url.pathname}`.toLowerCase().replace(/\/+/g, '/');
  } catch {
    return clean(value, 1000).toLowerCase().split('?')[0];
  }
};

const candidateUrl = (value: unknown) => {
  if (value && typeof value === 'object') return clean((value as Record<string, unknown>).url, 1000);
  return clean(value, 1000);
};

const normalizeImageCandidate = (value: unknown): ImageCandidate | null => {
  const url = candidateUrl(value);
  if (!isUsableImage(url)) return null;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return {
      url,
      sourceTitle: clean(record.sourceTitle, 240),
      sourcePublisher: clean(record.sourcePublisher, 120),
      sourceUrl: clean(record.sourceUrl, 900),
      category: clean(record.category, 80),
      role: clean(record.role, 24),
    };
  }
  return { url };
};

const uniqueImageCandidates = (values: unknown[]) => {
  const seen = new Set<string>();
  const output: ImageCandidate[] = [];
  for (const value of values) {
    const candidate = normalizeImageCandidate(value);
    if (!candidate) continue;
    const key = imageKey(candidate.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
  }
  return output;
};

const tokenize = (value: unknown) =>
  clean(value, 1000)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 3 && !['para', 'como', 'sobre', 'mais', 'pela', 'pelo', 'entre', 'esta', 'esse', 'essa'].includes(term));

const semanticOverlap = (left: unknown, right: unknown) => {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const term of a) {
    if (b.has(term)) shared += 1;
  }
  return shared / Math.min(a.size, b.size);
};

const scoreImageCandidate = (candidate: ImageCandidate, title: string, category: string) => {
  const url = candidate.url;
  const lowerUrl = url.toLowerCase();
  const context = `${candidate.sourceTitle || ''} ${candidate.sourcePublisher || ''} ${candidate.category || ''}`;
  const terms = tokenize(`${title} ${category}`);
  let score = 0;
  if (/images\.unsplash\.com/.test(lowerUrl)) score -= 25;
  if (/\.(jpe?g|png|webp)(\?|$)/i.test(url)) score += 12;
  if (/(1200|1600|1920|large|xl|original|og|share|cover)/i.test(url)) score += 18;
  if (isBlockedImageUrl(url)) score -= 100;
  if (/(thumb_small|thumbnail|small|80x80|100x100|150x150)/i.test(url)) score -= 25;
  if (candidate.sourceTitle) score += Math.round(semanticOverlap(title, candidate.sourceTitle) * 70);
  if (candidate.category && clean(candidate.category, 80) === clean(category, 80)) score += 16;
  for (const term of new Set(terms)) {
    if (lowerUrl.includes(term)) score += 5;
    if (context.toLowerCase().includes(term)) score += 8;
  }
  if (category === 'Cinema' && /(movie|film|cinema|poster|still|serie|stream|cannes|hbo|max)/i.test(`${url} ${context}`)) score += 20;
  if (category === 'Futebol' && /(futebol|football|soccer|campo|jogo|time|club|stadium|estadio|brasileirao)/i.test(`${url} ${context}`)) score += 20;
  if (category === 'Moda' && /(fashion|moda|look|runway|dress|vestido|tendencia|passarela)/i.test(`${url} ${context}`)) score += 20;
  return score;
};

const chooseBestImage = (candidates: ImageCandidate[], title: string, category: string) => {
  const fallback = fallbackImageForCategory(category);
  const cleanCandidates = uniqueImageCandidates(candidates).filter((candidate) => imageKey(candidate.url) !== imageKey(fallback));
  const selectedCover = cleanCandidates.find((candidate) => candidate.role === 'cover' && !/images\.unsplash\.com/i.test(candidate.url));
  if (selectedCover) return selectedCover.url;
  return (
    cleanCandidates
      .map((candidate, index) => ({ candidate, index, score: scoreImageCandidate(candidate, title, category) - index }))
      .sort((a, b) => b.score - a.score)[0]?.candidate.url || fallback
  );
};

const chooseInlineImage = (candidates: ImageCandidate[], coverUrl: string, title: string, category: string) =>
  uniqueImageCandidates(candidates)
    .filter((candidate) => imageKey(candidate.url) !== imageKey(coverUrl) && !/images\.unsplash\.com/i.test(candidate.url))
    .sort((a, b) => (a.role === 'body' ? -1 : 0) - (b.role === 'body' ? -1 : 0))
    .map((candidate, index) => ({ candidate, index, score: (candidate.role === 'body' ? 1000 : 0) + scoreImageCandidate(candidate, title, category) - index }))
    .sort((a, b) => b.score - a.score)[0]?.candidate.url || '';

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

const clipWholeWord = (value: unknown, max: number) => {
  const text = plain(value, max + 80);
  if (text.length <= max) return text;
  const clipped = text.slice(0, max).replace(/\s+\S*$/, '').trim();
  return clipped || text.slice(0, max).trim();
};

const stripRadarPrefix = (value: unknown) =>
  clean(value, 220)
    .replace(/^Radar\s+[^:]{2,40}:\s*/i, '')
    .trim();

const hasInternalLeak = (value: unknown) =>
  /(?:pauta consolidada|fontes consolidadas|fontes monitoradas|entrou na fila|fila editorial|engine|prompt|cluster|modelo de seguran|rascunho exige|materia inedita antes da fila|mat[eé]ria in[eé]dita antes da fila|processo editorial|portal novo alvo registra|portal novo alvo)/i.test(plain(value, 6000));

const publicEditorialSummary = (title: string, category: string) => {
  const cleanTitle = stripRadarPrefix(title) || clean(title, 220);
  return `O caso em ${clean(category, 80) || 'Brasil'} exige identificacao do agente ativo, da causa imediata e da consequencia pratica: ${cleanTitle}.`;
};

const titleSimilarity = (left: unknown, right: unknown) => semanticOverlap(stripRadarPrefix(left), stripRadarPrefix(right));

const isBorrowedTitle = (title: unknown, sourceTitles: string[]) => {
  const candidate = stripRadarPrefix(title);
  const candidateKey = slugify(candidate);
  if (!candidateKey) return false;
  return sourceTitles.some((sourceTitle) => {
    const source = stripRadarPrefix(sourceTitle);
    const sourceKey = slugify(source);
    return sourceKey === candidateKey || titleSimilarity(candidate, source) >= 0.86;
  });
};

const originalTitleFromSignals = (result: Record<string, unknown>, fallbackTitle: string, category: string, sourceTitles: string[]) => {
  const activeAgent = clipWholeWord(result.active_agent || '', 44);
  const consequence = clipWholeWord(result.conflict_point || result.latent_cause || result.fact_static || '', 76);
  const fact = clipWholeWord(result.fact_static || fallbackTitle, 82);
  const categoryHooks: Record<string, string> = {
    Politica: 'O custo politico aparece',
    Economia: 'A conta chega ao bolso',
    Cinema: 'A regra do cinema muda',
    Tecnologia: 'O hype encontra o limite',
    Futebol: 'A pressao saiu do campo',
    Esportes: 'A margem de erro acabou',
    Famosos: 'A imagem virou ativo',
    Moda: 'A tendencia encontrou mercado',
    Educacao: 'A carreira entrou em choque',
  };

  const options = [
    activeAgent && consequence ? `${activeAgent}: ${consequence}` : '',
    activeAgent && fact ? `${activeAgent}: ${fact}` : '',
    `${categoryHooks[category] || 'O ponto de pressao'}: ${fact}`,
  ]
    .map((item) => clipWholeWord(stripRadarPrefix(item), 88))
    .filter(Boolean);

  return options.find((option) => !isBorrowedTitle(option, sourceTitles)) || clipWholeWord(options[0] || fallbackTitle, 88);
};

const pickCandidateImage = (value: unknown, candidates: ImageCandidate[], fallback: string) => {
  const requested = clean(value, 1000);
  if (!isUsableImage(requested)) return fallback;
  const requestedKey = imageKey(requested);
  const match = candidates.find((candidate) => imageKey(candidate.url) === requestedKey);
  return match?.url || fallback;
};

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
    .replace(/<(h2|h3)[^>]*>\s*(.*?)\s*<\/\1>/gi, (_match, tag, text) => `<${tag}>${clipWholeWord(text, 140)}</${tag}>`)
    .replace(/<p[^>]*>\s*([\s\S]*?)\s*<\/p>/gi, (_match, text) =>
      splitLongText(String(text).replace(/<[^>]+>/g, ' '))
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join(''),
    )
    .replace(/<blockquote[^>]*>\s*([\s\S]*?)\s*<\/blockquote>/gi, (_match, text) => `<blockquote>${escapeHtml(clipWholeWord(text, 520))}</blockquote>`)
    .replace(/<li[^>]*>\s*([\s\S]*?)\s*<\/li>/gi, (_match, text) => `<li>${escapeHtml(clipWholeWord(text, 220))}</li>`);

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

const insertInlineImage = (html: string, image: { src: string; alt: string; caption: string }, category: string) => {
  if (!image.src || /<figure[^>]+editorial-inline-image/i.test(html)) return html;

  const layout = ['wide', 'left', 'right'][
    Math.abs(slugify(`${category}-${image.src}`).split('').reduce((total, char) => total + char.charCodeAt(0), 0)) % 3
  ];
  const safeCaption = clean(image.caption, 180);
  const captionHtml = safeCaption ? `<figcaption>${escapeHtml(safeCaption)}</figcaption>` : '';
  const figure = `<figure class="editorial-inline-image editorial-inline-image--${layout}"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy" referrerpolicy="no-referrer" />${captionHtml}</figure>`;
  const paragraphs = [...html.matchAll(/<\/p>/gi)];
  if (paragraphs.length < 3) return `${html}${figure}`;

  const position = paragraphs[Math.min(2, Math.floor(paragraphs.length / 2))].index || html.length;
  return `${html.slice(0, position + 4)}${figure}${html.slice(position + 4)}`;
};

const stripLeadingDuplicateTitle = (html: string, title: string) => {
  const titleKey = slugify(title);
  if (!titleKey) return html;
  return html
    .replace(/^(\s*)<h[23][^>]*>\s*([\s\S]*?)\s*<\/h[23]>/i, (match, space, heading) =>
      slugify(heading) === titleKey ? String(space || '') : match,
    )
    .replace(/^(\s*)<p[^>]*>\s*([\s\S]*?)\s*<\/p>/i, (match, space, paragraph) =>
      slugify(plain(paragraph, 220)) === titleKey ? String(space || '') : match,
    )
    .trim();
};

const hasEditorialBody = (html: string) => {
  const text = plain(html, 5000);
  if (text.length < 450) return false;
  if (!/[.!?]"?$/.test(text)) return false;
  if (/<(?:p|h2|h3|strong|em|ul|ol|li|blockquote)\b[^>]*>\s*$/i.test(html)) return false;
  if (/(?:\b(?:a|o|de|do|da|dos|das|para|contra|com|sem|por|em|no|na|nos|nas|que|se|e|ou|mas|como|entre|sobre)\s*)$/i.test(text)) return false;
  if (/pauta consolidada por \d+ fontes/i.test(text)) return false;
  if (/o rascunho exige angulo proprio|o rascunho exige ângulo próprio/i.test(text)) return false;
  if (/fontes monitoradas|entrou na fila editorial|resumo editorial|cluster de dados/i.test(text)) return false;
  if (hasInternalLeak(text)) return false;
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
  fallback: {
    title: string;
    summary: string;
    bodyHtml: string;
    seoDescription: string;
    keywords: string;
    imageAlt?: string;
    imageCaption?: string;
  },
  env: Env,
) => {
  if (!env.GEMINI_API_KEY && !env.GROQ_API_KEY && !env.AI) {
    return {
      ...fallback,
      imageAlt: fallback.imageAlt || fallback.title,
      imageCaption: fallback.imageCaption || '',
      featuredImageUrl: '',
      inlineImageUrl: '',
      generatedWithAi: false,
      generationModel: 'fallback-editorial-template',
      generationError: 'IA editorial nao configurada.',
    };
  }

  const sources = parseArray(row.sources);
  const score = Number(row.score || 0);
  const sourceCount = Number(row.source_count || sources.length || 0);
  const premiumDraft = score > 800;
  const editorialTitle = stripRadarPrefix(row.title) || clean(row.title, 220);
  const sourceLines = sources
    .slice(0, 20)
    .map((source) => {
      if (!source || typeof source !== 'object') return '';
      const record = source as Record<string, unknown>;
      const excerpt = plain(record.excerpt, 1200);
      return [
        `- ${plain(record.publisher, 80)}: ${plain(record.title, 180)} (${plain(record.url, 400)})`,
        excerpt ? `  Trecho extraido da materia completa: ${excerpt}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .filter(Boolean)
    .join('\n');
  const sourceTitles = sources
    .map((source) => (source && typeof source === 'object' ? plain((source as Record<string, unknown>).title, 180) : ''))
    .filter(Boolean);
  const forbiddenTitles = [...new Set([row.title, editorialTitle, ...sourceTitles].map(stripRadarPrefix).filter(Boolean))]
    .slice(0, 24)
    .map((title) => `- ${title}`)
    .join('\n');

  const system =
    'Voce e um jornalista profissional de alto nivel. Gere uma materia completa, precisa, independente e publicavel. As personas, micro-personas e diretrizes sao calibragem interna: nunca cite marca do portal, NEXA, IA, prompt, modelo, cluster, Geracao X, Millennials, Gen Z, publico-alvo, fontes consolidadas ou processo editorial no texto publicado. Escreva em portugues do Brasil, com acentos corretos. Comece a resposta imediatamente com JSON puro e valido.';
  const imageCandidates = uniqueImageCandidates(parseArray(row.image_candidates)).slice(0, 10);
  const selectedImage = chooseBestImage(imageCandidates, editorialTitle, row.category);
  const imageLines = imageCandidates
    .map((candidate, index) => `${index + 1}. ${candidate.url} | pauta: ${plain(candidate.sourceTitle, 160)} | origem: ${plain(candidate.sourcePublisher, 80)}`)
    .join('\n');
  const prompt = `
PROMPT INTERNO: NEXA CORE ENGINE v11 - ACTIVE AGENT

Voce e um jornalista profissional de alto nivel. Sua funcao e transformar a apuracao em uma materia precisa, com fato escancarado, agente ativo identificado e consequencia concreta.

PERSONAS POR CATEGORIA (MODO DE ESPECIALISTA):
- BRASIL: "O Reporter de Campo". Foco em fatos nacionais, desdobramentos locais e o que impacta o dia a dia do cidadao brasileiro.
- MUNDO: "O Correspondente Internacional". Traduz eventos globais e geopoliticos, sempre explicando por que isso e relevante para o Brasil.
- POLITICA: "O Analista de Poder". Foco em bastidores, estrategia eleitoral e Follow the Money. Cetico com discursos oficiais.
- ECONOMIA: "O Estrategista Financeiro". Traduz indicadores, inflacao e mercado para o impacto direto no poder de compra do leitor.
- SAUDE: "O Consultor de Vida". Empatico, baseado em evidencias cientificas e focado em bem-estar e medicina pratica.
- TECNOLOGIA: "O Early Adopter". Critico com marketing, focado em utilidade digital, privacidade e specs reais.
- ESPORTES: "O Cronista Olimpico". Foco em alta performance, estatisticas taticas e superacao atletica.
- FAMOSOS: "O Observador Social". Analisa a economia da influencia e o impacto cultural das celebridades, fugindo da fofoca rasa.
- CINEMA: "O Critico de Cinema". Foco em roteiro, direcao, industria de streaming e tecnica cinematografica.
- ENTRETENIMENTO: "O Curador Pop". Analisa tendencias de consumo, eventos de massa e novos formatos de midia.
- CIENCIA: "O Divulgador Academico". Didatico, fascinado pelo cosmos e pela biologia, combatendo rigorosamente o negacionismo.
- EDUCACAO: "O Mentor de Carreira". Focado em vestibular, novas formas de aprendizado e o futuro do mercado de trabalho.
- CULTURA: "O Antropologo Urbano". Foco em artes, literatura e comportamento social.
- LIFESTYLE: "O Curador de Estilo". Foco em viagens, gastronomia e equilibrio entre vida e produtividade.
- GAMES: "O Hardcore Player". Analisa gameplay, industria e performance tecnica. Sem piedade com bugs de lancamento.
- MODA: "O Trend Hunter". Foco em design, sustentabilidade textil e comportamento de consumo.
- MUSICA: "O Critico Musical". Analisa producao sonora, mercado fonografico e movimentos ritmicos.
- FUTEBOL: "O Analista de Campo & Cifras". Foco em tatica, xG, transicoes, SAF e saude financeira dos clubes.

MICRO-PERSONAS DE ELITE:
- ESPORTES/FUTEBOL:
  1. Analise Tatica e Telemetria: mapas de calor, variacao de formacao, transicoes e inteligencia de campo.
  2. Gestao de Ativos: SAF, valuation, contratos, mercado e sombra digital de atletas.
  3. Visceral de Arquibancada: pressao psicologica, crise institucional, torcida e sobrevivencia politica.
  4. Scouting Neural: talentos subvalorizados, rastro tatico e probabilidade.
- TECNOLOGIA:
  1. Infraestrutura e IA: latencia, dados, chips, data centers e soberania de hardware.
  2. Seguranca Cibernetica: vulnerabilidades, incidentes, Zero-Day e resposta de rede.
  3. Economia Digital: M&A, rodadas de investimento e dominacao de mercado.
  4. Consumo e Gadgets: utilidade real, specs e revisao imparcial sem hype.
- ECONOMIA:
  1. Arbitragem Alpha: liquidez institucional e lucro excedente.
  2. Macroeconomia e Poder de Compra: inflacao, juros e impacto no bolso.
  3. Criptoativos e Web3: baleias, sentimento de mercado e descentralizacao.
- ENTRETENIMENTO/FAMOSOS/CINEMA/MUSICA/GAMES:
  1. Hegemonia Cultural: lancamentos como ativos de comportamento algoritimico.
  2. Gestao de Hype: sombra digital, crise de imagem e influencia social.
  3. Streaming & Tech-Ent: guerra das plataformas e dados de atencao.
- SAUDE:
  1. Bio-Inteligencia: medicina de precisao, custos reais e biotecnologia.
  2. Soberania Mental: resiliencia, incerteza psicologica e habitos praticos.
- MUNDO/BRASIL/POLITICA/CULTURA/EDUCACAO/LIFESTYLE/MODA/CIENCIA:
  1. Soberania Juridica: regulacao, diario oficial, dinheiro e poder.
  2. Geopolitica e Conflitos: logistica, economia e cadeias de suprimento.
  3. Campo Social: comportamento, trabalho, consumo, cultura e vida cotidiana.

CLASSIFICACAO PREVIA OBRIGATORIA:
- Antes de escrever, leia o conjunto inteiro de fontes e identifique a noticia central mais relevante. Nao assuma que a primeira fonte e a pauta principal.
- Use os dados como apuracao consolidada: cruze os trechos, descarte repeticao, priorize o dado exclusivo e construa uma materia inedita. Nunca explique esse processo ao leitor.
- Fato Estatico: o que aconteceu. Exemplo: "O preco subiu".
- Agente Ativo: quem causou, decidiu, moveu, perdeu ou ganhou. De nome aos bois.
- Causa Latente: por que isso aconteceu agora.
- Conflito: se houver divergencia entre governo, empresa, clube, usuarios ou mercado, exponha como ponto central.
- Micro-persona: escolha uma das micro-personas acima e use como lente do texto.

ESTRUTURA PADRONIZADA (OBRIGATORIA):
1. TITULO: direto, impactante e otimizado para SEO. Maximo de 65 caracteres.
   Nunca use o prefixo "Radar" no titulo final, salvo se Radar for nome proprio do fato.
   O titulo final deve ser autoral do Portal Novo Alvo. E proibido copiar, parafrasear de perto ou manter a mesma estrutura de qualquer titulo das fontes.
   Se uma fonte diz "X gera Y", crie uma sintese propria com agente ativo, consequencia e tensao editorial.
2. LIDE: 5W2H em no maximo 3 frases curtas. Va direto ao ponto.
3. CORPO DO TEXTO: subtitulos <h2> a cada cerca de 200 palavras. Sentencas curtas, no maximo 20 palavras. Use <strong> em termos cruciais.
4. SECAO "POR QUE ISSO IMPORTA": bloco final em <blockquote>. De um passo atras da noticia, analise com ceticismo, projete impacto futuro e entregue o veredito editorial.

ESTILO EDITORIAL (EEAT):
- Tom analitico, levemente acido, independente e focado em utilidade.
- Proibido usar adjetivos vazios como "incrivel" ou "magico". Use fatos e dados.
- Publico interno de calibragem: Millennials e Gen Z precisam de leitura rapida; Gen X e Boomers precisam de clareza e seriedade.
- Nao cite essas geracoes no texto final. Elas sao apenas parametros de estilo.
- Proibido subjetivismo: nao use "muitos acreditam", "parece ser", "pode indicar" sem base factual.
- Foco em consequencia: se uma lei, decisao, negocio, jogo ou crise aconteceu, explique quem ganha e quem perde dinheiro, poder, tempo, reputacao ou vantagem competitiva.
- Identifique pessoas, clubes, empresas, marcas, orgaos, cargos, valores e datas quando esses dados aparecerem nas fontes. Nao esconda nomes proprios em abstracoes.

REGRAS DE NULIFICACAO (INVIOLAVEIS):
- Proibido listar "quem esta passando o que" como inventario. Transforme lista em narrativa.
- Proibido citar portais concorrentes no corpo do texto.
- Proibido citar marcas como origem editorial do dado, salvo quando a propria marca for o objeto da noticia.
- Proibido usar frases de IA padrao: "No vasto cenario", "Vale ressaltar", "Alem disso", "Em suma".
- Proibido usar marcadores de depuracao como <3>, asteriscos ou markdown.
- Use apenas HTML limpo no content_html: <p>, <h2>, <h3>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>.

REGRA DE PROMESSA DA MANCHETE:
- Se a pauta prometer quantidade ("10 filmes", "8 jogos", "5 pontos"), a materia deve cumprir essa promessa.
- Nao transforme em inventario seco, mas cite ou agrupe os itens suficientes para o leitor sentir que a selecao foi realmente coberta.
- Se os nomes dos itens aparecerem nas fontes, use esses nomes no texto. Se faltarem nomes, explique o eixo editorial da selecao sem fingir informacao inexistente.

FORMATO EDITORIAL FINAL:
- Escreva uma materia completa, nao um resumo de pauta.
- Nunca mencione IA, modelo, prompt, cluster, fontes consolidadas, quantidade de fontes, fila, engine, pauta ou processo interno no texto publicado.
- O campo [RESUMO] abaixo e contexto operacional. Nao copie, nao parafraseie e nao transforme esse texto em lide.
- O primeiro paragrafo deve abrir com o dado mais forte.
- Use 7 a 11 paragrafos curtos, com 1 a 3 frases por paragrafo.
- Use <h2> para divisorias fortes e <h3> apenas quando fizer sentido.
- Feche obrigatoriamente com <blockquote>Por que isso importa: ...</blockquote>.
- Nao termine o texto no meio de uma frase. O content_html precisa fechar com pontuacao final clara e tags HTML completas.

REGRAS DE IMAGEM:
- Escolha featured_image_url apenas entre as imagens candidatas listadas.
- A capa deve retratar o Agente Ativo da noticia, nao apenas o tema generico.
- Escolha secondary_image_url apenas se ela ajudar a provar o fato no corpo do texto: documento, local, produto, jogo, pessoa, objeto ou cena relacionada.
- Se nenhuma candidata for segura ou coerente, deixe o campo vazio. Nao invente URL.
- image_alt deve descrever o fato e o agente ativo com precisao jornalistica.
- image_credit deve ser credito curto da imagem escolhida. Use a origem/autoria real quando estiver clara. Nunca repita o alt como credito. Nao invente autor.

DADOS DO CLUSTER:
[CATEGORIA]: ${row.category}
[PAUTA]: ${editorialTitle}
[TITULO INTERNO DA FILA]: ${row.title}
[RESUMO]: ${row.summary}
[PALAVRAS-CHAVE]: ${row.keywords}
[SCORE EDITORIAL]: ${score}
[FONTES CONSOLIDADAS]: ${sourceCount}
[IMAGEM ESCOLHIDA PARA CAPA]: ${selectedImage}
[IMAGENS CANDIDATAS COM CONTEXTO]:
${imageLines || 'Sem imagens candidatas.'}
[TITULOS PROIBIDOS PARA COPIA]:
${forbiddenTitles || 'Sem titulos listados.'}
[FONTES]:
${sourceLines || 'Fontes nao listadas.'}

Responda exatamente neste formato, com JSON valido e sem markdown:
{"title":"...","slug":"...","meta_description":"...","fact_static":"...","active_agent":"...","latent_cause":"...","conflict_point":"...","micro_persona":"...","featured_image_url":"...","secondary_image_url":"...","image_alt":"...","image_credit":"...","content_html":"..."}
`;

  try {
    const provider = clean(env.EDITORIAL_AI_PROVIDER, 24).toLowerCase();
    let generationModel = '';
    let result: Record<string, unknown> | null = null;
    let lastGenerationError = '';

    const runGeminiDraft = async () => {
      const gemini = await runGeminiJson({
        apiKey: env.GEMINI_API_KEY,
        model: premiumDraft ? DEFAULT_GEMINI_MODEL : env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
        system,
        prompt,
        maxOutputTokens: premiumDraft ? 7600 : 6200,
        temperature: premiumDraft ? 0.28 : 0.35,
      });
      generationModel = gemini.model;
      return gemini.result;
    };

    const runGroqDraft = async () => {
      const groq = await runGroqJson({
        apiKey: env.GROQ_API_KEY,
        model: env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
        system,
        prompt,
        maxOutputTokens: premiumDraft ? 7600 : 6200,
        temperature: premiumDraft ? 0.24 : 0.32,
      });
      generationModel = groq.model;
      return groq.result;
    };

    const runWorkersDraft = async () => {
      const response = await env.AI!.run(WORKERS_AI_MODEL, {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1400,
        temperature: 0.35,
      });
      generationModel = WORKERS_AI_MODEL;
      return parseModelJson(extractText(response));
    };

    const runners =
      provider === 'groq'
        ? [
            env.GROQ_API_KEY ? runGroqDraft : null,
            env.GEMINI_API_KEY ? runGeminiDraft : null,
            env.AI ? runWorkersDraft : null,
          ]
        : [
            env.GEMINI_API_KEY ? runGeminiDraft : null,
            env.GROQ_API_KEY ? runGroqDraft : null,
            env.AI ? runWorkersDraft : null,
          ];

    for (const runner of runners) {
      if (!runner) continue;
      try {
        result = await runner();
        break;
      } catch (error) {
        lastGenerationError = error instanceof Error ? error.message : 'Falha desconhecida no provedor de IA.';
      }
    }

    if (!result) throw new Error(lastGenerationError || 'Nenhum provedor de IA conseguiu gerar a materia.');

    const generatedBody = htmlFromModelField(
      result.content_html || result.bodyHtml || result.contentHtml || result.content || result.article || result.text,
    );
    if (!hasEditorialBody(generatedBody)) {
      throw new Error('Gemini respondeu sem uma materia editorial completa em content_html.');
    }
    if (hasInternalLeak(result.title) || hasInternalLeak(result.summary || result.meta_description)) {
      throw new Error('Gemini vazou instrucoes internas no titulo ou resumo.');
    }

    const featuredImageUrl = pickCandidateImage(
      result.featured_image_url || result.featuredImageUrl,
      imageCandidates,
      selectedImage,
    );
    const secondaryImageUrl = pickCandidateImage(
      result.secondary_image_url || result.secondaryImageUrl || result.inline_image_url || result.inlineImageUrl,
      imageCandidates,
      '',
    );
    const rawCleanTitle = stripRadarPrefix(result.title) || fallback.title;
    const cleanTitle = isBorrowedTitle(rawCleanTitle, sourceTitles)
      ? originalTitleFromSignals(result, fallback.title, row.category, sourceTitles)
      : rawCleanTitle;

    return {
      title: clipWholeWord(cleanTitle, 220) || fallback.title,
      summary: clipWholeWord(result.summary || result.meta_description, 700) || fallback.summary,
      seoDescription: clipWholeWord(result.meta_description || result.seoDescription, 155) || fallback.seoDescription,
      keywords: plain(result.keywords, 700) || fallback.keywords,
      imageAlt: clipWholeWord(result.image_alt || result.imageAlt, 180) || fallback.title,
      imageCaption: clipWholeWord(result.image_credit || result.imageCredit, 180) || imageCreditFor(featuredImageUrl, imageCandidates),
      featuredImageUrl,
      inlineImageUrl: secondaryImageUrl,
      bodyHtml: stripLeadingDuplicateTitle(generatedBody, clipWholeWord(cleanTitle, 180) || fallback.title),
      generatedWithAi: true,
      generationModel,
      generationError: '',
    };
  } catch (error) {
    return {
      ...fallback,
      imageAlt: fallback.imageAlt || fallback.title,
      imageCaption: '',
      featuredImageUrl: '',
      inlineImageUrl: '',
      generatedWithAi: false,
      generationModel:
        clean(env.EDITORIAL_AI_PROVIDER, 24).toLowerCase() === 'groq'
          ? env.GROQ_MODEL || DEFAULT_GROQ_MODEL
          : env.GEMINI_API_KEY
            ? env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
            : env.GROQ_API_KEY
              ? env.GROQ_MODEL || DEFAULT_GROQ_MODEL
              : WORKERS_AI_MODEL,
      generationError: error instanceof Error ? error.message : 'Falha desconhecida na geracao por IA.',
    };
  }
};

export const buildArticlePayload = async (row: QueueRow, env: Env) => {
  const sources = parseArray(row.sources);
  const tags = parseArray(row.tags).map(String).filter(Boolean);
  const imageCandidates = await enrichImageCandidatesFromSources(
    uniqueImageCandidates(parseArray(row.image_candidates)),
    sources,
    row.category,
  );
  const title = stripRadarPrefix(row.title) || clean(row.title, 220);
  const coverUrl = chooseBestImage(imageCandidates, title, row.category);
  const inlineImageUrl = chooseInlineImage(imageCandidates, coverUrl, title, row.category);
  const sourceNames = [
    ...new Set(
      sources
        .map((source) => (source && typeof source === 'object' ? (source as Record<string, unknown>).publisher : ''))
        .map((source) => clean(source, 120))
        .filter(Boolean),
    ),
  ];
  const summary = hasInternalLeak(row.summary) ? publicEditorialSummary(title, row.category) : clean(row.summary, 700) || publicEditorialSummary(title, row.category);
  const slug = slugify(title);
  const publishedAt = new Date().toISOString();
  const bodyHtml = '';
  const rowWithEnrichedImages = {
    ...row,
    image_candidates: JSON.stringify(imageCandidates),
  };
  const aiArticle = await generateArticleWithAi(
    rowWithEnrichedImages,
    {
      title,
      summary,
      bodyHtml,
      seoDescription: summary.slice(0, 155),
      keywords: clean(row.keywords, 700),
      imageAlt: title,
      imageCaption: '',
    },
    env,
  );
  if (!aiArticle.generatedWithAi || !hasEditorialBody(aiArticle.bodyHtml)) {
    return {
      id: `article:${slug}`,
      slug,
      title,
      summary,
      bodyHtml: '',
      category: row.category || 'Brasil',
      author: 'Redação Novo Alvo',
      status: 'draft',
      coverUrl: '',
      coverAlt: title,
      coverCaption: '',
      seoDescription: summary.slice(0, 155),
      keywords: clean(row.keywords, 700),
      tags,
      sources: sourceNames,
      media: [],
      readingMinutes: 1,
      publishedAt,
      generatedWithAi: false,
      generationModel: aiArticle.generationModel,
      generationTier: Number(row.score || 0) > 800 ? 'nexa-premium' : 'standard',
      generationError: aiArticle.generationError || 'A materia nao passou na validacao editorial.',
    };
  }
  const finalCoverUrl = aiArticle.featuredImageUrl || coverUrl;
  const finalInlineImageUrl = aiArticle.inlineImageUrl || chooseInlineImage(imageCandidates, finalCoverUrl, aiArticle.title || title, row.category) || inlineImageUrl;

  return {
    id: `article:${slug}`,
    slug,
    title: aiArticle.title,
    summary: aiArticle.summary,
    bodyHtml: insertInlineImage(
      aiArticle.bodyHtml,
      {
        src: finalInlineImageUrl,
        alt: aiArticle.imageAlt || aiArticle.title,
        caption: '',
      },
      row.category,
    ),
    category: row.category || 'Brasil',
    author: 'Redação Novo Alvo',
    status: 'published',
    coverUrl: finalCoverUrl,
    coverAlt: aiArticle.imageAlt || aiArticle.title,
    coverCaption: aiArticle.imageCaption || imageCreditFor(finalCoverUrl, imageCandidates),
    seoDescription: aiArticle.seoDescription,
    keywords: aiArticle.keywords,
    tags,
    sources: sourceNames,
    media: [finalCoverUrl, ...imageCandidates.map((candidate) => candidate.url).filter((src) => src !== finalCoverUrl && isUsableImage(src))].filter(Boolean).map((src) => ({
      src,
      type: 'image',
      role: src === finalCoverUrl ? 'cover' : src === finalInlineImageUrl ? 'body' : 'candidate',
      alt: src === finalCoverUrl || src === finalInlineImageUrl ? aiArticle.imageAlt || aiArticle.title : '',
      caption: src === finalCoverUrl ? aiArticle.imageCaption || imageCreditFor(src, imageCandidates) : '',
      credit: imageCreditFor(src, imageCandidates),
    })),
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
      if (!(article as { generatedWithAi?: boolean }).generatedWithAi) {
        throw new Error((article as { generationError?: string }).generationError || 'Materia bloqueada pela validacao editorial.');
      }
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
