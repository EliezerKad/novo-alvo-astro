const googleNewsSearch = (query) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

const FEEDS = {
  Brasil: [
    'https://news.google.com/rss/headlines/section/topic/CAAqJQgKIh9DQkFTRVFvSUwyMHZNRzV6Y0hjU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('Brasil governo estados cidades crise servicos publicos when:12h'),
    googleNewsSearch('brasileiros policia transporte educacao saude urbana when:12h'),
  ],
  Politica: [
    googleNewsSearch('politica OR governo OR congresso OR STF OR eleicoes when:12h'),
    googleNewsSearch('Planalto Congresso Senado Camara STF bastidores poder when:12h'),
    googleNewsSearch('Lula Bolsonaro ministro deputado senador governo when:12h'),
  ],
  Mundo: [
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('geopolitica guerra eleicoes mundo impacto Brasil when:12h'),
    googleNewsSearch('Estados Unidos China Europa Argentina Oriente Medio when:12h'),
  ],
  Economia: [
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVd4b1NKVXlMd0pVUXlnQVAB?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('economia juros inflacao dolar bolsa emprego credito when:12h'),
    googleNewsSearch('mercado empresas bancos governo poder de compra when:12h'),
  ],
  Tecnologia: [
    'https://news.google.com/rss/headlines/section/topic/CAAqKggKIiRDQkFTRFvSUwyMHZNRGRqTVhZU0JXVnVMVWRDR2dKUVN5Z0FQAQ?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('tecnologia inteligencia artificial chips ciberseguranca app when:12h'),
    googleNewsSearch('big tech apple google microsoft meta openai dados privacidade when:12h'),
  ],
  Entretenimento: [
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVdZU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('entretenimento tv streaming reality show cultura pop when:12h'),
    googleNewsSearch('celebridades internet viral audiencia tiktok evento when:12h'),
  ],
  Esportes: [
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('esportes olimpico volei basquete formula surf tenis when:12h'),
    googleNewsSearch('competicao atleta tecnico final campeonato recorde when:12h'),
  ],
  Ciencia: [
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('ciencia pesquisa espaco clima descoberta estudo cientifico when:12h'),
    googleNewsSearch('nasa astronomia biologia ambiente inovacao universidade when:12h'),
  ],
  Saude: [
    'https://news.google.com/rss/headlines/section/topic/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('saude medicina vacina hospital bem estar doenca when:12h'),
    googleNewsSearch('ans sus medicamento pesquisa clinica saude mental when:12h'),
  ],
  Famosos: [
    googleNewsSearch('celebridades famosos influenciadores bastidores viral when:12h'),
    googleNewsSearch('atriz cantor apresentador influencer relacionamento when:12h'),
  ],
  Futebol: [
    googleNewsSearch('futebol brasileiro brasileirao libertadores copa do brasil when:12h'),
    googleNewsSearch('flamengo corinthians palmeiras sao paulo vasco botafogo fluminense when:12h'),
    googleNewsSearch('mercado da bola tecnico SAF clube jogador when:12h'),
  ],
  Games: [
    googleNewsSearch('games playstation xbox nintendo steam game pass when:12h'),
    googleNewsSearch('ps5 xbox switch 2 gta fortnite lançamento bug review when:12h'),
  ],
  Lifestyle: [
    googleNewsSearch('estilo de vida comportamento viagem gastronomia produtividade when:12h'),
    googleNewsSearch('casa consumo tendencia comportamento familia rotina when:12h'),
  ],
  Educacao: [
    googleNewsSearch('educacao enem vestibular carreira escola universidade when:12h'),
    googleNewsSearch('mec professor aluno ensino superior concurso when:12h'),
  ],
  Cultura: [
    googleNewsSearch('cultura arte literatura teatro museu livro when:12h'),
    googleNewsSearch('exposicao festival premio autor artista cultura brasileira when:12h'),
  ],
  Moda: [
    googleNewsSearch('moda fashion tendencias passarela marca colecao when:12h'),
    googleNewsSearch('look estilista grife beleza consumo moda sustentavel when:12h'),
  ],
  Musica: [
    googleNewsSearch('musica shows album festival cantor cantora banda when:12h'),
    googleNewsSearch('turne single spotify funk sertanejo rap pop rock when:12h'),
  ],
  Cinema: [
    googleNewsSearch('cinema filmes streaming bilheteria festival Cannes Oscar when:12h'),
    googleNewsSearch('Netflix Max Prime Video Disney filme serie estreia when:12h'),
  ],
};

const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN || 'https://portalnovoalvo.com.br';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const MAX_ITEMS_PER_FEED = Number(process.env.MAX_ITEMS_PER_FEED || 80);
const MIN_SOURCES = Number(process.env.MIN_SOURCES || 8);
const RADAR_BATCHES_PER_CATEGORY = Number(process.env.RADAR_BATCHES_PER_CATEGORY || 3);
const MAX_ITEM_AGE_HOURS = Number(process.env.MAX_ITEM_AGE_HOURS || 30);
const HOUSEKEEPING_DAYS = Number(process.env.HOUSEKEEPING_DAYS || 30);
const SOURCE_EXPANSION_TARGET = Number(process.env.SOURCE_EXPANSION_TARGET || 12);
const SOURCE_EXPANSION_MIN_OVERLAP = Number(process.env.SOURCE_EXPANSION_MIN_OVERLAP || 0.34);

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

const itemAgeHours = (item) => {
  const timestamp = Date.parse(item?.publishedAt || '');
  if (!timestamp) return 999;
  return Math.max(0, (Date.now() - timestamp) / 36e5);
};

const isFreshItem = (item) => itemAgeHours(item) <= MAX_ITEM_AGE_HOURS;

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

const feedEntries = () =>
  Object.entries(FEEDS).flatMap(([category, urls]) =>
    (Array.isArray(urls) ? urls : [urls]).map((url, index) => [category, url, index]),
  );

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
  const signature = isRadar
    ? items
        .slice(0, 4)
        .map((item) => slugify(item.title).slice(0, 42))
        .join('-')
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

const normalizePitchAssets = async (pitch) => ({
  ...pitch,
  imageCandidates: Array.isArray(pitch.imageCandidates) ? pitch.imageCandidates : [],
});

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

  const rawItems = (await Promise.all(feedEntries().map(fetchFeed))).flat();
  const allItems = rawItems.filter(isFreshItem);
  const feedCounts = allItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  console.log(`Itens RSS brutos: ${rawItems.length}. Itens frescos (${MAX_ITEM_AGE_HOURS}h): ${allItems.length}.`);
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
  const enrichedPitches = await Promise.all(pitches.map(normalizePitchAssets));

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

