const googleNewsSearch = (query) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

const FEEDS = {
  Brasil: [
    'https://news.google.com/rss/headlines/section/topic/CAAqJQgKIh9DQkFTRVFvSUwyMHZNRzV6Y0hjU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('ultimas noticias Brasil hoje governo sociedade seguranca when:72h'),
    googleNewsSearch('Brasil noticia quente cidades estados governo crise when:72h'),
    googleNewsSearch('Brasil governo estados cidades crise servicos publicos when:24h'),
    googleNewsSearch('brasileiros policia transporte educacao saude urbana when:24h'),
    googleNewsSearch('seguranca publica infraestrutura moradia energia transporte Brasil when:24h'),
    googleNewsSearch('prefeitura estado governador enchente crime investigacao comunidade when:24h'),
  ],
  Politica: [
    googleNewsSearch('politica OR governo OR congresso OR STF OR eleicoes when:24h'),
    googleNewsSearch('Planalto Congresso Senado Camara STF bastidores poder when:24h'),
    googleNewsSearch('Lula Bolsonaro ministro deputado senador governo when:24h'),
    googleNewsSearch('votacao projeto de lei relator partido base oposicao when:24h'),
    googleNewsSearch('governador prefeito camara municipal assembleia legislativa when:24h'),
  ],
  Mundo: [
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('geopolitica guerra eleicoes mundo impacto Brasil when:24h'),
    googleNewsSearch('Estados Unidos China Europa Argentina Oriente Medio when:24h'),
    googleNewsSearch('Trump Xi Putin Europa ONU conflito acordo internacional when:24h'),
    googleNewsSearch('imigracao sancoes comercio global diplomacia fronteira when:24h'),
  ],
  Economia: [
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVd4b1NKVXlMd0pVUXlnQVAB?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('economia juros inflacao dolar bolsa emprego credito when:24h'),
    googleNewsSearch('mercado empresas bancos governo poder de compra when:24h'),
    googleNewsSearch('Banco Central Selic IPCA varejo industria contas publicas when:24h'),
    googleNewsSearch('petrobras imposto arrecadacao investimento divida consumo when:24h'),
  ],
  Tecnologia: [
    'https://news.google.com/rss/headlines/section/topic/CAAqKggKIiRDQkFTRFvSUwyMHZNRGRqTVhZU0JXVnVMVWRDR2dKUVN5Z0FQAQ?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('tecnologia inteligencia artificial chips ciberseguranca app when:24h'),
    googleNewsSearch('big tech apple google microsoft meta openai dados privacidade when:24h'),
    googleNewsSearch('startup software hardware vazamento dados android iphone when:24h'),
    googleNewsSearch('IA generativa data center semicondutor robotica seguranca digital when:24h'),
    googleNewsSearch('OpenAI Nvidia chip data center ciberseguranca vazamento when:48h'),
    googleNewsSearch('android iphone apple google microsoft meta tecnologia brasil when:48h'),
    googleNewsSearch('golpe digital app banco dados privacidade inteligencia artificial when:48h'),
  ],
  Entretenimento: [
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVdZU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('entretenimento tv streaming reality show cultura pop when:24h'),
    googleNewsSearch('celebridades internet viral audiencia tiktok evento when:24h'),
    googleNewsSearch('reality show novela televisao audiencia participante eliminacao when:24h'),
    googleNewsSearch('BBB A Fazenda MasterChef novela Globo SBT Record when:24h'),
    googleNewsSearch('serie plataforma trailer estreia audiencia programa apresentador when:24h'),
  ],
  Esportes: [
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('esportes olimpico volei basquete formula surf tenis when:24h'),
    googleNewsSearch('competicao atleta tecnico final campeonato recorde when:24h'),
    googleNewsSearch('volei basquete tenis formula 1 surf ufc atletismo natacao when:24h'),
    googleNewsSearch('nba nfl mma skate ginastica olimpica brasileiro mundial when:24h'),
    googleNewsSearch('olimpiadas mundial panamericano liga nacional atleta brasileiro when:48h'),
    googleNewsSearch('volei feminino basquete brasileiro tenis brasileiro formula 1 ufc when:48h'),
  ],
  Ciencia: [
    'https://news.google.com/rss/headlines/section/topic/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('ciencia pesquisa espaco clima descoberta estudo cientifico when:24h'),
    googleNewsSearch('nasa astronomia biologia ambiente inovacao universidade when:24h'),
    googleNewsSearch('pesquisadores artigo cientifico experimento planeta oceano clima when:24h'),
    googleNewsSearch('fossil satelite energia limpa laboratorio descoberta genetica when:24h'),
    googleNewsSearch('pesquisa brasileira descoberta cientifica saude clima universidade when:48h'),
    googleNewsSearch('estudo cientifico tecnologia espacial biologia meio ambiente when:48h'),
  ],
  Saude: [
    'https://news.google.com/rss/headlines/section/topic/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0JXVnVMVWRDS0FBUAE?hl=pt-BR&gl=BR&ceid=BR:pt-419',
    googleNewsSearch('saude medicina vacina hospital bem estar doenca when:24h'),
    googleNewsSearch('ans sus medicamento pesquisa clinica saude mental when:24h'),
    googleNewsSearch('anvisa plano de saude epidemia tratamento cancer dengue when:24h'),
    googleNewsSearch('medico paciente estudo clinico remedio prevencao nutricao when:24h'),
    googleNewsSearch('dengue covid anvisa remedio hospital medico paciente when:48h'),
    googleNewsSearch('saude mental alimentacao exercicio tratamento pesquisa clinica when:48h'),
  ],
  Famosos: [
    googleNewsSearch('celebridades famosos influenciadores bastidores viral when:24h'),
    googleNewsSearch('atriz cantor apresentador influencer relacionamento when:24h'),
    googleNewsSearch('famoso famosa namoro separacao casamento filho redes sociais when:24h'),
    googleNewsSearch('instagram celebridade artista polemica entrevista bastidor when:24h'),
    googleNewsSearch('celebridade separacao gravidez casamento ator atriz influenciador when:48h'),
  ],
  Futebol: [
    googleNewsSearch('futebol brasileiro brasileirao libertadores copa do brasil when:24h'),
    googleNewsSearch('flamengo corinthians palmeiras sao paulo vasco botafogo fluminense when:24h'),
    googleNewsSearch('mercado da bola tecnico SAF clube jogador when:24h'),
    googleNewsSearch('serie a serie b escalacao lesao treinador atacante goleiro when:24h'),
    googleNewsSearch('selecao brasileira CBF Neymar Vini Ancelotti copa when:24h'),
  ],
  Games: [
    googleNewsSearch('games playstation xbox nintendo steam game pass when:24h'),
    googleNewsSearch('ps5 xbox switch 2 gta fortnite lancamento bug review when:24h'),
    googleNewsSearch('steam epic games game pass nintendo direct playstation plus when:24h'),
    googleNewsSearch('esports gamer trailer gameplay patch update estudio when:24h'),
    googleNewsSearch('jogo gratuito gameplay review vazamento playstation store xbox store when:48h'),
  ],
  Lifestyle: [
    googleNewsSearch('estilo de vida comportamento viagem gastronomia produtividade when:24h'),
    googleNewsSearch('casa consumo tendencia comportamento familia rotina when:24h'),
    googleNewsSearch('turismo restaurante receita decoracao bem estar pets when:24h'),
    googleNewsSearch('relacionamento trabalho remoto rotina consumo viagem barato when:24h'),
  ],
  Educacao: [
    googleNewsSearch('educacao enem vestibular carreira escola universidade when:24h'),
    googleNewsSearch('mec professor aluno ensino superior concurso when:24h'),
    googleNewsSearch('inep sisu prouni fies escola publica faculdade when:24h'),
    googleNewsSearch('curso tecnico bolsa estudo aprendizagem salario carreira when:24h'),
    googleNewsSearch('enem sisu prouni fies professor escola universidade when:48h'),
    googleNewsSearch('educacao basica ensino medio estudante faculdade carreira when:48h'),
  ],
  Cultura: [
    googleNewsSearch('cultura arte literatura teatro museu livro when:24h'),
    googleNewsSearch('exposicao festival premio autor artista cultura brasileira when:24h'),
    googleNewsSearch('bienal show cultural patrimonio danca teatro cinema nacional when:24h'),
    googleNewsSearch('escritor artista obra exposicao festival publico agenda cultural when:24h'),
  ],
  Moda: [
    googleNewsSearch('moda fashion tendencias passarela marca colecao when:24h'),
    googleNewsSearch('look estilista grife beleza consumo moda sustentavel when:24h'),
    googleNewsSearch('semana de moda roupa varejo beleza cosmetico tendencia when:24h'),
    googleNewsSearch('influencer moda marca desfile sapato bolsa estilo when:24h'),
    googleNewsSearch('beleza cabelo skincare varejo moda brasil tendencia consumo when:48h'),
  ],
  Musica: [
    googleNewsSearch('musica shows album festival clipe banda when:24h'),
    googleNewsSearch('turne single spotify funk sertanejo rap pop rock when:24h'),
    googleNewsSearch('musica brasileira show palco gravadora lancamento musical when:24h'),
    googleNewsSearch('cantor cantora banda festival lollapalooza rock in rio when:24h'),
    googleNewsSearch('streaming musical billboard parada clipe composicao turne when:24h'),
  ],
  Cinema: [
    googleNewsSearch('cinema filmes streaming bilheteria festival Cannes Oscar when:24h'),
    googleNewsSearch('Netflix Max Prime Video Disney filme serie estreia when:24h'),
    googleNewsSearch('filme diretor atriz ator trailer critica festival cinema when:24h'),
    googleNewsSearch('bilheteria estreia longa metragem documentario streaming salas when:24h'),
  ],
  Ocorrencias: [
    googleNewsSearch('acidente feridos mortos incendio explosao resgate when:24h'),
    googleNewsSearch('desabamento queda temporal enchente interdição bombeiros when:24h'),
    googleNewsSearch('tiroteio operação policial prisão investigação crime when:24h'),
    googleNewsSearch('defesa civil samu vítimas emergência rodovia bloqueio when:24h'),
  ],
};

