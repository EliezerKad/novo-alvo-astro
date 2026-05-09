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
};

const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN || 'https://portalnovoalvo.com.br';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const MAX_ITEMS_PER_FEED = Number(process.env.MAX_ITEMS_PER_FEED || 12);
const MIN_SOURCES = Number(process.env.MIN_SOURCES || 1);
const HOUSEKEEPING_DAYS = Number(process.env.HOUSEKEEPING_DAYS || 30);

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
      attrBetween(itemXml, 'enclosure', 'url');

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
  const sources = items.map((item) => ({
    publisher: item.source,
    title: item.title,
    url: item.link,
    publishedAt: item.publishedAt,
  }));
  const uniquePublishers = [...new Set(sources.map((source) => source.publisher).filter(Boolean))];
  const keywords = extractKeywords(first.title, first.category);
  const sourceCount = uniquePublishers.length || sources.length;

  return {
    clusterKey: `${slugify(first.category)}:${slugify(first.title)}`,
    title: first.title,
    summary: `Pauta identificada em ${sourceCount} fonte${sourceCount === 1 ? '' : 's'} sobre ${first.title}. Revisar ângulo próprio antes de transformar em matéria.`,
    category: first.category,
    status: 'new',
    sourceCount,
    primaryUrl: first.link,
    sources,
    tags: keywords,
    keywords: keywords.join(', '),
    internalLinks: [],
    imageCandidates: items.map((item) => item.imageUrl).filter(Boolean).slice(0, 6),
    score: Math.min(1000, sourceCount * 100 + keywords.length * 5),
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
  const clusters = new Map();
  for (const item of allItems) {
    const key = `${slugify(item.category)}:${slugify(item.title)}`;
    const current = clusters.get(key) || [];
    current.push(item);
    clusters.set(key, current);
  }

  const pitches = [...clusters.values()]
    .map(buildPitch)
    .filter((pitch) => pitch.sourceCount >= MIN_SOURCES)
    .sort((a, b) => b.score - a.score)
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
  console.log(`Ingestao concluida: ${saved}/${pitches.length} pautas salvas.`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
