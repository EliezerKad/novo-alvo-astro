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

type Env = {
  EDITORIAL_DB?: D1Database;
  ADMIN_TOKEN?: string;
  GEMINI_API_KEY?: string;
  GEMINI_API_KEYS?: string;
  GEMINI_MODEL?: string;
  GEMINI_FALLBACK_MODELS?: string;
  BING_IMAGE_SEARCH_KEY?: string;
  BING_IMAGE_SEARCH_ENDPOINT?: string;
  BING_IMAGE_LICENSE?: string;
  QUEUE_MAX_AGE_HOURS?: string;
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

const fallbackImageForCategory = (_category: unknown) => '';

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
  if (/images\.unsplash\.com/i.test(url)) return false;
  if (/\.(svg|gif|ico)(\?|$)/i.test(url)) return false;
  if (isBlockedImageUrl(url)) return false;
  return true;
};

const enrichImageCandidatesFromSources = async (candidates: ImageCandidate[]) => candidates;

const blockedBingHosts = /(unsplash\.com|pexels\.com|pixabay\.com|freepik\.com|shutterstock\.com|alamy\.com|istockphoto\.com|dreamstime\.com|depositphotos\.com|gettyimages\.com)$/i;

const bingQueryFor = (title: string, category: string) => {
  const terms = tokenize(`${title} ${category}`)
    .filter((term) => !['radar', 'noticia', 'noticias'].includes(term))
    .slice(0, 8)
    .join(' ');
  const categoryHint = category === 'Futebol' ? 'futebol Brasil' : category === 'Cinema' ? 'cinema filme' : category;
  return `${terms || title} ${categoryHint} noticia`;
};