const normalizeCategoryKey = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const categoryByKey = new Map(Object.keys(FEEDS).map((category) => [normalizeCategoryKey(category), category]));

const getArgValue = (name) => {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.split('=').slice(1).join('=');
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : '';
};

const resolveActiveCategories = () => {
  const raw = getArgValue('category') || getArgValue('categories') || process.env.INGEST_CATEGORY || process.env.INGEST_CATEGORIES || '';
  const requested = String(raw || '').trim();
  if (!requested || /^all|todas|todos$/i.test(requested)) return Object.keys(FEEDS);

  const categories = requested
    .split(',')
    .map((item) => categoryByKey.get(normalizeCategoryKey(item)))
    .filter(Boolean);

  if (!categories.length) {
    throw new Error(`Categoria invalida para ingest: ${requested}. Opcoes: ${Object.keys(FEEDS).join(', ')}`);
  }

  return [...new Set(categories)];
};

const ACTIVE_CATEGORIES = resolveActiveCategories();
const IS_CATEGORY_MODE = ACTIVE_CATEGORIES.length < Object.keys(FEEDS).length;

const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN || 'https://portalnovoalvo.com.br';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const INGEST_DISCOVERY = String(process.env.INGEST_DISCOVERY || 'rss').toLowerCase();
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY || '';
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX || '';
const GOOGLE_SEARCH_PAGES_PER_QUERY = Number(process.env.GOOGLE_SEARCH_PAGES_PER_QUERY || 1);
const GOOGLE_SEARCH_QUERIES_PER_CATEGORY = Number(process.env.GOOGLE_SEARCH_QUERIES_PER_CATEGORY || 4);
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || '';
const GNEWS_QUERIES_PER_CATEGORY = Number(process.env.GNEWS_QUERIES_PER_CATEGORY || 3);
const GNEWS_MAX_RESULTS = Number(process.env.GNEWS_MAX_RESULTS || 10);
const GNEWS_REQUEST_DELAY_MS = Number(process.env.GNEWS_REQUEST_DELAY_MS || 1800);
const GNEWS_RETRY_DELAY_MS = Number(process.env.GNEWS_RETRY_DELAY_MS || 12000);
const MAX_ITEMS_PER_FEED = Number(process.env.MAX_ITEMS_PER_FEED || 80);
const MIN_SOURCES = Number(process.env.MIN_SOURCES || 8);
const RADAR_BATCHES_PER_CATEGORY = Number(process.env.RADAR_BATCHES_PER_CATEGORY || 3);
const MAX_ITEM_AGE_HOURS = Number(process.env.MAX_ITEM_AGE_HOURS || 30);
const HOUSEKEEPING_DAYS = Number(process.env.HOUSEKEEPING_DAYS || 30);
const SOURCE_EXPANSION_TARGET = Number(process.env.SOURCE_EXPANSION_TARGET || 12);
const SOURCE_EXPANSION_MIN_OVERLAP = Number(process.env.SOURCE_EXPANSION_MIN_OVERLAP || 0.34);
const MAX_PITCHES = Number(process.env.MAX_PITCHES || 80);
const CATEGORY_MAX_PITCHES = Number(process.env.CATEGORY_MAX_PITCHES || 8);
const CUSTOM_SOURCE_LIMIT = Number(process.env.CUSTOM_SOURCE_LIMIT || 5000);
const ABSOLUTE_MIN_SOURCES = Number(process.env.ABSOLUTE_MIN_SOURCES || 8);
const CATEGORY_MIN_SOURCES = Number(process.env.CATEGORY_MIN_SOURCES || 8);
const ACTIVE_MIN_SOURCES = Math.max(ABSOLUTE_MIN_SOURCES, IS_CATEGORY_MODE ? Math.min(MIN_SOURCES, CATEGORY_MIN_SOURCES) : MIN_SOURCES);
const CATEGORY_FLOOR_MIN_SOURCES = Number(process.env.CATEGORY_FLOOR_MIN_SOURCES || 8);
const CATEGORY_MAX_ITEM_AGE_HOURS = Number(process.env.CATEGORY_MAX_ITEM_AGE_HOURS || 72);
const ACTIVE_ITEM_AGE_HOURS = IS_CATEGORY_MODE ? Math.max(MAX_ITEM_AGE_HOURS, CATEGORY_MAX_ITEM_AGE_HOURS) : MAX_ITEM_AGE_HOURS;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
const ACTIVE_FLOOR_MIN_SOURCES = IS_CATEGORY_MODE ? Math.max(ABSOLUTE_MIN_SOURCES, Math.min(ACTIVE_MIN_SOURCES, CATEGORY_FLOOR_MIN_SOURCES)) : ACTIVE_MIN_SOURCES;
const ENABLE_COVERAGE_FLOOR = String(process.env.ENABLE_COVERAGE_FLOOR || (IS_CATEGORY_MODE ? '1' : '0')) === '1';
const STRICT_TOPIC_CLUSTERING = String(process.env.STRICT_TOPIC_CLUSTERING || '1') !== '0';
const GOOGLE_SEARCH_FATAL_PATTERNS =
  /does not have the access to custom search json api|accessnotconfigured|api has not been used|disabled|permission denied/i;
