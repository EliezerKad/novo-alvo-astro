type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      run: () => Promise<unknown>;
    };
  };
};

type Env = {
  EDITORIAL_DB?: D1Database;
  ADMIN_TOKEN?: string;
};

type PitchRecord = {
  id: string;
  cluster_key?: string;
  title?: string;
  category?: string;
  sources?: string;
  image_candidates?: string;
};

type SourceRecord = {
  title?: string;
  publisher?: string;
  url?: string;
};

type ImageCandidate = {
  url: string;
  sourceTitle?: string;
  sourcePublisher?: string;
  sourceUrl?: string;
  category?: string;
  role?: string;
  method?: string;
  score?: number;
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

const getDb = (env: Env) => env.EDITORIAL_DB;

const requireAdmin = (request: Request, env: Env) => {
  const expected = clean(env.ADMIN_TOKEN, 500);
  if (!expected) return json({ error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (token !== expected) return json({ error: 'Nao autorizado.' }, { status: 401 });
  return null;
};

const parseArray = (value: unknown) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const imageUrl = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return clean(value, 1200);
  if (typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return clean(record.url || record.src, 1200);
};

const imageKey = (value: unknown) => {
  try {
    const url = new URL(clean(value, 1200));
    return `${url.hostname}${url.pathname}`.toLowerCase().replace(/\/+/g, '/');
  } catch {
    return clean(value, 1200).toLowerCase().split('?')[0];
  }
};

const decodeHtml = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const resolveUrl = (value: string, base: string) => {
  const src = decodeHtml(clean(value, 1400));
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return '';
  try {
    return new URL(src, base).href;
  } catch {
    return '';
  }
};

const blockedImagePattern =
  /(news\.google|googleusercontent\.com\/.*\/favicon|googlelogo|\/logo[\W_]|favicon|sprite|placeholder|blank|pixel|tracking|avatar|author|profile|badge|watermark|1x1|\/icons?\/|\/svg\/|\.svg(?:\?|$)|\.gif(?:\?|$)|\.ico(?:\?|$))/i;

const isUsableImage = (url: string) => {
  if (!/^https:\/\//i.test(url)) return false;
  if (blockedImagePattern.test(url)) return false;
  if (/(width|w)=([1-9][0-9]?|1[0-9]{2})(?:\D|$)/i.test(url)) return false;
  if (/(height|h)=([1-9][0-9]?|1[0-9]{2})(?:\D|$)/i.test(url)) return false;
  return true;
};

const scoreCandidate = (candidate: ImageCandidate, title: string) => {
  const text = `${candidate.url} ${candidate.sourceTitle || ''} ${candidate.sourcePublisher || ''}`.toLowerCase();
  const titleTerms = clean(title, 200)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 3);

  let score = 0;
  if (candidate.method === 'og:image') score += 80;
  if (candidate.method === 'twitter:image') score += 70;
  if (candidate.method === 'schema:image') score += 60;
  if (candidate.method === 'html:image') score += 25;
  if (/\.(jpe?g|png|webp)(\?|$)/i.test(candidate.url)) score += 12;
  if (/(1200|1600|1920|large|xl|original|og|share|cover|uploads)/i.test(candidate.url)) score += 15;
  if (/(thumb|thumbnail|small|80x80|100x100|150x150|200x200)/i.test(candidate.url)) score -= 30;
  for (const term of new Set(titleTerms.slice(0, 10))) {
    if (text.includes(term)) score += 6;
  }
  if (blockedImagePattern.test(candidate.url)) score -= 200;
  return score;
};

const normalizeCandidates = (values: unknown[]) => {
  const seen = new Set<string>();
  const output: ImageCandidate[] = [];
  for (const value of values) {
    const url = imageUrl(value);
    if (!isUsableImage(url)) continue;
    const key = imageKey(url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const record = typeof value === 'object' && value ? (value as Record<string, unknown>) : {};
    output.push({
      url,
      sourceTitle: clean(record.sourceTitle, 240),
      sourcePublisher: clean(record.sourcePublisher, 120),
      sourceUrl: clean(record.sourceUrl, 1200),
      category: clean(record.category, 80),
      role: clean(record.role, 24),
      method: clean(record.method, 40),
      score: Number(record.score || 0),
    });
  }
  return output;
};

const fetchWithTimeout = async (url: string, timeoutMs = 5500) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.6',
        'user-agent': 'Mozilla/5.0 (compatible; NovoAlvoImageDesk/1.0; +https://portalnovoalvo.com.br)',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
};

const extractMeta = (html: string, names: string[]) => {
  for (const name of names) {
    const pattern = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name.replace(':', '\\:')}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name.replace(':', '\\:')}["'][^>]*>`,
      'i',
    );
    const match = html.match(pattern);
    const value = match?.[1] || match?.[2] || '';
    if (value) return value;
  }
  return '';
};

const extractJsonLdImages = (html: string) => {
  const images: string[] = [];
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of blocks.slice(0, 8)) {
    const raw = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      const parsed = JSON.parse(raw);
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== 'object') continue;
        const image = (item as Record<string, unknown>).image;
        if (typeof image === 'string') images.push(image);
        if (Array.isArray(image)) image.forEach((entry) => typeof entry === 'string' && images.push(entry));
        if (image && typeof image === 'object') {
          const url = (image as Record<string, unknown>).url || (image as Record<string, unknown>).contentUrl;
          if (typeof url === 'string') images.push(url);
        }
        Object.values(item as Record<string, unknown>).forEach((value) => {
          if (value && typeof value === 'object') queue.push(value);
        });
      }
    } catch {
      const matches = raw.match(/"image"\s*:\s*"([^"]+)"/gi) || [];
      matches.forEach((match) => {
        const value = match.match(/"image"\s*:\s*"([^"]+)"/i)?.[1] || '';
        if (value) images.push(value);
      });
    }
  }
  return images;
};

