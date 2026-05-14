import { spawnSync } from 'node:child_process';

const FEEDS = {
  Brasil:
    'https://news.google.com/rss/headlines/section/topic/CAAqJQgKIh9DQkFTRVFvSUwyMHZNRzV6Y0hjU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Politica:
    'https://news.google.com/rss/search?q=politica+OR+governo+OR+congresso+OR+STF+OR+eleicoes+when:24h&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Mundo:
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Economia:
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVd4b1NKVXlMd0pVUXlnQVAB?hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Tecnologia:
    'https://news.google.com/rss/headlines/section/topic/CAAqKggKIiRDQkFTRFvSUwyMHZNRGRqTVhZU0JXVnVMVWRDR2dKUVN5Z0FQAQ?hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Entretenimento:
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVdZU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Esportes:
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Ciencia:
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Saude:
    'https://news.google.com/rss/headlines/section/topic/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Famosos: 'https://news.google.com/rss/search?q=celebridades+OR+fofoca+when:24h&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Futebol: 'https://news.google.com/rss/search?q=futebol+brasileiro+OR+brasileirao+when:24h&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Games: 'https://news.google.com/rss/search?q=games+OR+playstation+OR+xbox+when:24h&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Lifestyle: 'https://news.google.com/rss/search?q=estilo+de+vida+OR+comportamento+when:24h&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Educacao: 'https://news.google.com/rss/search?q=educacao+OR+enem+OR+carreira+when:24h&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Cultura: 'https://news.google.com/rss/search?q=cultura+OR+arte+OR+literatura+OR+teatro+when:24h&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Moda: 'https://news.google.com/rss/search?q=moda+OR+fashion+OR+tendencias+when:24h&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Musica: 'https://news.google.com/rss/search?q=musica+OR+shows+OR+album+OR+festival+when:24h&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Cinema: 'https://news.google.com/rss/search?q=cinema+OR+filmes+OR+streaming+when:24h&hl=pt-BR&gl=BR&ceid=BR:pt-419',
};

const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN || 'https://portalnovoalvo.com.br';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const MAX_ITEMS_PER_FEED = Number(process.env.MAX_ITEMS_PER_FEED || 80);
const MIN_SOURCES = Number(process.env.MIN_SOURCES || 8);
const RADAR_BATCHES_PER_CATEGORY = Number(process.env.RADAR_BATCHES_PER_CATEGORY || 3);
const HOUSEKEEPING_DAYS = Number(process.env.HOUSEKEEPING_DAYS || 30);
const MAX_IMAGE_SOURCE_FETCHES_PER_PITCH = Number(process.env.MAX_IMAGE_SOURCE_FETCHES_PER_PITCH || 8);
const SOURCE_EXPANSION_TARGET = Number(process.env.SOURCE_EXPANSION_TARGET || 12);
const SOURCE_EXPANSION_MIN_OVERLAP = Number(process.env.SOURCE_EXPANSION_MIN_OVERLAP || 0.34);
const ENABLE_SCRAPLING_ASSETS = process.env.ENABLE_SCRAPLING_ASSETS === '1';
const SCRAPLING_SOURCE_LIMIT = Number(process.env.SCRAPLING_SOURCE_LIMIT || 5);
const SCRAPLING_TIMEOUT_MS = Number(process.env.SCRAPLING_TIMEOUT_MS || 22000);
const SCRAPLING_MAX_PITCHES_PER_RUN = Number(process.env.SCRAPLING_MAX_PITCHES_PER_RUN || 18);
let scraplingPitchAttempts = 0;

const decodeEntities = (value) =>
  String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

const textBetween = (xml, tag) => {
  const match = String(xml).match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return decodeEntities(match?.[1] || '');
};

const attrBetween = (xml, tag, attr) => {
  const match = String(xml).match(new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, 'i'));
  return decodeEntities(match?.[1] || '');
};

const attrFromTag = (tag, attr) => {
  const match = String(tag || '').match(new RegExp(`\\s${attr}=["']([^"']+)["']`, 'i'));
  return decodeEntities(match?.[1] || '');
};