let googleSearchUnavailable = false;

const decodeEntities = (value) =>
  String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(Number.parseInt(code, 16)))
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

const cleanPitchTitle = (title) =>
  cleanTitle(title)
    .replace(/^radar\s+[a-z\u00c0-\u017f]+:\s*/i, '')
    .replace(/^\s*[»>-]\s*/, '')
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
  const blocked = new Set([
    'para',
    'com',
    'uma',
    'das',
    'dos',
    'que',
    'por',
    'sobre',
    'apos',
    'entre',
    'como',
    'mais',
    'radar',
    'veja',
    'confira',
    'onde',
    'hoje',
    'resumo',
    'noticias',
    'noticia',
    'cadastro',
    'bonus',
    'bonos',
    'oferta',
    'ofertas',
    'plataforma',
    'plataformas',
    'codigo',
    'indicacao',
    'cupom',
    'promocao',
    'apostar',
    'apostas',
    'palpite',
    'palpites',
    'odds',
    'superbet',
    'betano',
    'bet365',
    'blaze',
    'pixbet',
    'casino',
    'online',
    'assistir',
    'vivo',
    'programacao',
    'agenda',
    'tabela',
    'horario',
    'horarios',
    'gratuito',
    'gratis',
  ]);
  const words = `${category} ${title}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 && !blocked.has(word));
  return [...new Set(words)].slice(0, 10);
};

const subjectSignature = (items, category) => {
  const blocked = new Set([normalizeCategoryKey(category), 'radar', 'veja', 'confira', 'onde', 'hoje', 'sobre']);
  const counts = new Map();
  for (const item of items) {
    for (const keyword of extractKeywords(item.title, item.category).slice(0, 10)) {
      if (blocked.has(keyword)) continue;
      counts.set(keyword, (counts.get(keyword) || 0) + 1);
    }
  }
  const tokens = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 7)
    .map(([token]) => token);
  return slugify(tokens.join('-')) || slugify(selectLeadItem(items)?.title || category);
};

const normalizedText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const EDITORIAL_NOISE_PATTERN =
  /\b(cadastro|b[oô]nus|ofertas?|cupom|c[oó]digo de indica[cç][aã]o|palpites?|odds|superbet|betano|bet365|blaze|pixbet|casino|apostas?|jogos?\s+de\s+hoje|onde assistir|assistir ao vivo|programa[cç][aã]o|agenda|hor[aá]rios?|tabela|resultado ao vivo)\b/i;

const HIGH_SIGNAL_BLOCKED_TOKENS = new Set([
  'brasil',
  'mundo',
  'politica',
  'economia',
  'tecnologia',
  'entretenimento',
  'esportes',
  'futebol',
  'cinema',
  'musica',
  'moda',
  'ciencia',
  'saude',
  'educacao',
  'lifestyle',
  'games',
  'ocorrencias',
  'ultimas',
  'noticias',
  'noticia',
  'radar',
  'impacto',
  'confira',
  'veja',
  'sobre',
  'hoje',
  'amanha',
  'ontem',
  'aovivo',
  'vivo',
]);

const WEAK_TOPIC_TOKENS = new Set([
  ...HIGH_SIGNAL_BLOCKED_TOKENS,
  'fonte',
  'fontes',
  'publica',
  'publicado',
  'publicada',
  'divulga',
  'divulgado',
  'divulgada',
  'anuncia',
  'anunciado',
  'anunciada',
  'novo',
  'nova',
  'novos',
  'novas',
  'melhor',
  'melhores',
  'primeiro',
  'primeira',
  'semana',
  'diario',
  'diaria',
  'portal',
  'site',
  'blog',
  'coluna',
  'video',
  'videos',
  'cadastro',
  'bonus',
  'oferta',
  'ofertas',
  'cupom',
  'codigo',
  'indicacao',
  'evento',
  'eventos',
  'edital',
  'editais',
  'inscricao',
  'inscricoes',
  'servico',
  'servicos',
  'programa',
  'programas',
  'agenda',
  'cnpq',
  'apostas',
  'palpite',
  'palpites',
  'odds',
]);

const EVENT_ACTION_TOKENS = new Set([
  'aprova',
  'aprovou',
  'vota',
  'votou',
  'fecha',
  'fechou',
  'acordo',
  'cancela',
  'cancelou',
  'suspende',
  'suspendeu',
  'aumenta',
  'aumentou',
  'reduz',
  'reduziu',
  'corta',
  'cortou',
  'demite',
  'demitiu',
  'contrata',
  'contratou',
  'renova',
  'renovou',
  'vence',
  'venceu',
  'perde',
  'perdeu',
  'elimina',
  'eliminou',
  'avanca',
  'avancou',
  'recua',
  'recuou',
  'investiga',
  'prende',
  'prendeu',
  'morre',
  'morreu',
  'mata',
  'matou',
  'fere',
  'feriu',
  'explode',
  'explodiu',
  'cai',
  'caiu',
  'sobe',
  'subiu',
  'lanca',
  'lancou',
  'estreia',
  'estreou',
  'revela',
  'revelou',
  'admite',
  'admitiu',
  'nega',
  'negou',
  'critica',
  'criticou',
  'defende',
  'defendeu',
  'assina',
  'assinou',
]);

const ENTITY_STOPWORDS = new Set([
  'google news',
  'news',
  'brasil',
  'mundo',
  'portal novo alvo',
  'novo alvo',
  'radar',
  'resumo',
  'agenda',
  'cadastro',
  'cnpq',
  'evento',
  'programa',
]);

const tokenList = (value) =>
  normalizedText(value)
    .replace(/\bao vivo\b/g, 'aovivo')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3 && !HIGH_SIGNAL_BLOCKED_TOKENS.has(token));

const strongTokenList = (value) => tokenList(value).filter((token) => !WEAK_TOPIC_TOKENS.has(token));

const extractEntities = (value) => {
  const text = decodeEntities(value);
  const matches = [
    ...text.matchAll(/\b[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ][A-Za-zÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇáàâãéèêíïóôõöúç]{2,}(?:\s+(?:d[aeo]s?|e|do|da|dos|das|de|[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ][A-Za-zÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇáàâãéèêíïóôõöúç]{2,})){0,4}/g),
    ...text.matchAll(/\b[A-Z]{2,8}\b/g),
  ]
    .map((match) => match[0])
    .map((entity) => normalizedText(entity).replace(/[^a-z0-9]+/g, ' ').trim())
    .filter((entity) => entity.length >= 3 && !ENTITY_STOPWORDS.has(entity) && !HIGH_SIGNAL_BLOCKED_TOKENS.has(entity.replace(/\s+/g, '')));

  return [...new Set(matches)].slice(0, 8);
};

const isGenericEditorialItem = (item) => {
  const title = String(item?.title || '');
  const normalized = normalizedText(title);
  if (!title || title.length < 8) return true;
  if (EDITORIAL_NOISE_PATTERN.test(title)) return true;
  if (/^(\W|[0-9])+$/.test(title)) return true;
  if (/^(resumo|agenda|programacao|cadastro|cupom|palpite|onde assistir)\b/i.test(title)) return true;
  const usefulTokens = strongTokenList(title).filter((token) => !extractKeywords('', item?.category || '').includes(token));
  if (usefulTokens.length < 2 && extractEntities(title).length === 0) return true;
  if (normalized.length <= 12 && extractEntities(title).length <= 1) return true;
  return false;
};

const sharedCount = (left, right) => {
  let total = 0;
  for (const item of left) {
    if (right.has(item)) total += 1;
  }
  return total;
};

const itemTopicProfile = (item) => {
  const title = cleanPitchTitle(item?.title || '');
  const text = `${title} ${item?.source || ''}`;
  const entities = extractEntities(title);
  const tokens = strongTokenList(title).slice(0, 14);
  const actions = tokens.filter((token) => EVENT_ACTION_TOKENS.has(token));
  return {
    entities,
    tokens,
    actions,
    entitySet: new Set(entities),
    tokenSet: new Set(tokens),
    actionSet: new Set(actions),
    noisy: isGenericEditorialItem(item),
    title,
    text,
  };
};

const hasConcreteTopicSignal = (profile) =>
  profile.entities.length >= 2 ||
  (profile.entities.length >= 1 && profile.tokens.length >= 2) ||
  (profile.actions.length >= 1 && profile.tokens.length >= 3);

const itemTopicAffinity = (left, right) => {
  if (!left || !right || left.category !== right.category) return 0;
  const a = itemTopicProfile(left);
  const b = itemTopicProfile(right);
  if (a.noisy || b.noisy) return 0;

  const sharedEntities = sharedCount(a.entities, b.entitySet);
  const sharedTokens = sharedCount(a.tokens, b.tokenSet);
  const sharedActions = sharedCount(a.actions, b.actionSet);
  const overlap = overlapScore(left, right);
  const strongNamedMatch = sharedEntities > 0;
  const strongActionMatch = sharedActions > 0 && sharedTokens >= 1;
  const strongTokenMatch = sharedTokens >= 3 || (sharedTokens >= 2 && overlap >= 0.38);

  if (!strongNamedMatch && !strongActionMatch && !strongTokenMatch) return 0;
  return sharedEntities * 0.42 + sharedActions * 0.2 + sharedTokens * 0.12 + overlap;
};

const coherentClusterItems = (items, minSources = ACTIVE_MIN_SOURCES) => {
  const distinct = distinctBySource(items).filter((item) => !isGenericEditorialItem(item));
  if (distinct.length < minSources) return [];

  const lead = selectLeadItem(distinct);
  const leadProfile = itemTopicProfile(lead);
  if (!hasConcreteTopicSignal(leadProfile)) return [];
  const selected = distinct
    .map((item) => ({
      item,
      affinity: item === lead ? 999 : itemTopicAffinity(lead, item),
    }))
    .filter(({ item, affinity }) => item === lead || affinity >= (STRICT_TOPIC_CLUSTERING ? 0.42 : 0.3))
    .sort((a, b) => b.affinity - a.affinity)
    .map(({ item }) => item);

  if (selected.length < minSources) return [];

  const entityCounts = new Map();
  const tokenCounts = new Map();
  const actionCounts = new Map();
  for (const item of selected) {
    const profile = itemTopicProfile(item);
    for (const entity of profile.entities) entityCounts.set(entity, (entityCounts.get(entity) || 0) + 1);
    for (const token of profile.tokens) tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    for (const action of profile.actions) actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
  }

  const hasSharedEntity = [...entityCounts.values()].some((count) => count >= Math.max(2, Math.ceil(selected.length * 0.25)));
  const hasSharedAction = [...actionCounts.values()].some((count) => count >= Math.max(2, Math.ceil(selected.length * 0.25)));
  const hasSharedTokenCore = [...tokenCounts.values()].filter((count) => count >= Math.max(2, Math.ceil(selected.length * 0.3))).length >= 2;
  if (!hasSharedEntity && !hasSharedAction && !hasSharedTokenCore) return [];

  const dominantThreshold = Math.max(3, Math.ceil(selected.length * 0.45));
  const dominantEntities = [...entityCounts.values()].filter((count) => count >= dominantThreshold).length;
  const dominantTokens = [...tokenCounts.values()].filter((count) => count >= dominantThreshold).length;
  const dominantActions = [...actionCounts.values()].filter((count) => count >= dominantThreshold).length;
  const hasDominantTopic =
    dominantEntities >= 1 ||
    dominantTokens >= 2 ||
    (dominantActions >= 1 && dominantTokens >= 1);

  if (!hasDominantTopic) return [];

  return selected;
};

const FOOTBALL_CONTEXT_PATTERN =
  /\b(futebol|brasileirao|serie\s?[abcd]|copa do brasil|copa do mundo|libertadores|sul-americana|selecao|neymar|ancelotti|corinthians|flamengo|fluminense|palmeiras|sao paulo|santos|vasco|botafogo|gremio|internacional|cruzeiro|atletico|bahia|fortaleza|guarani|mirassol|santa cruz|diniz|luxemburgo|tecnico|treinador|vitoria|derrota|clube|time|estadio|rodada|classificacao|oitavas|quartas|semifinal|final)\b/i;

const POLITICS_CONTEXT_PATTERN =
  /\b(politica|governo|congresso|senado|camara|stf|planalto|eleicao|eleicoes|prefeito|governador|presidente|ministro|deputado|senador|lula|bolsonaro|flavio bolsonaro|eduardo bolsonaro|pl|pt|mdb|psd|psol|republicanos|tse|pf|policia federal)\b/i;

const REALITY_ENTERTAINMENT_PATTERN =
  /\b(reality|reality show|casa do patrao|bbb|big brother|a fazenda|votacao|eliminacao|eliminado|eliminada|participante|confinamento|paredao|prova do lider|audiencia|programa de tv|televisao|novela)\b/i;

const MUSIC_CONTEXT_PATTERN =
  /\b(musica|show|shows|album|single|turne|festival|palco|clipe|faixa|gravadora|banda|spotify|funk|sertanejo|rap|pop|rock|lancamento musical)\b/i;

const TECH_CONTEXT_PATTERN =
  /\b(tecnologia|inteligencia artificial|ia generativa|openai|nvidia|chip|chips|semicondutor|data center|ciberseguranca|vazamento de dados|privacidade|android|iphone|apple|microsoft|meta|startup|software|hardware|app|aplicativo|robo|robotica)\b/i;

const ECONOMY_CONTEXT_PATTERN =
  /\b(economia|mercado|empresa|empresas|banco|bancos|credito|juros|inflacao|selic|ipca|dolar|bolsa|varejo|industria|arrecadacao|imposto|investimento|consumo|poder de compra|emprego|salario|renda|trabalho|vagas)\b/i;

const FAMOUS_CONTEXT_PATTERN =
  /\b(famosos|celebridade|celebridades|influencer|influenciador|influenciadora|atriz|ator|apresentador|apresentadora|namoro|separacao|casamento|gravidez|filho|filha|redes sociais|instagram|bastidor|polemica)\b/i;

const FASHION_CONTEXT_PATTERN =
  /\b(moda|fashion|look|looks|tendencia|tendencias|passarela|estilista|vestido|grife|colecao|skincare|beleza|cosmetico|varejo de moda|desfile|bolsa|sapato)\b/i;

const HEALTH_CONTEXT_PATTERN =
  /\b(saude|medicina|vacina|hospital|doenca|medico|medica|sus|ans|medicamento|clinica|mental|bem estar|bem-estar|anvisa|dengue|covid|tratamento|cancer|paciente|nutricao)\b/i;

const SCIENCE_CONTEXT_PATTERN =
  /\b(ciencia|pesquisa|estudo|cientifico|cientifica|nasa|espaco|clima|biologia|astronomia|universidade|descoberta|pesquisadores|experimento|fossil|satelite|genetica)\b/i;

const EDUCATION_CONTEXT_PATTERN =
  /\b(educacao|enem|vestibular|mec|inep|sisu|prouni|fies|professor|aluno|estudante|escola|universidade|faculdade|ensino|curso tecnico|aprendizagem)\b/i;

const ENTERTAINMENT_CONTEXT_PATTERN =
  /\b(entretenimento|tv|televisao|streaming|reality|reality show|casa do patrao|bbb|big brother|a fazenda|audiencia|programa|novela|viral|tiktok|participante|eliminado|eliminada|confinamento|paredao)\b/i;

const OCCURRENCE_CONTEXT_PATTERN =
  /\b(acidente|acidentes|ferido|feridos|morto|mortos|morte|incendio|incendios|explosao|desabamento|queda|resgate|soterramento|tiroteio|operacao policial|prisao|preso|presa|crime|criminoso|criminosa|suspeito|suspeita|investigacao|delegacia|policia|policial|pm|roubo|furto|assalto|sequestro|homicidio|assassinato|feminicidio|agressao|violencia domestica|esfaqueado|esfaqueada|esfaquear|facada|baleado|baleada|enchente|alagamento|temporal|interdicao|bombeiros|defesa civil|samu|vitima|vitimas|rodovia bloqueada)\b/i;

const CATEGORY_SIGNALS = [
  {
    category: 'Ocorrencias',
    pattern:
      OCCURRENCE_CONTEXT_PATTERN,
  },
  {
    category: 'Futebol',
    pattern: FOOTBALL_CONTEXT_PATTERN,
  },
  {
    category: 'Politica',
    pattern: POLITICS_CONTEXT_PATTERN,
  },
  {
    category: 'Economia',
    pattern:
      /\b(economia|mercado|emprego|vagas|salario|renda|trabalho|trabalhador|trabalhadora|carreira|empresa|empresas|negocios|credito|juros|inflacao|bolsa|maternidade|licenca maternidade|teto materno|infojobs)\b/i,
  },
  {
    category: 'Saude',
    pattern: /\b(saude|medicina|vacina|hospital|doenca|medico|medica|sus|ans|medicamento|clinica|mental|bem estar|bem-estar)\b/i,
  },
  {
    category: 'Ciencia',
    pattern: /\b(ciencia|pesquisa|estudo|cientifico|cientifica|nasa|espaco|clima|biologia|astronomia|universidade|descoberta)\b/i,
  },
  {
    category: 'Games',
    pattern: /\b(games?|playstation|xbox|nintendo|steam|game pass|gta|fortnite|minecraft|console|ps5)\b/i,
  },
  {
    category: 'Entretenimento',
    pattern:
      /\b(entretenimento|tv|televisao|streaming|reality|reality show|casa do patrao|bbb|big brother|a fazenda|audiencia|programa|novela|viral|tiktok|participante|eliminado|eliminada|confinamento)\b/i,
  },
  {
    category: 'Musica',
    pattern: /\b(musica|show|shows|album|single|turne|festival|palco|clipe|faixa|gravadora|banda|spotify|funk|sertanejo|rap|pop|rock|lancamento musical)\b/i,
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
  {
    category: 'Famosos',
    pattern: /\b(famosos|celebridade|celebridades|influencer|influenciador|atriz|ator|cantor|cantora|apresentador|apresentadora|viral)\b/i,
  },
  {
    category: 'Lifestyle',
    pattern: /\b(lifestyle|estilo de vida|comportamento|viagem|gastronomia|produtividade|rotina|familia|casa)\b/i,
  },
];

const classifyCategory = (feedCategory, title, source, excerpt = '') => {
  const text = normalizedText(`${title} ${excerpt} ${source}`);
  if (OCCURRENCE_CONTEXT_PATTERN.test(text)) return 'Ocorrencias';
  if (FOOTBALL_CONTEXT_PATTERN.test(text)) return 'Futebol';
  if (POLITICS_CONTEXT_PATTERN.test(text)) return 'Politica';
  if (feedCategory === 'Esportes') {
    if (!FOOTBALL_CONTEXT_PATTERN.test(text)) return 'Esportes';
  }
  if (REALITY_ENTERTAINMENT_PATTERN.test(text) && !MUSIC_CONTEXT_PATTERN.test(text)) return 'Entretenimento';
  if (ENTERTAINMENT_CONTEXT_PATTERN.test(text) && !MUSIC_CONTEXT_PATTERN.test(text)) return 'Entretenimento';
  if (TECH_CONTEXT_PATTERN.test(text)) return 'Tecnologia';
  if (HEALTH_CONTEXT_PATTERN.test(text) && !SCIENCE_CONTEXT_PATTERN.test(text)) return 'Saude';
  if (SCIENCE_CONTEXT_PATTERN.test(text) && !POLITICS_CONTEXT_PATTERN.test(text)) return 'Ciencia';
  if (EDUCATION_CONTEXT_PATTERN.test(text) && !ECONOMY_CONTEXT_PATTERN.test(text)) return 'Educacao';
  if (MUSIC_CONTEXT_PATTERN.test(text) && !REALITY_ENTERTAINMENT_PATTERN.test(text)) return 'Musica';
  if (FASHION_CONTEXT_PATTERN.test(text) && !FOOTBALL_CONTEXT_PATTERN.test(text) && !REALITY_ENTERTAINMENT_PATTERN.test(text)) return 'Moda';
  if (FAMOUS_CONTEXT_PATTERN.test(text) && !ECONOMY_CONTEXT_PATTERN.test(text) && !MUSIC_CONTEXT_PATTERN.test(text)) return 'Famosos';
  if (ECONOMY_CONTEXT_PATTERN.test(text) && !FOOTBALL_CONTEXT_PATTERN.test(text) && !FAMOUS_CONTEXT_PATTERN.test(text) && !REALITY_ENTERTAINMENT_PATTERN.test(text)) return 'Economia';
  const matches = CATEGORY_SIGNALS.filter((item) => item.pattern.test(text));
  const priorityMatch = ['Ocorrencias', 'Futebol', 'Politica', 'Games', 'Cinema', 'Entretenimento', 'Cultura', 'Saude', 'Ciencia', 'Musica'].map((category) => matches.find((item) => item.category === category)).find(Boolean);
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

const isFreshItem = (item) => itemAgeHours(item) <= ACTIVE_ITEM_AGE_HOURS;

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
  const sorted = [...items]
    .filter((item) => !isGenericEditorialItem(item))
    .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));

  for (const item of sorted) {
    const match = clusters.find((cluster) => {
      if (cluster[0]?.category !== item.category) return false;
      return cluster.some((candidate) => itemTopicAffinity(candidate, item) >= (STRICT_TOPIC_CLUSTERING ? 0.58 : 0.3));
    });

    if (match) {
      match.push(item);
    } else {
      clusters.push([item]);
    }
  }

  return clusters
    .map((cluster) => coherentClusterItems(cluster, Math.min(ACTIVE_MIN_SOURCES, cluster.length)))
    .filter((cluster) => cluster.length > 0);
};

const buildCategoryRadarClusters = async (items, minSources = MIN_SOURCES) => {
  const byCategory = new Map();
  for (const item of items) {
    const bucket = byCategory.get(item.category) || [];
    bucket.push(item);
    byCategory.set(item.category, bucket);
  }

  const clusters = [];
  for (const [, categoryItems] of byCategory.entries()) {
    const seeds = distinctBySource(categoryItems)
      .filter((item) => !isGenericEditorialItem(item))
      .sort((a, b) => itemRelevanceScore(b, categoryItems) - itemRelevanceScore(a, categoryItems))
      .slice(0, RADAR_BATCHES_PER_CATEGORY);
    for (const seed of seeds) {
      const expanded = await expandClusterSources([seed]);
      const batch = expanded
        .filter((item) => item === seed || overlapScore(seed, item) >= SOURCE_EXPANSION_MIN_OVERLAP)
        .slice(0, Math.max(minSources, SOURCE_EXPANSION_TARGET))
        .map((item) => ({
          ...item,
          title: item.title,
          radarCluster: true,
          radarSeed: seed.title,
        }));
      const coherent = STRICT_TOPIC_CLUSTERING ? coherentClusterItems(batch, minSources) : distinctBySource(batch);
      if (coherent.length >= minSources) {
        clusters.push(coherent.map((item) => ({ ...item, radarCluster: true, radarSeed: seed.title })));
      }
    }
  }
  return clusters;
};

const buildCategoryFloorPitches = (
  items,
  existingPitches = [],
  categories = Object.keys(FEEDS),
  minSources = MIN_SOURCES,
  perCategoryLimit = 1,
  respectCovered = true,
) => {
  if (!ENABLE_COVERAGE_FLOOR) return [];
  const covered = new Set(existingPitches.map((pitch) => pitch.category));
  const byCategory = new Map();
  for (const item of items) {
    const bucket = byCategory.get(item.category) || [];
    bucket.push(item);
    byCategory.set(item.category, bucket);
  }

  return categories
    .filter((category) => !respectCovered || !covered.has(category))
    .flatMap((category) => {
      const categoryItems = distinctBySource(byCategory.get(category) || [])
        .sort((a, b) => itemRelevanceScore(b, byCategory.get(category) || []) - itemRelevanceScore(a, byCategory.get(category) || []))
        .slice(0, Math.max(perCategoryLimit, Math.min(SOURCE_EXPANSION_TARGET, MAX_ITEMS_PER_FEED)));
      if (categoryItems.length < minSources) return null;
      const batchSize = Math.max(1, minSources);
      const batches = [];
      for (let index = 0; index < categoryItems.length && batches.length < perCategoryLimit; index += batchSize) {
        const slice = categoryItems.slice(index, index + batchSize * 3);
        const batch = coherentClusterItems(slice, minSources);
        if (batch.length < minSources) continue;
        const pitch = buildPitch(batch.map((item) => ({ ...item, radarCluster: true, coverageFloor: true, lowCoverage: minSources < ACTIVE_MIN_SOURCES })));
        batches.push({
          ...pitch,
          clusterKey: `${slugify(category)}:coverage:${slugify(batch[0].title)}`,
          sourceCount: batch.length,
          score: Math.min(minSources < 3 ? 690 : 780, 520 + batch.length * 35 + pitch.tags.length * 6),
          summary:
            minSources < 3
              ? `Sinal inicial da editoria ${category}. A pauta ainda tem cobertura pequena, mas pode render nota curta se houver fato concreto, agente identificado e consequencia util.`
              : `Cobertura minima da editoria ${category}. A abordagem editorial deve escolher o fato mais forte, evitar repeticao e transformar a pauta em materia util.`,
        });
      }
      return batches;
    })
    .filter(Boolean);
};

const parseRssItems = (xml, category, sourceMeta = {}) => {
  const items = [...String(xml).matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].slice(0, MAX_ITEMS_PER_FEED);
  return items.map((match) => {
    const itemXml = match[0];
    const rawTitle = textBetween(itemXml, 'title');
    const title = cleanTitle(rawTitle);
    const summary = cleanTitle(
      textBetween(itemXml, 'description') ||
        textBetween(itemXml, 'summary') ||
        textBetween(itemXml, 'content:encoded') ||
        textBetween(itemXml, 'content'),
    );
    const source = textBetween(itemXml, 'source') || sourceMeta.name || rawTitle.split(' - ').pop() || 'Google News';
    const finalCategory = classifyCategory(category, title, source, summary);
    const googleLink = textBetween(itemXml, 'link') || attrBetween(itemXml, 'link', 'href');
    const sourceUrl = attrBetween(itemXml, 'source', 'url') || sourceMeta.siteUrl || '';
    const link = googleLink || sourceUrl;
    const publishedAt = textBetween(itemXml, 'pubDate') || textBetween(itemXml, 'published') || textBetween(itemXml, 'updated');

    return {
      title,
      category: finalCategory,
      feedCategory: category,
      link,
      googleLink,
      sourceUrl,
      source,
      summary,
      publishedAt,
    };
  }).filter((item) => item.title && item.link);
};

const fetchFeed = async ([category, url, _index = 0, sourceMeta = {}]) => {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/rss+xml, application/xml, text/xml',
        'user-agent': 'PortalNovoAlvoEditorialIngest/1.0',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseRssItems(await response.text(), category, sourceMeta);
  } catch (error) {
    console.warn(`[feed] ${category} ${sourceMeta?.name ? `(${sourceMeta.name})` : ''}: ${error.message}`);
    return [];
  }
};

const fallbackFeedEntries = (categories = Object.keys(FEEDS)) =>
  Object.entries(FEEDS)
    .filter(([category]) => categories.includes(category))
    .flatMap(([category, urls]) =>
      (Array.isArray(urls) ? urls : [urls]).map((url, index) => [category, url, index]),
    );

let editorialSourceEntriesCache = null;

const fetchEditorialSourceEntries = async (categories = Object.keys(FEEDS)) => {
  if (editorialSourceEntriesCache) return editorialSourceEntriesCache;
  if (!ADMIN_TOKEN || !PORTAL_ORIGIN) {
    editorialSourceEntriesCache = [];
    return editorialSourceEntriesCache;
  }

  try {
    const url = new URL('/api/admin/sources', PORTAL_ORIGIN);
    url.searchParams.set('active', '1');
    url.searchParams.set('categories', categories.join(','));
    url.searchParams.set('limit', String(CUSTOM_SOURCE_LIMIT));

    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${ADMIN_TOKEN}`,
      },
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

    editorialSourceEntriesCache = (Array.isArray(data.sources) ? data.sources : [])
      .filter((source) => source?.feedUrl && source?.category)
      .map((source, index) => [
        source.category,
        source.feedUrl,
        index,
        {
          name: source.name,
          siteUrl: source.siteUrl,
          trustLevel: source.trustLevel,
          weight: source.weight,
        },
      ]);

    if (editorialSourceEntriesCache.length) {
      console.log(`[sources] usando ${editorialSourceEntriesCache.length} fontes RSS do banco editorial.`);
    }
    return editorialSourceEntriesCache;
  } catch (error) {
    console.warn(`[sources] usando fallback interno: ${error.message}`);
    editorialSourceEntriesCache = [];
    return editorialSourceEntriesCache;
  }
};