const extractHtmlImages = (html: string) => {
  const images: string[] = [];
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  for (const tag of imgTags.slice(0, 80)) {
    const raw =
      tag.match(/\bsrcset=["']([^"']+)["']/i)?.[1]?.split(',').pop()?.trim().split(/\s+/)[0] ||
      tag.match(/\bdata-src=["']([^"']+)["']/i)?.[1] ||
      tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] ||
      '';
    if (raw) images.push(raw);
  }
  return images;
};

const extractCandidatesFromSource = async (source: SourceRecord, category: string, pitchTitle: string) => {
  const sourceUrl = clean(source.url, 1200);
  if (!/^https?:\/\//i.test(sourceUrl)) return [];

  try {
    const response = await fetchWithTimeout(sourceUrl);
    const html = await response.text();
    const finalUrl = response.url || sourceUrl;
    const base = finalUrl || sourceUrl;
    const publisher =
      clean(source.publisher, 120) ||
      clean(extractMeta(html, ['og:site_name', 'application-name']), 120) ||
      (() => {
        try {
          return new URL(base).hostname.replace(/^www\./, '');
        } catch {
          return '';
        }
      })();
    const sourceTitle = clean(source.title, 260) || clean(extractMeta(html, ['og:title', 'twitter:title']), 260);

    const records: ImageCandidate[] = [];
    const push = (rawUrl: string, method: string) => {
      const url = resolveUrl(rawUrl, base);
      if (!isUsableImage(url)) return;
      records.push({ url, sourceTitle, sourcePublisher: publisher, sourceUrl: base, category, method });
    };

    push(extractMeta(html, ['og:image', 'og:image:url', 'og:image:secure_url']), 'og:image');
    push(extractMeta(html, ['twitter:image', 'twitter:image:src']), 'twitter:image');
    extractJsonLdImages(html).slice(0, 6).forEach((url) => push(url, 'schema:image'));
    extractHtmlImages(html).slice(0, 12).forEach((url) => push(url, 'html:image'));

    return records
      .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate, pitchTitle) }))
      .filter((candidate) => Number(candidate.score || 0) > 5)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, 5);
  } catch {
    return [];
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  let payload: { id?: string; clusterKey?: string; limit?: number };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON invalido.' }, { status: 400 });
  }

  const id = clean(payload.id, 140);
  const clusterKey = clean(payload.clusterKey, 200);
  if (!id && !clusterKey) return json({ error: 'ID ausente.' }, { status: 400 });

  const pitch = await db
    .prepare('SELECT id, cluster_key, title, category, sources, image_candidates FROM editorial_pitches WHERE id = ? OR cluster_key = ? LIMIT 1')
    .bind(id || clusterKey, clusterKey || id)
    .first<PitchRecord>();

  if (!pitch) return json({ error: 'Pauta nao encontrada.' }, { status: 404 });

  const sources = parseArray(pitch.sources)
    .map((source) => (source && typeof source === 'object' ? (source as SourceRecord) : null))
    .filter(Boolean) as SourceRecord[];
  const limit = Math.max(1, Math.min(8, Number(payload.limit || 6)));
  const selectedSources = sources.filter((source) => /^https?:\/\//i.test(clean(source.url, 1200))).slice(0, limit);

  const batches = await Promise.all(selectedSources.map((source) => extractCandidatesFromSource(source, clean(pitch.category, 80), clean(pitch.title, 260))));
  const extracted = normalizeCandidates(batches.flat()).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const existing = normalizeCandidates(parseArray(pitch.image_candidates));
  const merged = normalizeCandidates([...extracted, ...existing]).slice(0, 24);

  await db
    .prepare('UPDATE editorial_pitches SET image_candidates = ? WHERE id = ?')
    .bind(JSON.stringify(merged), pitch.id)
    .run();

  return json({
    ok: true,
    tried: selectedSources.length,
    found: extracted.length,
    saved: merged.length,
    candidates: merged,
  });
};
