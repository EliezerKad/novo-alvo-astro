const FEEDS = {
  Brasil:
    'https://news.google.com/rss/headlines/section/topic/CAAqJQgKIh9DQkFTRVFvSUwyMHZNRzV6Y0hjU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
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
  Moda: 'https://news.google.com/rss/search?q=moda+OR+fashion+OR+tendencias+when:24h&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  Cinema: 'https://news.google.com/rss/search?q=cinema+OR+filmes+OR+streaming+when:24h&hl=pt-BR&gl=BR&ceid=BR:pt-419',
};

const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN || 'https://portalnovoalvo.com.br';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const MAX_ITEMS_PER_FEED = Number(process.env.MAX_ITEMS_PER_FEED || 80);
const MIN_SOURCES = Number(process.env.MIN_SOURCES || 8);
const RADAR_BATCHES_PER_CATEGORY = Number(process.env.RADAR_BATCHES_PER_CATEGORY || 3);
const HOUSEKEEPING_DAYS = Number(process.env.HOUSEKEEPING_DAYS || 30);
const MAX_IMAGE_SOURCE_FETCHES_PER_PITCH = Number(process.env.MAX_IMAGE_SOURCE_FETCHES_PER_PITCH || 5);

const CATEGORY_IMAGES = {
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
  const match = String(xml).match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"[^>]*>`, 'i'));
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

  for (const attr of ['property="og:image"', 'name="twitter:image"', 'property="twitter:image"']) {
    const match = String(html).match(new RegExp(`<meta[^>]+${attr}[^>]+content=["']([^"']+)["'][^>]*>`, 'i'));
    if (match?.[1]) push(match[1]);
  }

  for (const match of String(html).matchAll(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["'][^>]*>/gi)) {
    const candidate = match[1] || '';
    if (isBlockedImageUrl(candidate) || /alt=["'][^"']*(logo|avatar|marca|perfil|icone|ícone|google)[^"']*["']/i.test(match[0])) continue;
    push(candidate);
  }

  return uniqueImages(output, 10);
};

const fetchArticleImages = async (url) => {
  try {
    if (/^https?:\/\/([^/]+\.)?(news\.google|google|gstatic|googleusercontent)\./i.test(String(url || ''))) return [];
    const response = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'PortalNovoAlvoImageScout/1.0',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const contentType = response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(contentType)) return [];
    return imagesFromArticleHtml(await response.text(), response.url || url);
  } catch {
    return [];
  }
};

const fallbackImageFor = (category) => CATEGORY_IMAGES[category] || CATEGORY_IMAGES.Brasil;

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

const buildCategoryRadarClusters = (items) => {
  const byCategory = new Map();
  for (const item of items) {
    const bucket = byCategory.get(item.category) || [];
    bucket.push(item);
    byCategory.set(item.category, bucket);
  }

  const clusters = [];
  for (const [category, categoryItems] of byCategory.entries()) {
    const distinct = distinctBySource(categoryItems);
    const maxItems = Math.max(MIN_SOURCES, MIN_SOURCES * RADAR_BATCHES_PER_CATEGORY);
    const usable = distinct.slice(0, maxItems);
    for (let start = 0; start < usable.length; start += MIN_SOURCES) {
      const batch = usable.slice(start, start + MIN_SOURCES);
      if (batch.length < MIN_SOURCES) continue;
      clusters.push(
        batch.map((item, index) => ({
          ...item,
          title: index === 0 ? `Radar ${category}: ${item.title}` : item.title,
          radarCluster: true,
          radarBatch: Math.floor(start / MIN_SOURCES) + 1,
        })),
      );
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
    const googleLink = textBetween(itemXml, 'link');
    const sourceUrl = attrBetween(itemXml, 'source', 'url');
    const link = sourceUrl || googleLink;
    const publishedAt = textBetween(itemXml, 'pubDate');

    return {
      title,
      category,
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
  const first = items[0];
  const seenPublishers = new Set();
  const sources = items
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
  const imageCandidates = uniqueImages([fallbackImageFor(first.category)], 6);

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
    summary: `Pauta consolidada por ${sourceCount} fonte${sourceCount === 1 ? '' : 's'} sobre ${first.title}. O rascunho exige ângulo próprio, contexto local e checagem editorial antes da fila.`,
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
  const sourceImages = (
    await Promise.all(
      sources
        .slice(0, MAX_IMAGE_SOURCE_FETCHES_PER_PITCH)
        .map((source) => fetchArticleImages(source.url)),
    )
  ).flat();

  return {
    ...pitch,
    imageCandidates: uniqueImages([...current, ...sourceImages], 16),
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

const main = async () => {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN ausente.');

  const allItems = (await Promise.all(Object.entries(FEEDS).map(fetchFeed))).flat();
  const feedCounts = allItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  const topicClusters = clusterItems(allItems);
  const topicPitches = topicClusters
    .map(buildPitch)
    .filter((pitch) => pitch.sourceCount >= MIN_SOURCES)
    .sort((a, b) => b.score - a.score);
  const radarPitches = buildCategoryRadarClusters(allItems)
    .map(buildPitch)
    .filter((pitch) => pitch.sourceCount >= MIN_SOURCES && !topicPitches.some((existing) => existing.clusterKey === pitch.clusterKey))
    .sort((a, b) => b.score - a.score);
  const pitches = [...topicPitches, ...radarPitches]
    .slice(0, Number(process.env.MAX_PITCHES || 80));

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
  console.log(
    `Ingestao concluida: ${saved}/${pitches.length} pautas salvas. Itens: ${allItems.length}. Clusters por assunto: ${topicPitches.length}. Radares por categoria: ${radarPitches.length}.`,
  );
  console.log(`Itens por categoria: ${JSON.stringify(feedCounts)}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