const feedEntries = async (categories = Object.keys(FEEDS)) => {
  const customEntries = await fetchEditorialSourceEntries(categories);
  if (customEntries.length) return customEntries.filter(([category]) => categories.includes(category));
  return fallbackFeedEntries(categories);
};

const stripSearchOperators = (query) =>
  String(query || '')
    .replace(/\bwhen:\d+h\b/gi, '')
    .replace(/\bOR\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const queryFromGoogleNewsUrl = (url) => {
  try {
    const parsed = new URL(url);
    return stripSearchOperators(parsed.searchParams.get('q') || '');
  } catch {
    return '';
  }
};

const categorySearchQueries = (category) => {
  const urls = Array.isArray(FEEDS[category]) ? FEEDS[category] : [FEEDS[category]];
  const queries = urls
    .map(queryFromGoogleNewsUrl)
    .filter(Boolean)
    .map((query) => `${query} noticia reportagem analise`);

  return [...new Set([`${category} noticias Brasil hoje`, ...queries])].slice(0, GOOGLE_SEARCH_QUERIES_PER_CATEGORY);
};

const categorySearchEntries = (categories = Object.keys(FEEDS)) =>
  categories.flatMap((category) => categorySearchQueries(category).map((query, index) => [category, query, index]));

const categoryGNewsQueries = (category) => categorySearchQueries(category).slice(0, GNEWS_QUERIES_PER_CATEGORY);

const categoryGNewsEntries = (categories = Object.keys(FEEDS)) =>
  categories.flatMap((category) => categoryGNewsQueries(category).map((query, index) => [category, query, index]));

const publishedFromSearchItem = (item) => {
  const meta = item?.pagemap?.metatags?.[0] || {};
  return (
    meta['article:published_time'] ||
    meta['article:modified_time'] ||
    meta['og:updated_time'] ||
    meta['date'] ||
    meta['pubdate'] ||
    new Date().toISOString()
  );
};

const normalizeSearchPublisher = (item) => {
  const meta = item?.pagemap?.metatags?.[0] || {};
  return (
    meta['og:site_name'] ||
    meta['application-name'] ||
    meta['twitter:site'] ||
    item?.displayLink ||
    'Google Search'
  );
};

const fetchGoogleSearchQuery = async ([category, query, queryIndex]) => {
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
    throw new Error('GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX sao obrigatorios para INGEST_DISCOVERY=google_search.');
  }

  const pages = [];
  for (let page = 0; page < GOOGLE_SEARCH_PAGES_PER_QUERY; page += 1) {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', GOOGLE_SEARCH_API_KEY);
    url.searchParams.set('cx', GOOGLE_SEARCH_CX);
    url.searchParams.set('q', query);
    url.searchParams.set('num', '10');
    url.searchParams.set('start', String(page * 10 + 1));
    url.searchParams.set('dateRestrict', `d${Math.max(1, Math.ceil(ACTIVE_ITEM_AGE_HOURS / 24))}`);
    url.searchParams.set('lr', 'lang_pt');
    url.searchParams.set('gl', 'br');
    url.searchParams.set('safe', 'active');

    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'PortalNovoAlvoEditorialIngest/1.0',
        },
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);
      pages.push(...(Array.isArray(data.items) ? data.items : []));
    } catch (error) {
      if (GOOGLE_SEARCH_FATAL_PATTERNS.test(error.message)) googleSearchUnavailable = true;
      console.warn(`[google-search] ${category} #${queryIndex + 1}: ${error.message}`);
    }
  }

  return pages
    .map((item) => {
      const title = cleanTitle(item?.title || '');
      const snippet = decodeEntities(item?.snippet || '');
      const source = normalizeSearchPublisher(item);
      const finalCategory = classifyCategory(category, `${title} ${snippet}`, source);
      return {
        title,
        category: finalCategory,
        feedCategory: category,
        link: item?.link || '',
        googleLink: '',
        sourceUrl: item?.link || '',
        source,
        snippet,
        publishedAt: publishedFromSearchItem(item),
      };
    })
    .filter((item) => item.title && item.link && !/google\.com\/search|webcache|policies\.google/i.test(item.link))
    .slice(0, MAX_ITEMS_PER_FEED);
};