const hostFromUrl = (value: unknown) => {
  try {
    return new URL(clean(value, 1000)).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const searchBingImageCandidates = async (row: QueueRow, env: Env): Promise<ImageCandidate[]> => {
  const key = clean(env.BING_IMAGE_SEARCH_KEY, 300);
  if (!key) return [];

  const endpoint = clean(env.BING_IMAGE_SEARCH_ENDPOINT, 400) || 'https://api.bing.microsoft.com/v7.0/images/search';
  const url = new URL(endpoint);
  url.searchParams.set('q', bingQueryFor(stripRadarPrefix(row.title) || row.title, row.category));
  url.searchParams.set('count', '8');
  url.searchParams.set('mkt', 'pt-BR');
  url.searchParams.set('safeSearch', 'Strict');
  url.searchParams.set('imageType', 'Photo');
  url.searchParams.set('size', 'Large');
  url.searchParams.set('freshness', 'Month');
  const license = clean(env.BING_IMAGE_LICENSE, 40);
  if (license) url.searchParams.set('license', license);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { value?: Array<Record<string, unknown>> };
    return (data.value || [])
      .map((item) => {
        const contentUrl = clean(item.contentUrl, 1200);
        const hostPageUrl = clean(item.hostPageUrl, 1200);
        const host = hostFromUrl(hostPageUrl || contentUrl);
        return {
          url: contentUrl,
          sourceTitle: clean(item.name, 240),
          sourcePublisher: host || 'Bing Images',
          sourceUrl: hostPageUrl,
          category: row.category,
          role: 'cover',
        };
      })
      .filter((candidate) => isUsableImage(candidate.url) && !blockedBingHosts.test(hostFromUrl(candidate.sourceUrl || candidate.url)))
      .slice(0, 8);
  } catch {
    return [];
  }
};

const wikipediaQueryFor = (title: string, category: string) => {
  const terms = tokenize(`${title} ${category}`)
    .filter((term) => !['radar', 'noticia', 'noticias', 'portal'].includes(term))
    .slice(0, 7)
    .join(' ');
  return terms || clean(title, 140);
};

const searchWikipediaImageCandidates = async (row: QueueRow): Promise<ImageCandidate[]> => {
  const query = wikipediaQueryFor(stripRadarPrefix(row.title) || row.title, row.category);
  if (!query) return [];
  const url = new URL('https://pt.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', query);
  url.searchParams.set('gsrlimit', '5');
  url.searchParams.set('prop', 'pageimages|info');
  url.searchParams.set('pithumbsize', '1600');
  url.searchParams.set('pilicense', 'any');
  url.searchParams.set('inprop', 'url');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  try {
    const response = await fetch(url.toString(), {
      headers: { accept: 'application/json', 'user-agent': 'PortalNovoAlvoEditorial/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { query?: { pages?: Record<string, Record<string, unknown>> } };
    return Object.values(data.query?.pages || {})
      .map((page) => {
        const thumbnail = page.thumbnail && typeof page.thumbnail === 'object' ? (page.thumbnail as Record<string, unknown>) : {};
        return {
          url: clean(thumbnail.source, 1200),
          sourceTitle: clean(page.title, 240),
          sourcePublisher: 'Wikimedia Commons',
          sourceUrl: clean(page.fullurl, 1200),
          category: row.category,
          role: 'cover',
        };
      })
      .filter((candidate) => isUsableImage(candidate.url))
      .slice(0, 4);
  } catch {
    return [];
  }
};

const dynamicUnsplashCandidate = (row: QueueRow): ImageCandidate[] => {
  const title = stripRadarPrefix(row.title) || row.title;
  const terms = tokenize(`${title} ${row.category}`)
    .filter((term) => !['radar', 'noticia', 'noticias', 'portal'].includes(term))
    .slice(0, 6);
  const categoryMap: Record<string, string[]> = {
    Futebol: ['soccer', 'stadium', 'football'],
    Esportes: ['athlete', 'sport', 'competition'],
    Cinema: ['cinema', 'movie', 'film'],
    Games: ['gaming', 'console', 'technology'],
    Musica: ['concert', 'music', 'stage'],
    Moda: ['fashion', 'runway', 'style'],
    Economia: ['business', 'finance', 'market'],
    Tecnologia: ['technology', 'data', 'hardware'],
    Saude: ['healthcare', 'medicine', 'wellness'],
    Educacao: ['education', 'classroom', 'students'],
    Mundo: ['world', 'city', 'geopolitics'],
    Brasil: ['brazil', 'city', 'people'],
    Politica: ['government', 'congress', 'politics'],
  };
  const query = [...terms, ...(categoryMap[row.category] || [row.category])]
    .slice(0, 9)
    .join(',');
  if (!query) return [];
  return [
    {
      url: `https://source.unsplash.com/1600x900/?${encodeURIComponent(query)}`,
      sourceTitle: title,
      sourcePublisher: 'Unsplash',
      sourceUrl: 'https://unsplash.com',
      category: row.category,
      role: 'cover',
    },
  ];
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
  if (/source\.unsplash\.com/.test(lowerUrl)) score -= 8;
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
  if (/wikimedia|wikipedia/i.test(context)) score += 10;
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
    .filter((candidate) => imageKey(candidate.url) !== imageKey(coverUrl) && !/images\.unsplash\.com/i.test(candidate.url) && !/source\.unsplash\.com/i.test(candidate.url))
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

const memoryTokens = (value: unknown) => {
  const blocked = new Set(['para', 'com', 'uma', 'das', 'dos', 'que', 'por', 'sobre', 'apos', 'entre', 'como', 'mais', 'radar', 'veja', 'confira', 'onde', 'hoje']);
  return clean(value, 1000)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token, index, values) => token.length > 3 && !blocked.has(token) && values.indexOf(token) === index)
    .slice(0, 9);
};

const memorySubjectKey = (row: Pick<QueueRow, 'category' | 'title' | 'summary' | 'tags' | 'keywords'>) => {
  const tokens = memoryTokens(`${row.title} ${row.summary} ${parseArray(row.tags).join(' ')} ${row.keywords}`);
  return `${slugify(row.category) || 'geral'}:${tokens.length >= 3 ? tokens.join('-') : slugify(row.title)}`;
};

const missingMemoryTable = (error: unknown) =>
  String(error instanceof Error ? error.message : error).toLowerCase().includes('no such table: editorial_memory');

const markMemoryPublished = async (db: D1Database, row: QueueRow, articleSlug: string) => {
  const subjectKey = memorySubjectKey(row);
  const now = new Date().toISOString();
  try {
    await db
      .prepare(
        `INSERT INTO editorial_memory (
          id, subject_key, category, title, status, source_count, strength,
          first_seen_at, last_seen_at, last_pitch_id, article_slug, metadata, expires_at
        ) VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, '')
        ON CONFLICT(subject_key) DO UPDATE SET
          status = 'published',
          source_count = MAX(editorial_memory.source_count, excluded.source_count),
          strength = MAX(editorial_memory.strength, excluded.strength),
          last_seen_at = excluded.last_seen_at,
          last_pitch_id = excluded.last_pitch_id,
          article_slug = excluded.article_slug,
          metadata = excluded.metadata,
          expires_at = ''`,
      )
      .bind(
        `memory:${subjectKey}`,
        subjectKey,
        row.category || 'Brasil',
        row.title || articleSlug,
        Number(row.source_count || 0),
        Number(row.score || 0),
        now,
        now,
        row.pitch_id,
        articleSlug,
        JSON.stringify({ keywords: row.keywords || '', tags: parseArray(row.tags) }),
      )
      .run();
  } catch (error) {
    if (!missingMemoryTable(error)) throw error;
  }
};

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

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(Number.parseInt(code, 16)));

const textFromHtmlFragment = (value: unknown, max = 2000) =>
  decodeHtmlEntities(plain(value, max));

const isGoogleNewsUrl = (value: unknown) => {
  try {
    const url = new URL(clean(value, 1400));
    return /(^|\.)news\.google\./i.test(url.hostname) && /\/(?:rss\/)?(?:articles|read)\//i.test(url.pathname);
  } catch {
    return false;
  }
};

const googleNewsArticleId = (value: unknown) => {
  try {
    const url = new URL(clean(value, 1400));
    if (!/(^|\.)news\.google\./i.test(url.hostname)) return '';
    return (url.pathname.split('/').filter(Boolean).pop() || '').replace(/[^A-Za-z0-9_-]/g, '');
  } catch {
    return '';
  }
};

const fetchTextWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 6500) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      redirect: options.redirect || 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const googleNewsDecodePayload = (html: string) => {
  const dataP = html.match(/<c-wiz\b[^>]*\bdata-p=["']([^"']+)["']/i)?.[1] || '';
  if (!dataP) return '';
  try {
    const params = JSON.parse(decodeHtmlEntities(dataP).replace('%.@.', '["garturlreq",'));
    if (!Array.isArray(params) || params.length < 5) return '';
    return JSON.stringify([[['Fbv4je', JSON.stringify([params[0], params[2], params[1], params[params.length - 2], params[params.length - 1]]), 'null', 'generic']]]);
  } catch {
    return '';
  }
};

const googleNewsSignaturePayload = (html: string, articleId: string) => {
  const signature = html.match(/\bdata-n-a-sg=["']([^"']+)["']/i)?.[1] || '';
  const timestamp = html.match(/\bdata-n-a-ts=["']([^"']+)["']/i)?.[1] || '';
  if (!signature || !timestamp || !articleId) return '';

  const request = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${articleId}",${timestamp},"${signature}"]`;
  return JSON.stringify([[['Fbv4je', request]]]);
};

const parseGoogleNewsDecodedUrl = (value: string) => {
  const block = value.split('\n\n').find((item) => item.trim().startsWith('[') && item.includes('http')) || '';
  const line =
    block ||
    value
      .split('\n')
      .map((item) => item.trim())
      .find((item) => item.startsWith('[') && item.includes('http'));
  if (!line) return '';
  try {
    const outer = JSON.parse(line);
    const parsed = Array.isArray(outer) ? outer.slice(0, -2) : outer;
    const inner = JSON.parse(parsed?.[0]?.[2] || outer?.[0]?.[2] || '[]');
    const decoded = inner?.[1] || inner?.[0]?.[1] || '';
    return /^https?:\/\//i.test(decoded) ? decoded : '';
  } catch {
    const match = line.match(/https?:\/\/[^"\\]+/i);
    return match ? match[0].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&') : '';
  }
};

const decodeGoogleNewsUrl = async (value: string) => {
  const id = googleNewsArticleId(value);
  if (!id) return '';

  for (const path of [`https://news.google.com/articles/${id}`, `https://news.google.com/rss/articles/${id}`]) {
    try {
      const response = await fetchTextWithTimeout(
        path,
        {
          headers: {
            accept: 'text/html,application/xhtml+xml',
            'accept-language': 'pt-BR,pt;q=0.9,en;q=0.6',
            'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) PortalNovoAlvo/1.0 Safari/537.36',
          },
        },
        6500,
      );
      const html = await response.text();
      const payload = googleNewsDecodePayload(html) || googleNewsSignaturePayload(html, id);
      if (!payload) continue;

      const decodedResponse = await fetchTextWithTimeout(
        'https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je',
        {
          method: 'POST',
          headers: {
            accept: '*/*',
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            referer: 'https://news.google.com/',
            'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) PortalNovoAlvo/1.0 Safari/537.36',
          },
          body: new URLSearchParams({ 'f.req': payload }),
        },
        6500,
      );
      if (!decodedResponse.ok) continue;
      const decoded = parseGoogleNewsDecodedUrl(await decodedResponse.text());
      if (decoded && !isGoogleNewsUrl(decoded)) return decoded;
    } catch {}
  }

  return '';
};

const extractJsonLdArticleText = (html: string) => {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const values: string[] = [];
  const pushArticleFields = (item: unknown) => {
    if (!item || typeof item !== 'object') return;
    const record = item as Record<string, unknown>;
    const type = Array.isArray(record['@type']) ? record['@type'].join(' ') : String(record['@type'] || '');
    if (/NewsArticle|Article|ReportageNewsArticle|BlogPosting/i.test(type)) {
      values.push(plain(record.headline, 300), plain(record.description, 900), plain(record.articleBody, 5000));
    }
    for (const nested of Object.values(record)) {
      if (Array.isArray(nested)) nested.forEach(pushArticleFields);
      else if (nested && typeof nested === 'object') pushArticleFields(nested);
    }
  };

  for (const block of blocks.slice(0, 12)) {
    const raw = decodeHtmlEntities(block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim());
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) parsed.forEach(pushArticleFields);
      else pushArticleFields(parsed);
    } catch {}
  }

  return values.filter(Boolean).join(' ');
};

const extractArticleTextFromHtml = (html: string) => {
  const structured = extractJsonLdArticleText(html);
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(?:svg|canvas|picture|video|iframe|form|button|header|footer|nav|aside)[\s\S]*?<\/(?:svg|canvas|picture|video|iframe|form|button|header|footer|nav|aside)>/gi, ' ');

  const articleMatch = withoutNoise.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = withoutNoise.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const classMatch = withoutNoise.match(/<div\b[^>]+class=["'][^"']*(?:post-content|entry-content|article-content|content-text|materia|noticia|news-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const source = articleMatch?.[1] || classMatch?.[1] || mainMatch?.[1] || withoutNoise;
  const paragraphs = [...source.matchAll(/<(?:p|h1|h2|h3|li)\b[^>]*>([\s\S]*?)<\/(?:p|h1|h2|h3|li)>/gi)]
    .map((match) => decodeHtmlEntities(plain(match[1], 1200)))
    .filter((text) => text.length > 55)
    .filter((text) => !/(cookies?|newsletter|publicidade|assine|compartilhe|leia tamb[eé]m|todos os direitos|clique aqui)/i.test(text));

  const text = [structured, paragraphs.length >= 2 ? paragraphs.join(' ') : decodeHtmlEntities(plain(source, 9000))]
    .filter(Boolean)
    .join(' ');
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length >= 320 ? clipWholeWord(compact, 2800) : '';
};

const sourceArticleUrls = async (record: Record<string, unknown>) => {
  const rawUrls = [record.primaryUrl, record.originalUrl, record.url, record.link, record.href]
    .map((value) => clean(value, 1400))
    .filter((value, index, list) => /^https?:\/\//i.test(value) && list.indexOf(value) === index);

  const urls: string[] = [];
  for (const url of rawUrls) {
    if (isGoogleNewsUrl(url)) {
      const decoded = await decodeGoogleNewsUrl(url);
      if (decoded) return [decoded];
      continue;
    }
    return [url];
  }
  return urls;
};

const fetchSourceExcerpt = async (source: unknown) => {
  if (!source || typeof source !== 'object') return source;
  const record = source as Record<string, unknown>;
  if (plain(record.excerpt, 400).length >= 260) return record;
  const urls = await sourceArticleUrls(record);

  for (const url of urls) {
    if (isGoogleNewsUrl(url)) continue;
    try {
      const response = await fetchTextWithTimeout(
        url,
        {
          headers: {
            accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
            'accept-language': 'pt-BR,pt;q=0.9,en;q=0.6',
            'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) PortalNovoAlvo/1.0 Safari/537.36',
          },
        },
        8000,
      );
      if (!response.ok) continue;
      const contentType = response.headers.get('content-type') || '';
      if (!/html|text/i.test(contentType)) continue;
      const html = await response.text();
      const excerpt = extractArticleTextFromHtml(html);
      if (excerpt) {
        return {
          ...record,
          excerpt,
          resolvedUrl: response.url && !isGoogleNewsUrl(response.url) ? response.url : url,
        };
      }
    } catch {}
  }

  return record;
};

const hasUsefulExcerpt = (source: unknown) =>
  !!source &&
  typeof source === 'object' &&
  plain((source as Record<string, unknown>).excerpt, 1200).length >= 500;

const enrichSourcesWithText = async (sources: unknown[]) => {
  const enriched = [...sources];
  let usefulExcerpts = 0;

  for (let index = 0; index < Math.min(12, sources.length); index += 1) {
    enriched[index] = await fetchSourceExcerpt(sources[index]);
    if (hasUsefulExcerpt(enriched[index])) usefulExcerpts += 1;
    if (usefulExcerpts >= 6) break;
  }

  return enriched;
};

const sourceEvidenceText = (record: Record<string, unknown>) =>
  [
    plain(record.excerpt, 1600),
    plain(record.summary, 700),
    plain(record.description, 700),
    plain(record.content, 900),
    plain(record.title, 240),
  ]
    .filter(Boolean)
    .join(' ');

const factSignalsFrom = (value: string) => {
  const text = decodeHtmlEntities(plain(value, 2600));
  const numbers = [
    ...text.matchAll(
      /\b(?:\d{1,3}(?:[.,]\d{3})*(?:,\d+)?|\d+)\s*(?:anos?|meses?|dias?|horas?|kg|gramas?|mil[ií]metros?|calibre|mortes?|feridos?|tiros?|passagens?|ve[ií]culos?|pessoas?|%)\b/gi,
    ),
  ].map((match) => match[0]);
  const money = [...text.matchAll(/R\$\s?\d[\d.,]*(?:\s?(?:mil|milh[oõ]es|bilh[oõ]es))?/gi)].map((match) => match[0]);
  const dates = [
    ...text.matchAll(/\b(?:segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)\s*\(\d{1,2}\)|\b\d{1,2}\s+de\s+[a-zç]+|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi),
  ].map((match) => match[0]);
  const largeValues = [
    ...text.matchAll(/\b\d[\d.,]*\s*(?:bilh[oÃµ]es|milh[oÃµ]es|trilh[oÃµ]es)\s+de\s+(?:d[oÃó]lares|euros|reais|yuan|rublos)\b/gi),
    ...text.matchAll(/(?:R\$|US\$|€)\s?\d[\d.,]*(?:\s?(?:mil|milh[oÃµ]es|bilh[oÃµ]es|trilh[oÃµ]es))?/gi),
  ].map((match) => match[0]);
  const years = [...text.matchAll(/\b20\d{2}\b/g)].map((match) => match[0]);
  const names = [
    ...text.matchAll(
      /\b[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ][A-Za-zÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇáàâãéèêíïóôõöúç]{2,}(?:\s+(?:d[aeo]s?|e|do|da|dos|das|de|[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ][A-Za-zÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇáàâãéèêíïóôõöúç]{2,})){0,5}/g,
    ),
  ]
    .map((match) => match[0])
    .filter((name) => !/^(Segundo|Conforme|Durante|Ainda|Outro|Uma|Dois|Com|No|Na|Em|Por|Leia Tamb[eé]m)$/i.test(name));
  return [...new Set([...names, ...numbers, ...money, ...largeValues, ...dates, ...years])].slice(0, 28);
};

const normalizeForPresence = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const containsName = (text: string, name: string) => {
  const normalizedText = ` ${normalizeForPresence(text)} `;
  const normalizedName = normalizeForPresence(name);
  if (!normalizedName) return true;
  if (normalizedText.includes(` ${normalizedName} `)) return true;
  const parts = normalizedName.split(' ').filter((part) => part.length > 2);
  if (parts.length >= 3) {
    const shortName = parts.slice(0, 2).join(' ');
    const familyName = parts.slice(-2).join(' ');
    return normalizedText.includes(` ${shortName} `) || normalizedText.includes(` ${familyName} `);
  }
  return false;
};

const requiredNamesFromSources = (sources: unknown[], row: QueueRow) => {
  const publisherNames = new Set(
    sources
      .map((source) => (source && typeof source === 'object' ? plain((source as Record<string, unknown>).publisher, 120) : ''))
      .filter(Boolean)
      .map(normalizeForPresence),
  );
  const text = decodeHtmlEntities(
    plain(
      [
        row.title,
        row.summary,
        row.keywords,
        ...sources.map((source) => (source && typeof source === 'object' ? sourceEvidenceText(source as Record<string, unknown>) : '')),
      ].join(' '),
      18000,
    ),
  );
  const matches = [
    ...text.matchAll(
      /\b[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ][A-Za-zÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇáàâãéèêíïóôõöúç]{2,}(?:\s+(?:d[aeo]s?|e|do|da|dos|das|de|[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ][A-Za-zÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇáàâãéèêíïóôõöúç]{2,})){1,5}/g,
    ),
  ];
  const scored = new Map<string, { name: string; score: number }>();
  const stop = /^(Policia Civil|Rio de Janeiro|Zona Sul|Ipanema|Vinicius de Moraes|Visconde de Piraja|Jornal de Brasilia|Portal Novo Alvo|Leia Tambem)$/i;
  for (const match of matches) {
    const name = plain(match[0], 120).replace(/\s+/g, ' ').trim();
    const key = normalizeForPresence(name);
    if (!key || publisherNames.has(key) || stop.test(name)) continue;
    const start = Math.max(0, match.index - 180);
    const end = Math.min(text.length, match.index + name.length + 220);
    const context = text.slice(start, end);
    const normalizedContext = normalizeForPresence(context);
    let score = 0;
    if (new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,\\s*\\d{1,3}\\b`).test(context)) score += 6;
    if (/\b(morreu|morta|morto|vitima|vítima|jovem|filha|mae|mãe|atingida|atropelad[ao]s?|ferid[ao]s?)\b/i.test(context)) score += 4;
    if (/\b(investiga|policia|polícia|acidente|van|cal[cç]ada|hospital|sepultamento)\b/i.test(context)) score += 1;
    if (/\b(?:atriz|ator|artista|elenco|papel|personagem|interpreta|interpretava|vive|vivia|serie|temporada|hbo|harry potter|gina weasley)\b/i.test(normalizedContext)) score += 5;
    if (/\b(?:deixou|saiu|substituida|substituido|retornar|gravacoes|producao|emissora|variety)\b/i.test(normalizedContext)) score += 2;
    if (/\b(?:atriz|ator|jovem|mirim)\b.{0,80}\b\d{1,2}\b|\b\d{1,2}\b.{0,80}\b(?:atriz|ator|jovem|mirim)\b/i.test(normalizedContext)) score += 3;
    if (/\b(rua|ruas|avenida|esquina|bairro|zona sul)\b/i.test(context)) score -= 4;
    if (score < 5) continue;
    const current = scored.get(key);
    if (!current || score > current.score) scored.set(key, { name, score });
  }
  return [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .map((item) => item.name)
    .slice(0, 6);
};

const missingRequiredNames = (article: Record<string, unknown>, bodyHtml: string, requiredNames: string[]) => {
  const text = [article.title, article.summary, article.meta_description, bodyHtml].join(' ');
  return requiredNames.filter((name) => !containsName(text, name));
};

const buildIdentityLedger = (sources: unknown[], row: QueueRow, requiredNames: string[]) => {
  const records = requiredNames
    .map((name) => {
      const evidence = [
        row.title,
        row.summary,
        row.keywords,
        ...sources.map((source) => (source && typeof source === 'object' ? sourceEvidenceText(source as Record<string, unknown>) : '')),
      ].join(' ');
      const normalizedEvidence = normalizeForPresence(evidence);
      const normalizedName = normalizeForPresence(name);
      const index = normalizedEvidence.indexOf(normalizedName);
      const rawIndex = evidence.toLowerCase().indexOf(name.toLowerCase());
      const start = Math.max(0, rawIndex >= 0 ? rawIndex - 220 : index - 220);
      const context = clipWholeWord(evidence.slice(start, start + 560), 520);
      const signals = [
        /\b(?:atriz|ator|artista|elenco|papel|personagem|interpreta|interpretava|vive|vivia|serie|temporada|hbo|cinema|filme)\b/i.test(normalizeForPresence(context))
          ? 'pessoa/personagem de entretenimento'
          : '',
        /\b(?:vitima|vítima|morreu|morta|morto|ferid|atingid|atropelad|suspeit|investigad)\b/i.test(context)
          ? 'pessoa central de ocorrencia'
          : '',
        /\b\d{1,3}\s+anos?\b/i.test(context) ? 'idade citada' : '',
        /\b(?:deixou|saiu|substituida|substituido|retornar|gravacoes|producao|emissora|confirmada|confirmado)\b/i.test(normalizeForPresence(context))
          ? 'acao ou desdobramento atribuido'
          : '',
      ].filter(Boolean);
      return `- ${name}${signals.length ? ` (${signals.join(', ')})` : ''}: ${context || 'nome detectado nas fontes.'}`;
    })
    .filter(Boolean);

  if (!records.length) return 'Nenhuma identidade central obrigatoria detectada automaticamente.';
  return records.join('\n');
};

const geminiModelFallbacks = (env: Env, finalModel: string) => [
  ...new Set(
    [
      finalModel,
      DEFAULT_GEMINI_MODEL,
      ...(env.GEMINI_FALLBACK_MODELS
        ? String(env.GEMINI_FALLBACK_MODELS)
            .split(/[\s,;]+/)
            .map((model) => model.trim())
            .filter(Boolean)
        : ['gemini-2.5-flash-lite']),
    ].filter(Boolean),
  ),
];

const buildFactDossier = (sources: unknown[], row: QueueRow) => {
  const rows = sources
    .slice(0, 15)
    .map((source, index) => {
      if (!source || typeof source !== 'object') return '';
      const record = source as Record<string, unknown>;
      const evidence = sourceEvidenceText(record);
      const signals = factSignalsFrom(evidence);
      const snippet = clipWholeWord(evidence, 900);
      if (!snippet && !signals.length) return '';
      return [
        `Fonte ${index + 1} - ${plain(record.publisher, 80) || 'Fonte'}: ${plain(record.title, 180)}`,
        signals.length ? `Sinais factuais detectados: ${signals.join('; ')}` : '',
        snippet ? `Material disponivel: ${snippet}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .filter(Boolean)
    .join('\n\n');

  const globalSignals = factSignalsFrom(
    [
      row.title,
      row.summary,
      row.keywords,
      ...sources.map((source) => (source && typeof source === 'object' ? sourceEvidenceText(source as Record<string, unknown>) : '')),
    ].join(' '),
  );

  return [
    globalSignals.length ? `Sinais consolidados obrigatorios: ${globalSignals.join('; ')}` : '',
    rows,
  ]
    .filter(Boolean)
    .join('\n\n');
};

const buildAiFactDossier = async (
  _sources: unknown[],
  _row: QueueRow,
  _env: Env,
  deterministicDossier: string,
): Promise<{ text: string; model: string }> => {
  return { text: deterministicDossier, model: '' };
};

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
  /(?:pauta consolidada|fontes consolidadas|fontes monitoradas|entrou na fila|fila editorial|engine|prompt|cluster|modelo de seguran|rascunho exige|materia inedita antes da fila|mat[eé]ria in[eé]dita antes da fila|processo editorial|protocolo interno|checklist|mesa de pauta|ag[eê]ncia editorial|portal novo alvo registra|portal novo alvo)/i.test(plain(value, 6000));

const hasUnnamedActiveAgent = (value: unknown) => {
  const text = plain(value, 9000);
  const vagueActor =
    /(?:^|[.!?]\s+)(?:um|uma)\s+(?:pr[eé]-?candidato|candidato|candidata|pol[ií]tico|pol[ií]tica|parlamentar|deputado|deputada|senador|senadora|vereador|vereadora|governador|governadora|prefeito|prefeita|ministro|ministra|autoridade|dirigente|executivo|executiva|empres[aá]rio|empres[aá]ria|atleta|jogador|jogadora|t[eé]cnico|t[eé]cnica|celebridade|influenciador|influenciadora)\b[^.!?]{0,180}\b(?:afirmou|disse|declarou|acusou|admitiu|defendeu|criticou|publicou|decidiu|aprovou|negou|prometeu|gerou|causou|provocou|pediu|atacou|recuou|confirmou|anunciou)\b/i;
  const passiveVagueActor =
    /\b(?:foi|foram)\s+(?:afirmado|dito|declarado|admitido|confirmado|anunciado)\s+por\s+(?:um|uma)\s+(?:pr[eé]-?candidato|candidato|candidata|pol[ií]tico|pol[ií]tica|parlamentar|autoridade|dirigente|executivo|executiva)\b/i;
  return vagueActor.test(text) || passiveVagueActor.test(text);
};

const hasUnknownCentralEntity = (value: unknown) =>
  /\b(?:atriz|ator|jogador|jogadora|cantor|cantora|influenciador|influenciadora|empres[aá]rio|empres[aá]ria|pol[ií]tico|pol[ií]tica|v[ií]tima|suspeito|suspeita|homem|mulher|jovem|adolescente|crian[cç]a)\s+n[aã]o\s+identificad[ao]s?\b/i.test(
    plain(value, 9000),
  );

const hasEntityIdentityGap = (value: unknown) => {
  const text = ` ${normalizeForPresence(plain(value, 12000))} `;
  const entity =
    '(?:atriz|ator|artista|jogador|jogadora|cantor|cantora|influenciador|influenciadora|empresario|empresaria|politico|politica|vitima|suspeito|suspeita|homem|mulher|jovem|adolescente|crianca|pessoa|personagem)';
  const unknown =
    '(?:nao\\s+(?:identificad[ao]s?|nomead[ao]s?|divulgad[ao]s?|informad[ao]s?|revelad[ao]s?|citad[ao]s?)|sem\\s+nome)';
  const direct = new RegExp(`\\b${entity}\\s*(?:central\\s*)?${unknown}\\b`, 'i');
  const after = new RegExp(`\\b${entity}\\b[^.!?]{0,120}\\b(?:nome\\s+)?${unknown}\\b`, 'i');
  const possessive = /\bcujo\s+nome\s+nao\s+(?:foi\s+)?(?:divulgado|informado|revelado|citado|nomeado)\b/i;
  const sourceGap =
    /\bnome\s+nao\s+(?:foi\s+)?(?:divulgado|informado|revelado|citado|nomeado)\s+(?:pelas|nas|entre\s+as)\s+fontes\b/i;
  return direct.test(text) || after.test(text) || possessive.test(text) || sourceGap.test(text);
};

const publicEditorialSummary = (title: string, category: string) => {
  const cleanTitle = stripRadarPrefix(title) || clean(title, 220);
  return `O caso em ${clean(category, 80) || 'Brasil'} exige identificar quem agiu, a causa imediata e a consequencia pratica: ${cleanTitle}.`;
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
    Famosos: 'A exposicao virou pressao',
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
  const chunks = splitLongText(textFromHtmlFragment(html, 12000)).slice(0, 12);
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
    .replace(/<(h2|h3)[^>]*>\s*(.*?)\s*<\/\1>/gi, (_match, tag, text) => `<${tag}>${escapeHtml(clipWholeWord(textFromHtmlFragment(text, 500), 140))}</${tag}>`)
    .replace(/<p[^>]*>\s*([\s\S]*?)\s*<\/p>/gi, (_match, text) =>
      splitLongText(textFromHtmlFragment(text, 3000))
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join(''),
    )
    .replace(/<blockquote[^>]*>\s*([\s\S]*?)\s*<\/blockquote>/gi, (_match, text) => `<blockquote>${escapeHtml(clipWholeWord(textFromHtmlFragment(text, 900), 520))}</blockquote>`)
    .replace(/<li[^>]*>\s*([\s\S]*?)\s*<\/li>/gi, (_match, text) => `<li>${escapeHtml(clipWholeWord(textFromHtmlFragment(text, 500), 220))}</li>`);

  const hasHeading = /<h[23]>/i.test(normalized);
  const paragraphs = (normalized.match(/<p>/gi) || []).length;
  if (paragraphs >= 5 && hasHeading) return normalized;
  if (paragraphs >= 4) return buildStructuredArticleHtml(normalized);

  const text = textFromHtmlFragment(normalized, 9000);
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
    .map((paragraph) => `<p>${escapeHtml(decodeHtmlEntities(paragraph))}</p>`)
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
  if (hasUnnamedActiveAgent(text)) return false;
  if (hasEntityIdentityGap(text)) return false;
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
  const geminiApiKeys = [env.GEMINI_API_KEY, env.GEMINI_API_KEYS].filter(Boolean).join(',');
  if (!geminiApiKeys) {
    return {
      ...fallback,
      imageAlt: fallback.imageAlt || fallback.title,
      imageCaption: fallback.imageCaption || '',
      featuredImageUrl: '',
      inlineImageUrl: '',
      generatedWithAi: false,
      generationModel: 'fallback-editorial-template',
      generationError: 'GEMINI_API_KEY nao configurada. Materias publicaveis devem ser geradas pelo Gemini.',
    };
  }

  const sources = await enrichSourcesWithText(parseArray(row.sources));
  const score = Number(row.score || 0);
  const sourceCount = Number(row.source_count || sources.length || 0);
  const premiumDraft = score > 800;
  const editorialTitle = stripRadarPrefix(row.title) || clean(row.title, 220);
  const fallbackModels = geminiModelFallbacks(env, env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL);
  const factDossier = buildFactDossier(sources, row);
  const requiredNames = requiredNamesFromSources(sources, row);
  const identityLedger = buildIdentityLedger(sources, row, requiredNames);
  const aiFactDossier = await buildAiFactDossier(sources, row, env, factDossier);
  const sourceLines = sources
    .slice(0, 15)
    .map((source) => {
      if (!source || typeof source !== 'object') return '';
      const record = source as Record<string, unknown>;
      const evidence = sourceEvidenceText(record);
      const signals = factSignalsFrom(evidence).slice(0, 12);
      const excerpt = clipWholeWord(record.excerpt, 900);
      const summary = clipWholeWord(record.summary || record.description || record.content, 300);
      return [
        `- ${plain(record.publisher, 80)}: ${plain(record.title, 180)} (${plain(record.url, 400)})`,
        signals.length ? `  Sinais obrigatorios: ${signals.join('; ')}` : '',
        excerpt ? `  Trecho extraido: ${excerpt}` : '',
        summary ? `  Resumo da ingestao: ${summary}` : '',
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
    'Voce e um jornalista redator profissional de alto nivel. Sua tarefa e entregar uma materia pronta para publicacao, nao um briefing, nao um clipping e nao um relatorio tecnico. Raciocine como uma mini-redacao: editor de pauta, checador, reporter, redator e editor final. Essas funcoes sao internas e nunca devem aparecer no texto. Nunca cite marca do portal, IA, prompt, modelo, cluster, Geracao X, Millennials, Gen Z, publico-alvo, fontes consolidadas, checklist, apuracao interna ou processo editorial no texto publicado. Escreva em portugues do Brasil, com acentos corretos. Cada editoria deve ter vocabulario proprio: nao transforme toda noticia em analise economica. Comece a resposta imediatamente com JSON puro e valido.';
  const imageCandidates = uniqueImageCandidates(parseArray(row.image_candidates)).slice(0, 10);
  const selectedImage = chooseBestImage(imageCandidates, editorialTitle, row.category);
  const finalModel = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const imageLines = imageCandidates
    .map((candidate, index) => `${index + 1}. ${candidate.url} | pauta: ${plain(candidate.sourceTitle, 160)} | origem: ${plain(candidate.sourcePublisher, 80)}`)
    .join('\n');
  const prompt = `
PROTOCOLO INTERNO DE REDACAO - NEWSROOM OPERATING SYSTEM

Voce e um jornalista profissional de alto nivel. Sua funcao e transformar a apuracao em uma materia precisa, com fato escancarado, responsavel direto identificado e consequencia concreta.

MODELO DE QUALIDADE ESPERADO:
- A materia final deve parecer uma sintese jornalistica natural, como uma reportagem completa construida a partir de varias apuracoes.
- Escolha uma tensao central e organize os fatos em arco editorial: pressao inicial -> resposta ou decisao -> episodio concreto -> bastidor ou contraponto -> consequencia.
- O leitor nao deve perceber que existiam varias fontes, RSS, fila, cluster ou sistema por tras.
- A materia nao deve abrir com "pauta consolidada", "a engine", "o portal registra" ou qualquer linguagem de bastidor.
- Use nomes proprios quando existirem nos dados. Se Neymar, Ancelotti, CBF, Santos e Coritiba aparecem, o texto deve nomea-los. Nao esconda agente ativo atras de "um jogador", "uma autoridade" ou "um politico".
- Quando o assunto tiver personagem central, acompanhe a trajetoria do conflito desse personagem no texto. Quando for decisao publica, acompanhe quem decidiu, quem perde, quem ganha e o efeito pratico.

AGENTES INTERNOS INVISIVEIS:
1. Agente de Pauta: identifica o fato mais importante e descarta ruido.
2. Agente de Cluster: verifica se as fontes tratam do mesmo evento real, nao apenas da mesma palavra.
3. Agente de Checagem: separa fato, declaracao, rumor, contexto e consequencia.
4. Agente de Contexto: nomeia agente ativo, causa latente e conflito.
5. Agente Redator: escreve a materia com fluidez jornalistica.
6. Agente Editor: remove jargoes, vazamentos internos, repeticao, subjetivismo e frases genericas.

Esses agentes sao apenas raciocinio interno. Nunca cite "agente", "cluster", "sistema", "pauta" ou "processo" no texto final.

PROTOCOLO INTERNO DE REDACAO (NAO EXPOR AO LEITOR):
Antes de escrever, opere como uma agencia editorial completa. Use este protocolo apenas para raciocinar. A resposta final deve conter somente o JSON solicitado.

1. MESA DE PAUTA E DEFINICAO DE INTERESSE PUBLICO:
- Defina a pergunta central: qual e o interesse publico real desta noticia?
- Identifique por que ela importa agora: dinheiro, poder, reputacao, risco, servico, cultura, placar, direitos ou rotina do leitor.
- Gere mentalmente 3 a 5 hipoteses de explicacao e descarte as que nao tiverem suporte nas fontes.
- Mapeie stakeholders: quem ganha, quem perde, quem decide, quem tenta controlar a narrativa e quem paga a conta.
- Se as fontes falarem de assuntos diferentes sob a mesma categoria, escolha apenas o fato com maior coesao e maior relevancia. Nao misture assuntos desconectados.

2. APURACAO E TRIANGULACAO:
- Use os trechos completos das fontes como base prioritaria.
- Cruze pelo menos 2 sinais independentes antes de transformar uma afirmacao em fato central.
- Separe fato confirmado, contexto, declaracao, disputa, rumor e consequencia.
- Se a informacao for incerta, trate como incerteza jornalistica. Nao invente confirmacao.
- Se houver divergencia entre fontes, governo, empresa, clube, mercado, publico ou rede social, transforme a contradicao em eixo da materia.

3. ESTRATEGIA DE FONTES:
- Fontes primarias valem mais: documentos, orgaos oficiais, dados publicos, agenda oficial, comunicado, tabela, contrato, placar, decisao judicial, estudo ou relatorio.
- Fontes especializadas ajudam a interpretar, mas nao podem substituir o fato.
- Redes sociais so entram como sintoma de repercussao, nunca como prova unica.
- Nunca cite portais concorrentes no texto final. Absorva a informacao e escreva com voz propria.
- Nao use "segundo fontes" de forma vaga. Quando a fonte identificavel estiver nas entradas, nomeie o orgao, pessoa, clube, empresa ou cargo.

4. LEAD E NARRATIVA:
- O lead deve responder o essencial em ate 3 frases curtas.
- Comece pela informacao que mais muda o entendimento do leitor.
- Evite abertura poetica, inventario ou resumo operacional.
- Estruture o texto por importancia, nao pela ordem das fontes.
- Use narrativa analitica: fato -> agente ativo -> causa latente -> consequencia -> contradicao -> impacto.
- Nao escreva como quem esta explicando uma pauta para um editor. Escreva como quem esta publicando a materia ao leitor final.
- Nunca repita o titulo no primeiro paragrafo. O primeiro paragrafo deve avancar a informacao.

5. MODO BREAKING NEWS, QUANDO A PAUTA FOR URGENTE:
- Priorize verificacao inicial, triangulacao rapida e informacao confirmada.
- Nao publique boato como fato. Use linguagem cautelosa quando o dado ainda estiver em desenvolvimento.
- Corrija rumos dentro do texto se houver informacao conflitante.
- Explique o que ja se sabe, o que ainda falta saber e por que isso muda o proximo passo.

6. ANALISE EDITORIAL:
- Contextualize sem alongar. O leitor precisa entender o historico em poucas linhas.
- Identifique causa e efeito, incentivos, precedentes e consequencias.
- Use analogias simples apenas quando melhorarem a compreensao.
- Em materias analiticas, termine com uma projecao plausivel, nao com conselho vazio.

7. LEGAL, ETICA E SEGURANCA:
- Nao acuse sem agente, fato e base textual.
- Proteja vitimas, menores e pessoas vulneraveis.
- Distingua acusacao, investigacao, decisao, condenacao, opiniao e rumor.
- Se a pauta envolve crime, saude, tragedia ou processo judicial, reduza punch e aumente precisao.

8. MULTIPLATAFORMA E LEITURA MOBILE:
- Paragrafos curtos, densos e legiveis no celular.
- Frases longas devem ser quebradas.
- Subtitulos devem orientar a leitura, nao gritar mais que a manchete.
- Cada bloco precisa entregar informacao nova. Nao repita a pauta no fim.

9. CHECKLIST FINAL INVISIVEL:
- O agente ativo esta nomeado?
- A causa latente foi explicada?
- A consequencia pratica ficou clara?
- Ha algum termo de processo interno vazando?
- O titulo e autoral, sem copiar fonte?
- O texto fecha com frase completa e HTML limpo?
- A materia parece noticia publicavel, nao briefing para editor?

PERSONAS POR CATEGORIA (MODO DE ESPECIALISTA):
- BRASIL: "O Reporter de Campo". Foco em fatos nacionais, desdobramentos locais e o que impacta o dia a dia do cidadao brasileiro.
- MUNDO: "O Correspondente Internacional". Traduz eventos globais e geopoliticos, sempre explicando por que isso e relevante para o Brasil.
- POLITICA: "O Analista de Poder". Foco em bastidores, estrategia eleitoral e Follow the Money. Cetico com discursos oficiais.
- ECONOMIA: "O Estrategista Financeiro". Traduz indicadores, inflacao e mercado para o impacto direto no poder de compra do leitor. Esta e a editoria principal para termos como ativo, valuation, liquidez, arbitragem e poder de compra.
- SAUDE: "O Consultor de Vida". Empatico, baseado em evidencias cientificas e focado em bem-estar e medicina pratica.
- TECNOLOGIA: "O Early Adopter". Critico com marketing, focado em utilidade digital, privacidade e specs reais.
- ESPORTES: "O Cronista de Competicao". Foco em placar, pressao, desempenho, lesoes, calendario, tatica simples e consequencia esportiva. Nao transforme jogo em mercado financeiro.
- FAMOSOS: "O Observador Social". Analisa exposicao publica, reputacao, comportamento e impacto cultural, fugindo da fofoca rasa. Nao use vocabulario financeiro para pessoas.
- CINEMA: "O Critico de Cinema". Foco em roteiro, direcao, elenco, bilheteria quando relevante, streaming, imagem, montagem e tecnica cinematografica. Nao trate todo filme como produto financeiro.
- ENTRETENIMENTO: "O Curador Pop". Analisa tendencias de consumo, eventos de massa, audiencia, disputa de atencao e novos formatos de midia.
- CIENCIA: "O Divulgador Academico". Didatico, fascinado pelo cosmos e pela biologia, combatendo rigorosamente o negacionismo.
- EDUCACAO: "O Mentor de Carreira". Focado em vestibular, novas formas de aprendizado e o futuro do mercado de trabalho.
- CULTURA: "O Antropologo Urbano". Foco em artes, literatura e comportamento social.
- LIFESTYLE: "O Curador de Estilo". Foco em viagens, gastronomia e equilibrio entre vida e produtividade.
- GAMES: "O Hardcore Player". Analisa gameplay, industria, performance tecnica e comunidade. Sem piedade com bugs de lancamento. Use linguagem de jogador, nao de banco.
- MODA: "O Trend Hunter". Foco em design, passarela, rua, sustentabilidade textil, estetica e comportamento de consumo. Evite jargao financeiro.
- MUSICA: "O Critico Musical". Analisa producao sonora, shows, mercado fonografico quando for o assunto, letras e movimentos ritmicos.
- FUTEBOL: "O Analista de Campo". Foco em jogo, tatica, xG quando houver dado, pressao da torcida, tecnico, elenco, SAF apenas quando a pauta for negocio do clube.

MICRO-PERSONAS DE ELITE:
- ESPORTES/FUTEBOL:
  1. Analise Tatica e Telemetria: mapas de calor, variacao de formacao, transicoes e inteligencia de campo.
  2. Gestao de Clube: SAF, contratos, mercado e caixa do clube apenas quando a noticia for explicitamente financeira.
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
  1. Pulso Cultural: lancamentos como sinais de comportamento, atencao, gosto publico e circulacao social.
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
- O bloco DOSSIE FACTUAL VERIFICADO abaixo tem prioridade maxima sobre o resumo operacional e sobre titulos RSS. Ele existe para impedir texto generico. Use nomes, numeros, idades, cidades, orgaos, datas e objetos concretos listados nele.
- Se houver sinais factuais no dossie, a materia final deve trazer pelo menos 6 deles de forma natural no lead e no corpo. Nao substitua "Eliseu Bitencourt, 32 anos" por "um homem"; nao substitua "revolver calibre .38" por "armas"; nao substitua "Costa Rica, MS" por "interior".
- Se houver valores, anos, percentuais ou quantidades no dossie, eles sao obrigatorios. Nao troque "129 bilhoes de dolares", "319 bilhoes de euros", "116 bilhoes de dolares" ou "2024" por "aumentos significativos", "volume elevado" ou "dados indicam".
- Em economia e geopolitica, o texto deve abrir ou chegar ate o terceiro paragrafo com os numeros centrais. Materia sem os valores disponiveis deve ser considerada incompleta.
- Fato Estatico: o que aconteceu. Exemplo: "O preco subiu".
- Agente Ativo: quem causou, decidiu, moveu, perdeu ou ganhou. De nome aos bois.
- Regra de responsabilidade nominal: se o texto disser que alguem afirmou, declarou, publicou, admitiu, defendeu, acusou, decidiu, aprovou, negou, pediu, atacou ou causou algo, a frase deve trazer o nome da pessoa, orgao, empresa, partido, clube ou cargo oficial responsavel. Nunca escreva "um pre-candidato", "um politico", "uma autoridade", "um dirigente" ou "uma celebridade" como sujeito de acusacao, fala ou decisao.
- Se as fontes fornecidas nao identificarem nominalmente o responsavel, nao crie a frase acusatoria. Reescreva com o fato verificavel: "A pauta nao identifica nominalmente o autor da fala" ou foque na reacao publica sem atribuir a uma pessoa anonima.
- Causa Latente: por que isso aconteceu agora.
- Conflito: se houver divergencia entre governo, empresa, clube, usuarios ou mercado, exponha como ponto central.
- Micro-persona: escolha uma das micro-personas acima e use como lente do texto.

PROTOCOLO DE SERVICO PUBLICO E CONSUMO:
- Se a pauta envolver Anvisa, Procon, Recall, suspensao de lote, proibicao, reembolso, troca, alerta sanitario, concurso, inscricao, calendario, beneficio, imposto, prazo, edital, acidente, transporte, escola, hospital ou qualquer orientacao pratica ao leitor, trate como MATERIA DE SERVICO.
- Em materia de servico, extraia e use todos os detalhes explicitos presentes nas fontes: produto, marca, lote, validade, CNPJ quando existir, orgao responsavel, resolucao, data da decisao, cidade, estado, local, horario, prazo, telefone, email, site, WhatsApp, SAC, canal oficial, documentos exigidos, passo a passo, quem tem direito, quem fica de fora e qual risco foi apontado.
- E proibido escrever substitutos genericos quando a fonte trouxer dado acionavel. Nao escreva "procure o SAC", "consulte o comunicado", "geralmente", "pode ser feito por estorno" ou "canais oficiais" se houver telefone, link, formulario, email, lote, data ou procedimento especifico no material.
- Se a fonte nao trouxer o canal, lote, prazo ou documento especifico, diga isso de forma objetiva uma unica vez: "As fontes analisadas nao informam o canal especifico de reembolso" ou "A lista de lotes nao aparece nos trechos disponiveis". Nao preencha a lacuna com suposicao.
- Para servico publico, organize o corpo com subtitulos uteis ao leitor, como <h2>O que foi decidido</h2>, <h2>Quem e afetado</h2>, <h2>Como pedir troca ou reembolso</h2>, <h2>Prazos e documentos</h2> ou equivalentes. Use <ul><li> apenas quando houver dados concretos suficientes.
- Priorize o detalhe raro: o que uma fonte trouxe e as outras nao trouxeram deve aparecer antes de contexto generico.

ESTRUTURA PADRONIZADA (OBRIGATORIA):
1. TITULO: direto, impactante e otimizado para SEO. Maximo de 65 caracteres.
   Nunca use o prefixo "Radar" no titulo final, salvo se Radar for nome proprio do fato.
   O titulo final deve ser autoral do Portal Novo Alvo. E proibido copiar, parafrasear de perto ou manter a mesma estrutura de qualquer titulo das fontes.
   Se uma fonte diz "X gera Y", crie uma sintese propria com responsavel direto, consequencia e tensao editorial.
2. LIDE: 5W2H em no maximo 3 frases curtas. Va direto ao ponto.
3. CORPO DO TEXTO: subtitulos <h2> a cada cerca de 200 palavras. Sentencas curtas, no maximo 20 palavras. Use <strong> em termos cruciais.
4. SECAO "POR QUE ISSO IMPORTA": bloco final em <blockquote>. De um passo atras da noticia, analise com ceticismo, projete impacto futuro e entregue o veredito editorial.

ESTILO EDITORIAL (EEAT):
- Tom analitico, levemente acido, independente e focado em utilidade.
- Proibido usar adjetivos vazios como "incrivel" ou "magico". Use fatos e dados.
- Publico interno de calibragem: Millennials e Gen Z precisam de leitura rapida; Gen X e Boomers precisam de clareza e seriedade.
- Nao cite essas geracoes no texto final. Elas sao apenas parametros de estilo.
- Proibido subjetivismo: nao use "muitos acreditam", "parece ser", "pode indicar" sem base factual.
- Foco em consequencia: se uma lei, decisao, negocio, jogo ou crise aconteceu, explique quem ganha e quem perde poder, tempo, reputacao, chance esportiva, audiencia, confianca ou dinheiro quando o dinheiro for central.
- Identifique pessoas, clubes, empresas, marcas, orgaos, cargos, valores e datas quando esses dados aparecerem nas fontes. Nao esconda nomes proprios em abstracoes.
- Grave: nao omita o nome do agente principal quando ele estiver nos titulos, trechos ou fontes. Uma noticia que acusa, atribui fala ou relata decisao sem nomear o responsavel e considerada incompleta.
- O portal e analitico, mas nao e economista permanente. So use linguagem economica quando a categoria ou o fato exigir.
- Lente economica nao e padrao. Termos como "ativo", "ativos", "valuation", "liquidez", "arbitragem", "capital", "portfolio", "monetizacao" e "estrategico" pertencem principalmente a Economia, mercado financeiro, contratos, SAF, negocios, Big Tech ou quando o dinheiro for explicitamente o centro da noticia.
- Fora desses casos, troque economes por vocabulario da editoria: campo, torcida e placar em Futebol; roteiro, tela e direcao em Cinema; reputacao e exposicao em Famosos; estetica e consumo em Moda; gameplay e comunidade em Games; evidencia e cuidado em Saude; sala de aula, vaga e carreira em Educacao.
- Em Esportes e Futebol, escreva com campo, pressao, placar, tecnico, elenco, erro, calendario e torcida. Use dinheiro apenas se a pauta for contrato, SAF ou mercado.
- Em Famosos, Entretenimento, Cinema, Musica e Games, escreva com cultura, reputacao, audiencia, narrativa, fandom, lancamento, tela, som, gameplay e consumo. Nao aplique economes por padrao.
- Em Saude, Educacao, Ciencia, Brasil e Mundo, privilegie impacto humano, servico publico, evidencia, decisao e consequencia pratica.

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
- A materia precisa ter progressao: cada paragrafo acrescenta fato, contexto, tensao ou consequencia nova.
- O texto deve ter arco editorial unico. Nao cole mini-resumos de fontes diferentes.
- Se uma fonte trouxer apenas um titulo solto e sem contexto, use-a somente como sinal de existencia do fato, nao como base do texto.
- Se o tema exigir servico ao leitor, o texto so esta completo quando responder, com dados explicitos quando existirem: quem, o que, quando, onde, como resolver, qual canal, qual prazo e qual documento.
- Nao use linguagem de cartilha vazia. Cada orientacao pratica precisa estar ancorada em um dado visivel nas fontes.
- Use <h2> para divisorias fortes e <h3> apenas quando fizer sentido.
- Feche obrigatoriamente com <blockquote>Por que isso importa: ...</blockquote>.
- Nao termine o texto no meio de uma frase. O content_html precisa fechar com pontuacao final clara e tags HTML completas.

REGRAS DE IMAGEM:
- Escolha featured_image_url apenas entre as imagens candidatas listadas.
- A capa deve retratar o responsavel direto ou a cena concreta da noticia, nao apenas o tema generico.
- Escolha secondary_image_url apenas se ela ajudar a provar o fato no corpo do texto: documento, local, produto, jogo, pessoa, objeto ou cena relacionada.
- Se nenhuma candidata for segura ou coerente, deixe o campo vazio. Nao invente URL.
- image_alt deve descrever o fato e o responsavel direto com precisao jornalistica.
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
[DOSSIE FACTUAL VERIFICADO - PRIORIDADE MAXIMA]:
${aiFactDossier.text || 'Sem dossie factual estruturado. Use apenas os dados visiveis em fontes e resumo.'}
[FICHA DE IDENTIDADES CENTRAIS - PRIORIDADE MAXIMA]:
${identityLedger}
[NOMES PROPRIOS OBRIGATORIOS]:
${requiredNames.length ? requiredNames.map((name) => `- ${name}`).join('\n') : 'Sem nomes obrigatorios detectados.'}
[FONTES]:
${sourceLines || 'Fontes nao listadas.'}

IMPORTANTE SOBRE AS FONTES:
- Os trechos extraidos da materia completa e o dossie factual têm prioridade sobre titulo RSS e resumo operacional.
- Quando houver nome de pessoa, orgao, clube, empresa ou cargo nesses trechos, use o nome. Nao substitua por sujeito vago.

- Se houver nomes proprios obrigatorios listados, a materia final precisa citar esses nomes no titulo, lide ou primeiros paragrafos quando forem vitimas, investigados, autoridades, atletas, empresas ou personagens centrais. Omitir nome obrigatorio torna a materia invalida.

REGRA ANTI-LACUNA NOMINAL:
- E proibido escrever "atriz nao identificada", "nao nomeada nas fontes", "nome nao divulgado pelas fontes" ou variacoes. Se a pessoa central nao estiver nomeada nos trechos, nao gere materia final: prefira falhar a publicar texto generico.
- Em Famosos, Cinema e Entretenimento, nomes de atores, atrizes, personagens, emissoras, series, filmes, temporadas e idades presentes nos trechos sao dados obrigatorios, mesmo que nao aparecam no titulo RSS.
- Antes de escrever, monte mentalmente uma tabela WHO/WHAT/WHEN/WHERE/WHY/HOW. O WHO deve sair da FICHA DE IDENTIDADES CENTRAIS e dos trechos extraidos. Se WHO tiver nome proprio, o titulo, lide ou segundo paragrafo deve usar esse nome.
- A materia so e valida se cada pessoa central mencionada no titulo/lide estiver ligada a pelo menos um detalhe verificavel da ficha: idade, papel, cargo, personagem, local, data, acao, orgao ou consequencia.

Responda exatamente neste formato, com JSON valido e sem markdown:
{"title":"...","slug":"...","meta_description":"...","fact_static":"...","active_agent":"...","latent_cause":"...","conflict_point":"...","micro_persona":"...","featured_image_url":"...","secondary_image_url":"...","image_alt":"...","image_credit":"...","content_html":"..."}
`;

  try {
    const runArticleGeneration = (extraInstruction = '') =>
      runGeminiJson({
      apiKey: geminiApiKeys,
      model: finalModel,
      system,
      prompt: extraInstruction ? `${prompt}\n\nVALIDACAO EDITORIAL OBRIGATORIA:\n${extraInstruction}` : prompt,
      maxOutputTokens: premiumDraft ? 6800 : 5600,
      temperature: premiumDraft ? 0.28 : 0.35,
      timeoutMs: premiumDraft ? 38000 : 30000,
      fallbackModels,
    });

    let gemini = await runArticleGeneration();
    let generationModel = aiFactDossier.model ? `${gemini.model}+dossier:${aiFactDossier.model}` : gemini.model;
    let result = gemini.result;

    let generatedBody = htmlFromModelField(
      result.content_html || result.bodyHtml || result.contentHtml || result.content || result.article || result.text,
    );
    if (!hasEditorialBody(generatedBody)) {
      throw new Error('Gemini respondeu sem uma materia editorial completa em content_html.');
    }
    if (hasInternalLeak(result.title) || hasInternalLeak(result.summary || result.meta_description)) {
      throw new Error('Gemini vazou instrucoes internas no titulo ou resumo.');
    }
    if (hasUnknownCentralEntity([result.title, result.summary, result.meta_description, generatedBody].join(' ')) || hasEntityIdentityGap([result.title, result.summary, result.meta_description, generatedBody].join(' '))) {
      throw new Error('Gemini usou entidade central nao identificada apesar das fontes.');
    }
    let missingNames = missingRequiredNames(result, generatedBody, requiredNames);
    if (missingNames.length) {
      gemini = await runArticleGeneration(
        `A resposta anterior omitiu nomes centrais extraidos das fontes: ${missingNames.join(', ')}. Reescreva a materia completa citando esses nomes no titulo, lide ou primeiros paragrafos, sem inventar dados e sem substituir por "jovem", "filha", "vitima", "homem" ou "mulher" quando o nome existir.`,
      );
      generationModel = aiFactDossier.model ? `${gemini.model}+dossier:${aiFactDossier.model}` : gemini.model;
      result = gemini.result;
      generatedBody = htmlFromModelField(
        result.content_html || result.bodyHtml || result.contentHtml || result.content || result.article || result.text,
      );
      if (!hasEditorialBody(generatedBody)) {
        throw new Error('Gemini respondeu sem uma materia editorial completa em content_html.');
      }
      if (hasInternalLeak(result.title) || hasInternalLeak(result.summary || result.meta_description)) {
        throw new Error('Gemini vazou instrucoes internas no titulo ou resumo.');
      }
      if (hasUnknownCentralEntity([result.title, result.summary, result.meta_description, generatedBody].join(' ')) || hasEntityIdentityGap([result.title, result.summary, result.meta_description, generatedBody].join(' '))) {
        throw new Error('Gemini manteve entidade central nao identificada apesar das fontes.');
      }
      missingNames = missingRequiredNames(result, generatedBody, requiredNames);
      if (missingNames.length) {
        throw new Error(`Gemini omitiu nomes obrigatorios das fontes: ${missingNames.join(', ')}.`);
      }
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
      generationModel: finalModel,
      generationError: error instanceof Error ? error.message : 'Falha desconhecida na geracao por IA.',
    };
  }
};

export const buildArticlePayload = async (row: QueueRow, env: Env) => {
  const sources = parseArray(row.sources);
  const tags = parseArray(row.tags).map(String).filter(Boolean);
  const baseImageCandidates = await enrichImageCandidatesFromSources(
    uniqueImageCandidates(parseArray(row.image_candidates)),
  );
  const bingImageCandidates = baseImageCandidates.length ? [] : await searchBingImageCandidates(row, env);
  const wikipediaImageCandidates = baseImageCandidates.length || bingImageCandidates.length ? [] : await searchWikipediaImageCandidates(row);
  const preFallbackCandidates = uniqueImageCandidates([...baseImageCandidates, ...bingImageCandidates, ...wikipediaImageCandidates]);
  const unsplashImageCandidates = preFallbackCandidates.length ? [] : dynamicUnsplashCandidate(row);
  const imageCandidates = uniqueImageCandidates([...preFallbackCandidates, ...unsplashImageCandidates]);
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
  const maxQueueAgeHours = Math.max(1, Math.min(96, Number((env as { QUEUE_MAX_AGE_HOURS?: string }).QUEUE_MAX_AGE_HOURS || 18)));
  const staleCutoff = new Date(Date.now() - maxQueueAgeHours * 60 * 60 * 1000).toISOString();
  await db
    .prepare(
      `UPDATE editorial_pitches
       SET status = 'reviewed',
           updated_at = ?
       WHERE id IN (
         SELECT pitch_id
         FROM editorial_queue
         WHERE status = 'queued'
           AND publish_after < ?
       )`,
    )
    .bind(now, staleCutoff)
    .run();
  await db
    .prepare(
      `UPDATE editorial_queue
       SET status = 'failed',
           error = ?,
           updated_at = ?
       WHERE status = 'queued'
         AND publish_after < ?`,
    )
    .bind(`Expirada antes da publicacao automatica (${maxQueueAgeHours}h).`, now, staleCutoff)
    .run();

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
      await markMemoryPublished(db, item, article.slug);
      published.push({ queueId: item.id, slug: article.slug, title: article.title, staticPublish: (data as { staticPublish?: unknown }).staticPublish });
    } catch (error) {
      await db
        .prepare("UPDATE editorial_pitches SET status = 'reviewed', updated_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), item.pitch_id)
        .run();
      await db
        .prepare("UPDATE editorial_queue SET status = 'failed', error = ?, updated_at = ? WHERE id = ?")
        .bind(error instanceof Error ? error.message : 'Falha desconhecida', new Date().toISOString(), item.id)
        .run();
    }
  }

  return json({ ok: true, checked: due.results?.length || 0, published });
};