const cleanTitle = (title) =>
  decodeEntities(title)
    .replace(/\s+-\s+[^-]{2,80}$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

const extractKeywords = (title, category) => {
  const blocked = new Set(['para', 'com', 'uma', 'das', 'dos', 'que', 'por', 'sobre', 'apos', 'entre', 'como', 'mais']);
  const words = `${category} ${title}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 && !blocked.has(word));
  return [...new Set(words)].slice(0, 10);
};

const stripHtml = (value) =>
  decodeEntities(String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

const extractArticleText = (html) => {
  const candidates = [];
  for (const match of String(html).matchAll(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/gi)) {
    candidates.push(stripHtml(match[1]));
  }
  const paragraphText = [...String(html).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((text) => text.length > 40)
    .join(' ');
  if (paragraphText) candidates.push(paragraphText);
  candidates.push(stripHtml(html));
  return candidates
    .sort((a, b) => b.length - a.length)[0]
    ?.replace(/\s+/g, ' ')
    .slice(0, 2600) || '';
};

const isBlockedImageUrl = (value) => {
  const url = String(value || '').toLowerCase();
  return (
    /(logo|avatar|icon|sprite|profile|pixel|tracking|blank|placeholder|favicon|author|badge|watermark)/i.test(url) ||
    /(^|\/\/|\.)(google|gstatic|googleusercontent)\./i.test(url) ||
    /google(?:logo|news)|google\.com\/images\/branding|gstatic\.com\/images\/branding|www\.gstatic\.com\/images\/branding/i.test(url)
  );
};

const isUsableImage = (value) => {
  const url = String(value || '');
  if (!/^https:\/\//i.test(url)) return false;
  if (/source\.unsplash\.com/i.test(url)) return false;
  if (/\.(svg|gif|ico)(\?|$)/i.test(url)) return false;
  if (isBlockedImageUrl(url)) return false;
  return true;
};

const imageKey = (value) => {
  try {
    const url = new URL(String(value || ''));
    return `${url.hostname}${url.pathname}`.toLowerCase().replace(/\/+/g, '/');
  } catch {
    return String(value || '').toLowerCase().split('?')[0];
  }
};

const uniqueImages = (values, limit = 16) => {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const url = String(value || '');
    if (!isUsableImage(url)) continue;
    const key = imageKey(url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(url);
    if (output.length >= limit) break;
  }
  return output;
};

const imageCandidateUrl = (value) => (typeof value === 'object' && value ? value.url : value);

const uniqueImageCandidates = (values, limit = 16) => {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const url = String(imageCandidateUrl(value) || '');
    if (!isUsableImage(url)) continue;
    const key = imageKey(url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(typeof value === 'object' && value ? { ...value, url } : { url });
    if (output.length >= limit) break;
  }
  return output;
};

const normalizedText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const CATEGORY_SIGNALS = [
  {
    category: 'Futebol',
    pattern:
      /\b(futebol|brasileirao|serie\s?[abcd]|copa do brasil|libertadores|sul-americana|corinthians|flamengo|fluminense|palmeiras|sao paulo|santos|vasco|botafogo|gremio|internacional|cruzeiro|atletico|bahia|fortaleza|guarani|mirassol|santa cruz|diniz|luxemburgo|tecnico|treinador|vitoria|derrota|clube|time|estadio|rodada)\b/i,
  },
  {
    category: 'Politica',
    pattern: /\b(politica|governo|congresso|senado|camara|stf|planalto|eleicao|eleicoes|prefeito|governador|presidente|ministro|deputado|senador)\b/i,
  },
  {
    category: 'Economia',
    pattern:
      /\b(economia|mercado|emprego|vagas|salario|renda|trabalho|trabalhador|trabalhadora|carreira|empresa|empresas|negocios|credito|juros|inflacao|bolsa|maternidade|licenca maternidade|teto materno|infojobs)\b/i,
  },
  {
    category: 'Games',
    pattern: /\b(games?|playstation|xbox|nintendo|steam|game pass|gta|fortnite|minecraft|console|ps5)\b/i,
  },
  {
    category: 'Musica',
    pattern: /\b(musica|show|shows|album|single|turne|festival|cantor|cantora|banda|funk|sertanejo|rap|pop|rock)\b/i,
  },
  {
    category: 'Cinema',
    pattern: /\b(cinema|filme|filmes|serie|series|streaming|festival de cannes|oscar|bilheteria|hbo|max|prime video)\b/i,
  },
  {
    category: 'Cultura',
    pattern: /\b(cultura|arte|artes|literatura|livro|livros|teatro|exposicao|museu|bienal)\b/i,
  },
  {
    category: 'Moda',
    pattern: /\b(moda|fashion|look|looks|tendencia|tendencias|passarela|estilista|vestido|grife|colecao)\b/i,
  },
];

const classifyCategory = (feedCategory, title, source) => {
  const text = normalizedText(`${title} ${source}`);
  const matches = CATEGORY_SIGNALS.filter((item) => item.pattern.test(text));
  const priorityMatch = ['Futebol', 'Politica', 'Games', 'Cinema', 'Musica', 'Cultura'].map((category) => matches.find((item) => item.category === category)).find(Boolean);
  const economy = matches.find((item) => item.category === 'Economia');
  const fashion = matches.find((item) => item.category === 'Moda');
  const fashionScore = (text.match(/\b(moda|fashion|look|looks|tendencia|tendencias|passarela|estilista|vestido|grife|colecao)\b/gi) || []).length;
  if (priorityMatch) return priorityMatch.category;
  if (economy && (feedCategory === 'Educacao' || feedCategory === 'Lifestyle' || feedCategory === 'Brasil')) return 'Economia';
  if (fashion && fashionScore < 2 && feedCategory !== 'Moda') return feedCategory;
  const matched = matches[0];
  if (!matched || matched.category === feedCategory) return feedCategory;
  const feedSignal = CATEGORY_SIGNALS.find((item) => item.category === feedCategory);
  if (feedSignal?.pattern.test(text) && feedCategory !== 'Moda' && feedCategory !== 'Educacao') return feedCategory;
  return matched.category;
};

const absoluteUrl = (value, base) => {
  try {
    return new URL(decodeEntities(value), base).toString();
  } catch {
    return '';
  }
};

const imagesFromArticleHtml = (html, baseUrl) => {
  const output = [];
  const push = (value) => {
    const url = absoluteUrl(value, baseUrl);
    if (isUsableImage(url)) output.push(url);
  };

  for (const match of String(html).matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const name = `${attrFromTag(tag, 'property')} ${attrFromTag(tag, 'name')}`.toLowerCase();
    if (/(^|\s)(og:image|twitter:image|twitter:image:src)(\s|$)/i.test(name)) push(attrFromTag(tag, 'content'));
  }

  for (const match of String(html).matchAll(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["'][^>]*>/gi)) {
    const candidate = match[1] || '';
    if (isBlockedImageUrl(candidate) || /alt=["'][^"']*(logo|avatar|marca|perfil|icone|Ã­cone|google)[^"']*["']/i.test(match[0])) continue;
    push(candidate);
  }

  for (const match of String(html).matchAll(/"image"\s*:\s*(?:"([^"]+)"|\[([\s\S]*?)\]|\{([\s\S]*?)\})/gi)) {
    const raw = match[1] || match[2] || match[3] || '';
    for (const urlMatch of raw.matchAll(/https?:\\?\/\\?\/[^"',}\]\s]+/gi)) {
      push(urlMatch[0].replace(/\\\//g, '/'));
    }
  }

  for (const match of String(html).matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const tag = match[0];
    const candidate =
      attrFromTag(tag, 'src') ||
      attrFromTag(tag, 'data-src') ||
      attrFromTag(tag, 'data-original') ||
      attrFromTag(tag, 'data-lazy-src') ||
      '';
    if (isBlockedImageUrl(candidate) || /alt=["'][^"']*(logo|avatar|marca|perfil|icone|google)[^"']*["']/i.test(tag)) continue;
    push(candidate);
    const srcset = attrFromTag(tag, 'srcset') || attrFromTag(tag, 'data-srcset');
    if (srcset) {
      const urls = srcset
        .split(',')
        .map((item) => item.trim().split(/\s+/)[0])
        .filter(Boolean);
      push(urls.at(-1) || urls[0]);
    }
  }

  return uniqueImages(output, 10);
};

const isGoogleNewsUrl = (url) => /^https?:\/\/([^/]+\.)?news\.google\./i.test(String(url || ''));

const resolveArticleUrl = async (url) => {
  try {
    if (!isGoogleNewsUrl(url)) return url;
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'PortalNovoAlvoImageScout/1.0',
      },
      signal: AbortSignal.timeout(8000),
    });
    const finalUrl = response.url || url;
    if (finalUrl && !isGoogleNewsUrl(finalUrl)) return finalUrl;
    const html = await response.text().catch(() => '');
    const canonical = attrBetween(html, 'link', 'href');
    if (canonical && !isGoogleNewsUrl(canonical)) return canonical;
    const external = [...html.matchAll(/https?:\/\/(?![^"'\s]*?(?:news\.google|google\.com|gstatic\.com|googleusercontent\.com))[^"'\s<>]+/gi)]
      .map((match) => match[0])
      .find(Boolean);
    return external || url;
  } catch {
    return url;
  }
};

const fetchArticleAssets = async (url) => {
  try {
    if (/^https?:\/\/([^/]+\.)?(google|gstatic|googleusercontent)\./i.test(String(url || '')) && !isGoogleNewsUrl(url)) {
      return { url, images: [], excerpt: '' };
    }
    const articleUrl = await resolveArticleUrl(url);
    if (/^https?:\/\/([^/]+\.)?(google|gstatic|googleusercontent)\./i.test(String(articleUrl || ''))) {
      return { url: articleUrl, images: [], excerpt: '' };
    }
    const response = await fetch(articleUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'PortalNovoAlvoImageScout/1.0',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { url: articleUrl, images: [], excerpt: '' };
    const contentType = response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(contentType)) return { url: articleUrl, images: [], excerpt: '' };
    const html = await response.text();
    const finalUrl = response.url || articleUrl;
    return {
      url: finalUrl,
      images: imagesFromArticleHtml(html, finalUrl),
      excerpt: extractArticleText(html),
    };
  } catch {
    return { url, images: [], excerpt: '' };
  }
};

const fetchScraplingAssets = (sources, category) => {
  if (!ENABLE_SCRAPLING_ASSETS || !sources.length) return [];
  if (scraplingPitchAttempts >= SCRAPLING_MAX_PITCHES_PER_RUN) return [];
  scraplingPitchAttempts += 1;
  const payload = {
    category,
    sources: sources.slice(0, SCRAPLING_SOURCE_LIMIT).map((source) => ({
      title: source.title,
      publisher: source.publisher,
      url: source.url,
      publishedAt: source.publishedAt,
      category,
    })),
  };

  const command = process.env.PYTHON || 'python3';
  const result = spawnSync(command, ['scripts/extract-source-assets.py'], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: SCRAPLING_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });

  if (result.error || result.status !== 0) {
    const message = result.error?.message || result.stderr || `status ${result.status}`;
    console.warn(`[scrapling] assets indisponiveis: ${String(message).slice(0, 180)}`);
    return [];
  }

  try {
    const data = JSON.parse(result.stdout || '{}');
    return Array.isArray(data.sources) ? data.sources : [];
  } catch (error) {
    console.warn(`[scrapling] JSON invalido: ${error.message}`);
    return [];
  }
};

const keywordSet = (item) => new Set(extractKeywords(item.title, item.category).slice(0, 8));

const overlapScore = (left, right) => {
  const a = keywordSet(left);
  const b = keywordSet(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) {
    if (b.has(token)) shared += 1;
  }
  return shared / Math.min(a.size, b.size);
};

const recencyScore = (item) => {
  const timestamp = Date.parse(item?.publishedAt || '');
  if (!timestamp) return 0;
  const hours = Math.max(0, (Date.now() - timestamp) / 36e5);
  return Math.max(0, 1 - hours / 48);
};

const itemRelevanceScore = (item, peers = []) => {
  const related = peers.reduce((total, peer) => (peer === item ? total : total + overlapScore(item, peer)), 0);
  const title = normalizedText(item?.title || '');
  const hasNamedSignal = /\b([a-z]{4,}|[0-9]{2,})\b/.test(title) ? 0.15 : 0;
  const sourceWeight = item?.source && !/google news/i.test(item.source) ? 0.15 : 0;
  return related + recencyScore(item) * 0.45 + hasNamedSignal + sourceWeight;
};

const selectLeadItem = (items) =>
  [...items].sort((a, b) => itemRelevanceScore(b, items) - itemRelevanceScore(a, items))[0] || items[0];

const buildNewsSearchUrl = (seed) => {
  const keywords = extractKeywords(seed.title, seed.category).slice(0, 7);
  const compactTitle = cleanTitle(seed.title)
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 9)
    .join(' ');
  const query = `${compactTitle || keywords.join(' ')} ${keywords.slice(0, 3).join(' ')} when:48h`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
};

const fetchExpandedItemsForSeed = async (seed) => {
  try {
    const response = await fetch(buildNewsSearchUrl(seed), {
      headers: {
        accept: 'application/rss+xml, application/xml, text/xml',
        'user-agent': 'PortalNovoAlvoEditorialIngest/1.0',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseRssItems(await response.text(), seed.category)
      .map((item) => ({
        ...item,
        category: seed.category,
        expandedFrom: seed.title,
      }))
      .filter((item) => overlapScore(seed, item) >= SOURCE_EXPANSION_MIN_OVERLAP || normalizedText(item.title).includes(normalizedText(seed.title).slice(0, 28)));
  } catch (error) {
    console.warn(`[expand] ${seed.category}: ${error.message}`);
    return [];
  }
};

const expandClusterSources = async (items) => {
  const lead = selectLeadItem(items);
  const expanded = await fetchExpandedItemsForSeed(lead);
  const merged = distinctBySource([lead, ...items, ...expanded])
    .map((item) => ({
      ...item,
      topicScore: item === lead ? 999 : overlapScore(lead, item) + recencyScore(item) * 0.2,
    }))
    .filter((item) => item === lead || item.topicScore >= SOURCE_EXPANSION_MIN_OVERLAP)
    .sort((a, b) => b.topicScore - a.topicScore);
  const selected = distinctBySource(merged).slice(0, Math.max(MIN_SOURCES, SOURCE_EXPANSION_TARGET));
  return selected.length >= Math.min(MIN_SOURCES, items.length) ? selected : items;
};

const distinctBySource = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item.source || item.link || item.title).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const clusterItems = (items) => {
  const clusters = [];
  const sorted = [...items].sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));

  for (const item of sorted) {
    const match = clusters.find((cluster) => {
      if (cluster[0]?.category !== item.category) return false;
      return cluster.some((candidate) => overlapScore(candidate, item) >= 0.3);
    });

    if (match) {
      match.push(item);
    } else {
      clusters.push([item]);
    }
  }

  return clusters;
};

const buildCategoryRadarClusters = async (items) => {
  const byCategory = new Map();
  for (const item of items) {
    const bucket = byCategory.get(item.category) || [];
    bucket.push(item);
    byCategory.set(item.category, bucket);
  }

  const clusters = [];
  for (const [, categoryItems] of byCategory.entries()) {
    const seeds = distinctBySource(categoryItems)
      .sort((a, b) => itemRelevanceScore(b, categoryItems) - itemRelevanceScore(a, categoryItems))
      .slice(0, RADAR_BATCHES_PER_CATEGORY);
    for (const seed of seeds) {
      const expanded = await expandClusterSources([seed]);
      const batch = expanded
        .filter((item) => item === seed || overlapScore(seed, item) >= SOURCE_EXPANSION_MIN_OVERLAP)
        .slice(0, Math.max(MIN_SOURCES, SOURCE_EXPANSION_TARGET))
        .map((item) => ({
          ...item,
          title: item.title,
          radarCluster: true,
          radarSeed: seed.title,
        }));
      if (distinctBySource(batch).length >= MIN_SOURCES) clusters.push(batch);
    }
  }
  return clusters;
};

const parseRssItems = (xml, category) => {
  const items = [...String(xml).matchAll(/<item\b[\s\S]*?<\/item>/gi)].slice(0, MAX_ITEMS_PER_FEED);
  return items.map((match) => {
    const itemXml = match[0];
    const rawTitle = textBetween(itemXml, 'title');
    const title = cleanTitle(rawTitle);
    const source = textBetween(itemXml, 'source') || rawTitle.split(' - ').pop() || 'Google News';
    const finalCategory = classifyCategory(category, title, source);
    const googleLink = textBetween(itemXml, 'link');
    const sourceUrl = attrBetween(itemXml, 'source', 'url');
    const link = googleLink || sourceUrl;
    const publishedAt = textBetween(itemXml, 'pubDate');

    return {
      title,
      category: finalCategory,
      feedCategory: category,
      link,
      googleLink,
      sourceUrl,
      source,
      publishedAt,
    };
  }).filter((item) => item.title && item.link);
};

const fetchFeed = async ([category, url]) => {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/rss+xml, application/xml, text/xml',
        'user-agent': 'PortalNovoAlvoEditorialIngest/1.0',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseRssItems(await response.text(), category);
  } catch (error) {
    console.warn(`[feed] ${category}: ${error.message}`);
    return [];
  }
};

const buildPitch = (items) => {
  const first = selectLeadItem(items);
  const orderedItems = [first, ...items.filter((item) => item !== first)].sort((a, b) => {
    if (a === first) return -1;
    if (b === first) return 1;
    return itemRelevanceScore(b, items) - itemRelevanceScore(a, items);
  });
  const seenPublishers = new Set();
  const sources = orderedItems
    .map((item) => ({
      publisher: item.source,
      title: item.title,
      url: item.link,
      publishedAt: item.publishedAt,
    }))
    .filter((source) => {
      const key = String(source.publisher || source.url || source.title).toLowerCase();
      if (!key || seenPublishers.has(key)) return false;
      seenPublishers.add(key);
      return true;
    });
  const uniquePublishers = [...new Set(sources.map((source) => source.publisher).filter(Boolean))];
  const keywords = extractKeywords(first.title, first.category);
  const sourceCount = uniquePublishers.length || sources.length;
  const sourceQuality = Math.min(8, sourceCount);
  const imageCandidates = [];

  const isRadar = items.some((item) => item.radarCluster);
  const newestTime = Math.max(...items.map((item) => Date.parse(item.publishedAt) || 0), Date.now());
  const newest = new Date(newestTime);
  const sixHourBucket = `${newest.getUTCFullYear()}${String(newest.getUTCMonth() + 1).padStart(2, '0')}${String(newest.getUTCDate()).padStart(2, '0')}-${Math.floor(newest.getUTCHours() / 6)}`;
  const signature = isRadar
    ? [sixHourBucket, ...items
        .slice(0, 4)
        .map((item) => slugify(item.title).slice(0, 42))
      ].join('-')
    : slugify(first.title);

  return {
    clusterKey: `${slugify(first.category)}:${isRadar ? 'radar:' : ''}${signature}`,
    title: first.title,
    summary: `O fato central envolve ${first.title}. A abordagem editorial deve identificar o agente ativo, a causa imediata e a consequencia concreta para o leitor.`,
    category: first.category,
    status: 'new',
    sourceCount,
    primaryUrl: first.link,
    sources,
    tags: keywords,
    keywords: keywords.join(', '),
    internalLinks: [],
    imageCandidates,
    score: Math.min(1000, sourceQuality * 110 + keywords.length * 5 + Math.max(0, sourceCount - 8) * 12),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
};

const enrichPitchImages = async (pitch) => {
  const current = Array.isArray(pitch.imageCandidates) ? pitch.imageCandidates : [];
  const sources = Array.isArray(pitch.sources) ? pitch.sources : [];
  let assets = await Promise.all(
    sources
      .slice(0, MAX_IMAGE_SOURCE_FETCHES_PER_PITCH)
      .map(async (source) => ({
        source,
        assets: await fetchArticleAssets(source.url),
      })),
  );

  const nodeImageCount = assets.reduce((total, item) => total + (item.assets?.images?.length || 0), 0);
  if (nodeImageCount < 2) {
    const scraplingSources = fetchScraplingAssets(sources, pitch.category);
    if (scraplingSources.length) {
      const bySourceKey = new Map(
        scraplingSources.map((source) => [String(source.url || source.sourceUrl || source.title || '').toLowerCase(), source]),
      );
      assets = assets.map((item) => {
        const key = String(item.source?.url || item.source?.title || '').toLowerCase();
        const enriched = bySourceKey.get(key);
        if (!enriched) return item;
        return {
          source: item.source,
          assets: {
            url: enriched.resolvedUrl || item.assets?.url || item.source.url,
            images: Array.isArray(enriched.images) ? enriched.images.map((image) => image.url).filter(Boolean) : item.assets?.images || [],
            excerpt: item.assets?.excerpt || enriched.excerpt || '',
          },
        };
      });
    }
  }
  const sourceImages = assets
    .map(({ source, assets }) =>
      assets.images.map((url) => ({
        url,
        sourceTitle: source.title,
        sourcePublisher: source.publisher,
        sourceUrl: assets.url || source.url,
        category: pitch.category,
      })),
    )
    .flat();
  const enrichedSources = sources.map((source) => {
    const match = assets.find((item) => item.source === source);
    if (!match?.assets) return source;
    return {
      ...source,
      url: match.assets.url || source.url,
      excerpt: match.assets.excerpt || source.excerpt || '',
    };
  });

  return {
    ...pitch,
    sources: enrichedSources,
    imageCandidates: uniqueImageCandidates([...current, ...sourceImages], 18),
  };
};

const postPitch = async (pitch) => {
  const response = await fetch(`${PORTAL_ORIGIN}/api/admin/pitches`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ADMIN_TOKEN}`,
    },
    body: JSON.stringify(pitch),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Falha ao salvar pauta: ${response.status}`);
  return data;
};

const postIngestRun = async (run) => {
  try {
    const response = await fetch(`${PORTAL_ORIGIN}/api/admin/ingest-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify(run),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Falha ao registrar ingestao: ${response.status}`);
  } catch (error) {
    console.warn(`[ingest-runs] ${error.message}`);
  }
};

const runHousekeeping = async () => {
  const response = await fetch(`${PORTAL_ORIGIN}/api/admin/pitches?olderThanDays=${HOUSEKEEPING_DAYS}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    console.warn(`[housekeeping] ${data.error || response.status}`);
  }
};