const fetchGNewsQuery = async ([category, query, queryIndex]) => {
  if (!GNEWS_API_KEY) {
    console.warn('[gnews] GNEWS_API_KEY ausente. Acionando fallback RSS.');
    return [];
  }

  const url = new URL('https://gnews.io/api/v4/search');
  url.searchParams.set('apikey', GNEWS_API_KEY);
  url.searchParams.set('q', query);
  url.searchParams.set('lang', 'pt');
  url.searchParams.set('country', 'br');
  url.searchParams.set('max', String(Math.max(1, Math.min(10, GNEWS_MAX_RESULTS))));
  url.searchParams.set('in', 'title,description,content');
  url.searchParams.set('sortby', 'publishedAt');
  url.searchParams.set('from', new Date(Date.now() - ACTIVE_ITEM_AGE_HOURS * 60 * 60 * 1000).toISOString());

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'PortalNovoAlvoEditorialIngest/1.0',
        },
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.errors?.join('; ') || data?.message || `HTTP ${response.status}`);

      return (Array.isArray(data.articles) ? data.articles : [])
        .map((article) => {
          const title = cleanTitle(article?.title || '');
          const snippet = decodeEntities(article?.description || article?.content || '');
          const source = article?.source?.name || 'GNews';
          const finalCategory = classifyCategory(category, `${title} ${snippet}`, source);
          return {
            title,
            category: finalCategory,
            feedCategory: category,
            link: article?.url || '',
            googleLink: '',
            sourceUrl: article?.source?.url || article?.url || '',
            source,
            snippet,
            summary: snippet,
            imageUrl: article?.image || '',
            publishedAt: article?.publishedAt || new Date().toISOString(),
            discoveryProvider: 'gnews',
          };
        })
        .filter((item) => item.title && item.link)
        .slice(0, MAX_ITEMS_PER_FEED);
    } catch (error) {
      const message = error?.message || String(error);
      const shouldRetry = attempt === 0 && /too many requests|short period|rate|quota|429/i.test(message);
      if (shouldRetry) {
        console.warn(`[gnews] ${category} #${queryIndex + 1}: limite temporario; aguardando ${GNEWS_RETRY_DELAY_MS}ms.`);
        await wait(GNEWS_RETRY_DELAY_MS);
        continue;
      }
      console.warn(`[gnews] ${category} #${queryIndex + 1}: ${message}`);
      return [];
    }
  }

  return [];
};

