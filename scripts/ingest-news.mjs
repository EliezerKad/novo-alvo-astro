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

const FALLBACK_IMAGE_TERMS = {
  Brasil: 'brasil,news,city',
  Mundo: 'world,news,geopolitics',
  Economia: 'economy,business,finance',
  Tecnologia: 'technology,artificial-intelligence,devices',
  Entretenimento: 'entertainment,culture,event',
  Esportes: 'sports,stadium,football',
  Ciencia: 'science,laboratory,research',
  Saude: 'health,hospital,medicine',
  Famosos: 'celebrity,red-carpet,entertainment',
  Futebol: 'football,stadium,soccer',
  Games: 'gaming,console,technology',
  Lifestyle: 'lifestyle,people,city',
  Educacao: 'education,students,school',
  Moda: 'fashion,style,runway',
  Cinema: 'cinema,movie,theater',
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

const imageFromDescription = (xml) => {
  const description = textBetween(xml, 'description');
  const match = description.match(/<img[^>]+src=["']([^"']+)["']/i);
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

const fallbackImageFor = (category, keywords) => {
  const terms = FALLBACK_IMAGE_TERMS[category] || `${category},news`;
  const search = encodeURIComponent([terms, ...keywords.slice(0, 2)].filter(Boolean).join(','));
  return `https://source.unsplash.com/1600x900/?${search}`;
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
    const link = textBetween(itemXml, 'link');
    const publishedAt = textBetween(itemXml, 'pubDate');
    const imageUrl =
      attrBetween(itemXml, 'media:content', 'url') ||
      attrBetween(itemXml, 'media:thumbnail', 'url') ||
      attrBetween(itemXml, 'enclosure', 'url') ||
      imageFromDescription(itemXml);

    return {
      title,
      category,
      link,
      source,
      publishedAt,
      imageUrl,
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
  const rssImages = items.map((item) => item.imageUrl).filter(Boolean);
  const imageCandidates = [...new Set([...rssImages, fallbackImageFor(first.category, keywords)])].slice(0, 6);

  const isRadar = items.some((item) => item.radarCluster);
  const signature = isRadar
    ? items
        .slice(0, 4)
        .map((item) => slugify(item.title).slice(0, 42))
        .join('-')
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
  await Promise.all(
    pitches.map(async (pitch) => {
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