const addUniquePitch = (selected, seen, pitch) => {
  if (!pitch || seen.has(pitch.clusterKey)) return false;
  selected.push(pitch);
  seen.add(pitch.clusterKey);
  return true;
};

const balancePitches = (topicPitches, radarPitches, limit) => {
  const selected = [];
  const seen = new Set();
  const radarByCategory = new Map();

  for (const pitch of radarPitches) {
    if (!radarByCategory.has(pitch.category)) radarByCategory.set(pitch.category, []);
    radarByCategory.get(pitch.category).push(pitch);
  }

  for (const category of Object.keys(FEEDS)) {
    addUniquePitch(selected, seen, radarByCategory.get(category)?.[0]);
    if (selected.length >= limit) return selected;
  }

  for (const pitch of [...topicPitches, ...radarPitches]) {
    addUniquePitch(selected, seen, pitch);
    if (selected.length >= limit) return selected;
  }

  return selected;
};

const main = async () => {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN ausente.');
  const startedAt = new Date().toISOString();

  const allItems = (await Promise.all(Object.entries(FEEDS).map(fetchFeed))).flat();
  const feedCounts = allItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  const topicClusters = await Promise.all(clusterItems(allItems).map(expandClusterSources));
  const topicPitches = topicClusters
    .map(buildPitch)
    .filter((pitch) => pitch.sourceCount >= MIN_SOURCES)
    .sort((a, b) => b.score - a.score);
  const radarPitches = (await buildCategoryRadarClusters(allItems))
    .map(buildPitch)
    .filter((pitch) => pitch.sourceCount >= MIN_SOURCES && !topicPitches.some((existing) => existing.clusterKey === pitch.clusterKey))
    .sort((a, b) => b.score - a.score);
  const pitches = balancePitches(topicPitches, radarPitches, Number(process.env.MAX_PITCHES || 80));

  let saved = 0;
  const enrichedPitches = await Promise.all(pitches.map(enrichPitchImages));

  await Promise.all(
    enrichedPitches.map(async (pitch) => {
      try {
        await postPitch(pitch);
        saved += 1;
      } catch (error) {
        console.warn(`[pitch] ${pitch.title}: ${error.message}`);
      }
    }),
  );

  await runHousekeeping();
  const skipped = Math.max(0, pitches.length - saved);
  await postIngestRun({
    id: `ingest:${startedAt}`,
    status: skipped > 0 ? 'partial' : 'success',
    itemsTotal: allItems.length,
    topicClusters: topicPitches.length,
    radarClusters: radarPitches.length,
    selectedPitches: pitches.length,
    savedPitches: saved,
    skippedPitches: skipped,
    feedCounts,
    startedAt,
    finishedAt: new Date().toISOString(),
    notes: `${saved}/${pitches.length} pautas salvas`,
  });
  console.log(
    `Ingestao concluida: ${saved}/${pitches.length} pautas salvas. Itens: ${allItems.length}. Clusters por assunto: ${topicPitches.length}. Radares por categoria: ${radarPitches.length}.`,
  );
  console.log(`Itens por categoria: ${JSON.stringify(feedCounts)}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