const fetchGNewsEntriesSequentially = async (entries) => {
  const items = [];
  for (const [index, entry] of entries.entries()) {
    if (index > 0) await wait(GNEWS_REQUEST_DELAY_MS);
    items.push(...(await fetchGNewsQuery(entry)));
  }
  return items;
};

const fetchDiscoveryItems = async () => {
  if (INGEST_DISCOVERY === 'gnews') {
    const gnewsItems = await fetchGNewsEntriesSequentially(categoryGNewsEntries(ACTIVE_CATEGORIES));
    if (gnewsItems.length >= ACTIVE_CATEGORIES.length * 4) return gnewsItems;

    console.warn(`[discovery] GNews retornou ${gnewsItems.length} itens. Acionando fallback RSS para preservar a pauta.`);
    const rssItems = (await Promise.all((await feedEntries(ACTIVE_CATEGORIES)).map(fetchFeed))).flat();
    return [...gnewsItems, ...rssItems];
  }

  if (INGEST_DISCOVERY === 'google_search') {
    const searchItems = (await Promise.all(categorySearchEntries(ACTIVE_CATEGORIES).map(fetchGoogleSearchQuery))).flat();
    if (searchItems.length >= ACTIVE_CATEGORIES.length * 4) return searchItems;

    if (googleSearchUnavailable) {
      console.warn(
        '[discovery] Google Custom Search sem acesso neste projeto. Habilite a Custom Search JSON API para a chave atual ou use INGEST_DISCOVERY=rss.',
      );
    }
    console.warn(
      `[discovery] Google Search retornou ${searchItems.length} itens. Acionando fallback RSS para preservar a pauta.`,
    );
    const rssItems = (await Promise.all((await feedEntries(ACTIVE_CATEGORIES)).map(fetchFeed))).flat();
    return [...searchItems, ...rssItems];
  }

  return (await Promise.all((await feedEntries(ACTIVE_CATEGORIES)).map(fetchFeed))).flat();
};

const buildPitch = (items) => {
  const first = selectLeadItem(items);
  const pitchTitle = cleanPitchTitle(first.title);
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
      summary: item.summary,
      url: item.link,
      sourceUrl: item.sourceUrl,
      publishedAt: item.publishedAt,
      provider: item.discoveryProvider || 'rss',
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
  const signature = subjectSignature(orderedItems, first.category);

  return {
    clusterKey: `${slugify(first.category)}:${isRadar ? 'radar:' : ''}${signature}`,
    title: pitchTitle,
    summary: `O fato central envolve ${pitchTitle}. A abordagem editorial deve identificar o agente ativo, a causa imediata e a consequencia concreta para o leitor.`,
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
  const repeatedSubject = selected.some((item) => item.category === pitch.category && semanticPitchOverlap(item, pitch) >= 0.72);
  if (repeatedSubject) return false;
  selected.push(pitch);
  seen.add(pitch.clusterKey);
  return true;
};

const semanticPitchOverlap = (left, right) => {
  const leftTokens = new Set(extractKeywords(left?.title || '', left?.category || '').slice(0, 8));
  const rightTokens = new Set(extractKeywords(right?.title || '', right?.category || '').slice(0, 8));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  return shared / Math.min(leftTokens.size, rightTokens.size);
};

const balancePitches = (topicPitches, radarPitches, coveragePitches, limit, categories = Object.keys(FEEDS)) => {
  const selected = [];
  const seen = new Set();
  const radarByCategory = new Map();
  const coverageByCategory = new Map();

  for (const pitch of radarPitches) {
    if (!radarByCategory.has(pitch.category)) radarByCategory.set(pitch.category, []);
    radarByCategory.get(pitch.category).push(pitch);
  }
  for (const pitch of coveragePitches) {
    if (!coverageByCategory.has(pitch.category)) coverageByCategory.set(pitch.category, []);
    coverageByCategory.get(pitch.category).push(pitch);
  }

  for (const category of categories) {
    addUniquePitch(selected, seen, radarByCategory.get(category)?.[0] || coverageByCategory.get(category)?.[0]);
    if (selected.length >= limit) return selected;
  }

  for (let round = 1; round < RADAR_BATCHES_PER_CATEGORY; round += 1) {
    for (const category of categories) {
      addUniquePitch(selected, seen, radarByCategory.get(category)?.[round] || coverageByCategory.get(category)?.[round]);
      if (selected.length >= limit) return selected;
    }
  }

  for (const pitch of [...topicPitches, ...radarPitches, ...coveragePitches]) {
    addUniquePitch(selected, seen, pitch);
    if (selected.length >= limit) return selected;
  }

  return selected;
};

const main = async () => {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN ausente.');
  const startedAt = new Date().toISOString();
  const pitchLimit = IS_CATEGORY_MODE ? Math.min(CATEGORY_MAX_PITCHES, MAX_PITCHES) : MAX_PITCHES;

  console.log(
    `Modo ingest: ${IS_CATEGORY_MODE ? ACTIVE_CATEGORIES.join(', ') : 'todas as categorias'}. Descoberta: ${INGEST_DISCOVERY}. Limite de pautas: ${pitchLimit}. Fontes minimas: ${ACTIVE_MIN_SOURCES}. Piso: ${ACTIVE_FLOOR_MIN_SOURCES}.`,
  );
  const rawItems = await fetchDiscoveryItems();
  const freshItems = rawItems.filter(isFreshItem);
  const allItems = IS_CATEGORY_MODE ? freshItems.filter((item) => ACTIVE_CATEGORIES.includes(item.category)) : freshItems;
  const feedCounts = allItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  console.log(`Itens brutos: ${rawItems.length}. Itens frescos (${ACTIVE_ITEM_AGE_HOURS}h): ${allItems.length}.`);
  const topicClusters = (await Promise.all(clusterItems(allItems).map(expandClusterSources)))
    .map((cluster) => (STRICT_TOPIC_CLUSTERING ? coherentClusterItems(cluster, ACTIVE_MIN_SOURCES) : cluster))
    .filter((cluster) => cluster.length >= ACTIVE_MIN_SOURCES);
  const topicPitches = topicClusters
    .map(buildPitch)
    .filter((pitch) => pitch.sourceCount >= ACTIVE_MIN_SOURCES)
    .sort((a, b) => b.score - a.score);
  const radarPitches = (await buildCategoryRadarClusters(allItems, ACTIVE_MIN_SOURCES))
    .map(buildPitch)
    .filter((pitch) => pitch.sourceCount >= ACTIVE_MIN_SOURCES && !topicPitches.some((existing) => existing.clusterKey === pitch.clusterKey))
    .sort((a, b) => b.score - a.score);
  const coveragePitches = buildCategoryFloorPitches(
    allItems,
    IS_CATEGORY_MODE ? [] : [...topicPitches, ...radarPitches],
    ACTIVE_CATEGORIES,
    ACTIVE_FLOOR_MIN_SOURCES,
    IS_CATEGORY_MODE ? pitchLimit : 1,
    !IS_CATEGORY_MODE,
  );
  const pitches = balancePitches(topicPitches, radarPitches, coveragePitches, pitchLimit, ACTIVE_CATEGORIES)
    .filter((pitch) => pitch.sourceCount >= ABSOLUTE_MIN_SOURCES);

  let saved = 0;
  let updatedHidden = 0;
  const enrichedPitches = await Promise.all(pitches.map(normalizePitchAssets));

  await Promise.all(
    enrichedPitches.map(async (pitch) => {
      try {
        const data = await postPitch(pitch);
        if (data?.skipped) return;
        if (data?.pitch?.visibleAsNew) {
          saved += 1;
        } else {
          updatedHidden += 1;
        }
      } catch (error) {
        console.warn(`[pitch] ${pitch.title}: ${error.message}`);
      }
    }),
  );

  await runHousekeeping();
  const skipped = Math.max(0, pitches.length - saved - updatedHidden);
  await postIngestRun({
    id: `ingest:${startedAt}`,
    status: skipped > 0 ? 'partial' : 'success',
    itemsTotal: allItems.length,
    topicClusters: topicPitches.length,
    radarClusters: radarPitches.length + coveragePitches.length,
    selectedPitches: pitches.length,
    savedPitches: saved,
    skippedPitches: skipped + updatedHidden,
    feedCounts,
    startedAt,
    finishedAt: new Date().toISOString(),
    notes: `${saved}/${pitches.length} pautas novas visiveis. ${updatedHidden} atualizacao(oes) fora da aba Novas.`,
  });
  console.log(
    `Ingestao concluida: ${saved}/${pitches.length} pautas novas visiveis. ${updatedHidden} atualizacao(oes) fora da aba Novas. Itens: ${allItems.length}. Clusters por assunto: ${topicPitches.length}. Radares por categoria: ${radarPitches.length}. Cobertura minima: ${coveragePitches.length}.`,
  );
  console.log(`Itens por categoria: ${JSON.stringify(feedCounts)}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

