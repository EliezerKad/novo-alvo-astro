import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const repoRoot = resolve(projectRoot, '..');
const fromProjectRoot = (...parts) => resolve(projectRoot, ...parts);
const fromRepoRoot = (...parts) => resolve(repoRoot, ...parts);

const loadLocalEnv = (filePath) => {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].replace(/^['"]|['"]$/g, '');
    process.env[match[1]] = value;
  }
};

loadLocalEnv(fromProjectRoot('.env.automation.local'));
loadLocalEnv(fromProjectRoot('.env.local'));

const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN || 'https://portalnovoalvo.com.br';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const D1_DATABASE = process.env.AUTOMATION_D1_DATABASE || 'novo-alvo-editorial';
const MIN_SOURCES = Number(process.env.AUTOMATION_MIN_SOURCES || 8);
const MIN_SCORE = Number(process.env.AUTOMATION_MIN_SCORE || 900);
const MIN_DISCOVER_SCORE = Number(process.env.AUTOMATION_MIN_DISCOVER_SCORE || 260);
const MAX_QUEUE_PER_RUN = Number(process.env.AUTOMATION_MAX_QUEUE_PER_RUN || 1);
const MAX_OPEN_QUEUE = Number(process.env.AUTOMATION_MAX_OPEN_QUEUE || 2);
const RECENT_CATEGORY_HOURS = Number(process.env.AUTOMATION_RECENT_CATEGORY_HOURS || 8);
const FETCH_TIMEOUT_MS = Number(process.env.AUTOMATION_FETCH_TIMEOUT_MS || 20000);
const D1_TIMEOUT_MS = Number(process.env.AUTOMATION_D1_TIMEOUT_MS || 180000);
const bundledNpm = fromRepoRoot('.tools', 'node-v24.15.0-win-x64', process.platform === 'win32' ? 'npm.cmd' : 'bin/npm');
const npmCommand = process.env.NPM_CMD || (existsSync(bundledNpm) ? bundledNpm : process.platform === 'win32' ? 'npm.cmd' : 'npm');
const localWranglerCandidates = [
  fromProjectRoot('node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'),
  fromRepoRoot('node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'),
];

const findCachedWrangler = () => {
  const cacheRoots = [
    fromRepoRoot('.npm-cache'),
    fromProjectRoot('.npm-cache'),
    process.env.npm_config_cache,
  ].filter(Boolean);
  for (const cacheRoot of [...new Set(cacheRoots)]) {
    const npxCacheDir = resolve(cacheRoot, '_npx');
    if (!existsSync(npxCacheDir)) continue;
    for (const entry of readdirSync(npxCacheDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = resolve(
        npxCacheDir,
        entry.name,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler',
      );
      if (existsSync(candidate)) return candidate;
    }
  }
  return '';
};

const wranglerCommand = process.env.WRANGLER_CMD || localWranglerCandidates.find((candidate) => existsSync(candidate)) || findCachedWrangler();
const wranglerLogPath = fromProjectRoot('.wrangler', 'logs');

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`timeout apos ${FETCH_TIMEOUT_MS}ms`)), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const isNetworkError = (error) =>
  error?.name === 'AbortError' ||
  String(error?.message || '').includes('timeout apos') ||
  String(error?.message || '').includes('fetch failed') ||
  String(error?.cause?.code || '').includes('EACCES');

const requestJson = async (path, options = {}) => {
  const response = await fetchWithTimeout(new URL(path, PORTAL_ORIGIN), {
    ...options,
    headers: {
      authorization: `Bearer ${ADMIN_TOKEN}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `${path} respondeu ${response.status}`);
  return data;
};

const publicJson = async (path) => {
  const response = await fetchWithTimeout(new URL(path, PORTAL_ORIGIN));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `${path} respondeu ${response.status}`);
  return data;
};

const parseDate = (value) => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : 0;
};

const sqlString = (value) => `'${String(value || '').replace(/'/g, "''")}'`;

const CATEGORY_DAILY_TARGETS = {
  Brasil: 4,
  Famosos: 4,
  Ocorrencias: 4,
  Musica: 3,
  Economia: 2,
  Tecnologia: 1,
  Mundo: 1,
  Futebol: 1,
};

const CATEGORY_WEIGHTS = {
  Economia: 1.12,
  Famosos: 1.15,
  Musica: 1.15,
  Ocorrencias: 1.15,
  Brasil: 1.1,
  Tecnologia: 1.08,
};

const FOOTBALL_HIGH_SIGNAL_PATTERN = /\b(flamengo|corinthians|palmeiras|neymar|endrick|estevao|estêvão|selecao brasileira|seleção brasileira|cbf|ancelotti|copa do mundo|libertadores|copa do brasil)\b/i;
const CINEMA_HIGH_SIGNAL_PATTERN = /\b(marvel|dc|netflix|hbo|max|disney|bilheteria|oscar|cannes|festival de cannes|prime video)\b/i;
const EMOTION_PATTERN = /\b(superacao|superação|tragedia|tragédia|morre|morreu|morte|morto|morta|conquista|conflito|escandalo|escândalo|polemica|polêmica|acusacao|acusação|investigacao|investigação|drama|surpreende|emociona|viral)\b/i;
const CURIOSITY_PATTERN = /\b(inesperado|bastidor|bastidores|descoberta|segredo|curioso|curiosidade|mudanca|mudança|surpreendente|revela|revelou|entenda|por que|motivo|mistério|misterio)\b/i;
const CELEBRITY_PATTERN = /\b(celebridade|famoso|famosa|influenciador|influenciadora|artista|ator|atriz|cantor|cantora|apresentador|apresentadora|atleta|neymar|joao fonseca|joão fonseca|lula|bolsonaro|trump|drake|shakira|anitta)\b/i;
const HUMAN_IMPACT_PATTERN = /\b(saude|saúde|seguranca|segurança|educacao|educação|emprego|renda|salario|salário|juros|inflacao|inflação|familia|família|trabalho|consumidor|morador|jovem|crianca|criança|idoso|vitima|vítima)\b/i;
const NOVELTY_PATTERN = /\b(agora|hoje|novo|nova|inedito|inédito|lanca|lança|lancamento|lançamento|estreia|decisao|decisão|aprova|proibe|proíbe|anuncia|mudou|muda|ultima hora|última hora)\b/i;
const SEARCH_VOLUME_PATTERN = /\b(google|openai|meta|apple|microsoft|netflix|hbo|disney|marvel|dc|flamengo|corinthians|palmeiras|neymar|drake|shakira|anitta|lula|bolsonaro|trump|inss|enem|selic|dolar|dólar|pix)\b/i;

const normalized = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const scoreSignal = (pattern, text, base = 35, perMatch = 18) => {
  const matches = text.match(pattern);
  if (!matches) return 0;
  return Math.min(100, base + matches.length * perMatch);
};

const discoverScoreForPitch = (pitch) => {
  const stored = Number(pitch.discover_score || pitch.discoverScore || 0);
  if (stored > 0) return Math.min(600, stored);
  const text = normalized(`${pitch.category || ''} ${pitch.title || ''} ${pitch.summary || ''} ${pitch.keywords || ''} ${pitch.tags || ''}`);
  return Math.max(
    0,
    Math.min(
      600,
      scoreSignal(EMOTION_PATTERN, text, 42, 20) +
        scoreSignal(CURIOSITY_PATTERN, text, 35, 18) +
        scoreSignal(CELEBRITY_PATTERN, text, pitch.category === 'Famosos' || pitch.category === 'Musica' ? 55 : 40, 20) +
        scoreSignal(HUMAN_IMPACT_PATTERN, text, ['Brasil', 'Ocorrencias', 'Economia', 'Saude', 'Educacao'].includes(pitch.category) ? 52 : 36, 18) +
        scoreSignal(NOVELTY_PATTERN, text, 42, 16) +
        scoreSignal(SEARCH_VOLUME_PATTERN, text, 45, 18),
    ),
  );
};

const editorialWeightForPitch = (pitch) => {
  const text = `${pitch.title || ''} ${pitch.summary || ''} ${pitch.keywords || ''} ${pitch.tags || ''}`;
  if (pitch.category === 'Futebol' && !FOOTBALL_HIGH_SIGNAL_PATTERN.test(text)) return 0.92;
  if (pitch.category === 'Cinema' && !CINEMA_HIGH_SIGNAL_PATTERN.test(text)) return 0.9;
  return CATEGORY_WEIGHTS[pitch.category] || 1;
};

const STOP_WORDS = new Set([
  'a',
  'ao',
  'aos',
  'abordagem',
  'agente',
  'agora',
  'ainda',
  'ativo',
  'as',
  'ate',
  'causa',
  'com',
  'como',
  'concreta',
  'consequencia',
  'contra',
  'da',
  'das',
  'de',
  'deve',
  'do',
  'dos',
  'e',
  'em',
  'entre',
  'envolve',
  'estrategico',
  'fato',
  'ganha',
  'google',
  'ia',
  'identificar',
  'imediata',
  'leitor',
  'mais',
  'mistura',
  'muda',
  'na',
  'nas',
  'no',
  'nova',
  'novas',
  'novo',
  'novos',
  'no',
  'nos',
  'o',
  'ou',
  'os',
  'para',
  'por',
  'que',
  'se',
  'sem',
  'sob',
  'sobre',
  'sua',
  'suas',
  'seu',
  'seus',
  'site',
  'titulo',
  'titulo',
  'ultima',
  'ultimo',
  'um',
  'uma',
  'veja',
]);

const stripEditorialBoilerplate = (value) =>
  String(value || '')
    .replace(/o fato central envolve\s+/gi, ' ')
    .replace(/a abordagem editorial deve identificar o agente ativo, a causa imediata e a consequencia concreta para o leitor\.?/gi, ' ')
    .replace(/o que muda para o consumidor\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenText = (value) =>
  stripEditorialBoilerplate(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bdjoko\b/g, 'djokovic')
    .replace(/\basteroides\b/g, 'asteroide')
    .replace(/\baproximacoes?\b/g, 'aproximacao')
    .replace(/\bpassagens?\b/g, 'passagem')
    .replace(/\bconselho nacional de justica\b/g, 'cnj')
    .replace(/\binteligencia artificial\b/g, 'ia')
    .replace(/\bvirada cultural\b/g, 'viradacultural')
    .replace(/[^a-z0-9]+/g, ' ');

const subjectTokens = (value) =>
  new Set(
    tokenText(value)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  );

const overlapScore = (left, right) => {
  if (!left.size || !right.size) return { overlap: 0, ratio: 0 };
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return { overlap, ratio: overlap / Math.min(left.size, right.size) };
};

const d1 = (command) => {
  mkdirSync(wranglerLogPath, { recursive: true });
  const tmpDir = fromProjectRoot('.wrangler', 'tmp');
  mkdirSync(tmpDir, { recursive: true });
  const env = {
    ...process.env,
    npm_config_cache: fromRepoRoot('.npm-cache'),
    WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || wranglerLogPath,
    WRANGLER_SEND_METRICS: process.env.WRANGLER_SEND_METRICS || 'false',
  };
  const childEnv = wranglerCommand
    ? {
        ...process.env,
        WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || wranglerLogPath,
        WRANGLER_SEND_METRICS: process.env.WRANGLER_SEND_METRICS || 'false',
      }
    : env;
  const normalizedCommand = command.replace(/\s+/g, ' ').trim();
  const executeD1 = () => {
    const executable = wranglerCommand || npmCommand;
    const args = wranglerCommand
      ? ['d1', 'execute', D1_DATABASE, '--remote', '--json', '--command', normalizedCommand]
      : ['exec', 'wrangler', '--', 'd1', 'execute', D1_DATABASE, '--remote', '--json', '--command', normalizedCommand];
    return process.platform === 'win32'
      ? (() => {
          const escapedExecutable = executable.replace(/'/g, "''");
          const escapedArgs = args.map((value) => `'${String(value).replace(/'/g, "''")}'`).join(', ');
          const commandText = `& '${escapedExecutable}' @(${escapedArgs})`;
          return execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', commandText], {
            encoding: 'utf8',
            env: childEnv,
            timeout: D1_TIMEOUT_MS,
          });
        })()
      : execFileSync(executable, args, {
          encoding: 'utf8',
          env: childEnv,
          timeout: D1_TIMEOUT_MS,
        });
  };

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const output = executeD1();
      const jsonStartCandidates = [output.indexOf('['), output.indexOf('{')].filter((index) => index >= 0);
      const jsonStart = jsonStartCandidates.length ? Math.min(...jsonStartCandidates) : -1;
      const jsonLead = jsonStart >= 0 ? output.slice(jsonStart) : output;
      const jsonEnd =
        jsonLead.trimStart().startsWith('[') ? jsonLead.lastIndexOf(']') + 1 : jsonLead.lastIndexOf('}') + 1;
      const jsonText = jsonEnd > 0 ? jsonLead.slice(0, jsonEnd) : jsonLead;
      const parsed = JSON.parse(jsonText);
      const chunks = Array.isArray(parsed) ? parsed : [parsed];
      const apiError = chunks.find((chunk) => chunk?.error);
      if (apiError) throw new Error(apiError.error?.text || 'wrangler d1 retornou erro');
      return chunks.flatMap((chunk) => chunk?.results || []);
    } catch (error) {
      lastError = error;
      if (attempt >= 2) break;
    }
  }
  throw lastError;
};

const sourcePublishers = (pitch) => {
  try {
    const sources = JSON.parse(pitch.sources || '[]');
    return new Set(
      sources
        .map((source) => String(source?.publisher || source?.source || source?.site || '').trim().toLowerCase())
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
};

const buildCategoryRecency = async () => {
  const data = await publicJson('/api/public/articles?limit=30').catch(() => ({ articles: [] }));
  const recency = new Map();
  for (const article of data.articles || []) {
    const category = String(article.category || '').trim();
    if (!category) continue;
    const time = parseDate(article.published_at || article.updated_at || article.created_at);
    recency.set(category, Math.max(recency.get(category) || 0, time));
  }
  return recency;
};

const buildRecentCategoryCounts = async () => {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const counts = new Map();
  const seen = new Set();
  const add = (article) => {
    const category = String(article.category || '').trim();
    if (!category) return;
    const key = String(article.slug || article.id || `${article.title || ''}:${article.published_at || article.publishedAt || ''}`);
    if (key && seen.has(key)) return;
    const time = parseDate(article.published_at || article.publishedAt || article.scheduled_at || article.updated_at || article.created_at);
    if (time >= since) counts.set(category, (counts.get(category) || 0) + 1);
    if (key) seen.add(key);
  };

  const publicData = await publicJson('/api/public/articles?limit=120').catch(() => ({ articles: [] }));
  for (const article of publicData.articles || []) add(article);

  for (const article of d1(
    `SELECT category, published_at, scheduled_at, updated_at
     FROM articles
     WHERE status IN ('published', 'scheduled')
     ORDER BY COALESCE(NULLIF(published_at, ''), NULLIF(scheduled_at, ''), updated_at) DESC
     LIMIT 160`,
  )) add(article);

  return counts;
};

const listQueued = () =>
  d1(
    `SELECT editorial_queue.id,
            editorial_queue.pitch_id,
            editorial_queue.status,
            editorial_queue.category,
            editorial_queue.publish_after,
            editorial_pitches.title,
            editorial_pitches.score,
            editorial_pitches.source_count
     FROM editorial_queue
     LEFT JOIN editorial_pitches ON editorial_pitches.id = editorial_queue.pitch_id
     WHERE editorial_queue.status = 'queued'
     ORDER BY editorial_queue.publish_after ASC`,
  );

const listNewPitchesFromD1 = () =>
  d1(
    `SELECT id, cluster_key, category, title, summary, keywords, tags, sources, score, COALESCE(discover_score, 0) AS discover_score, source_count, updated_at
     FROM editorial_pitches
     WHERE status = 'new'
       AND source_count >= ${Math.max(1, Math.floor(MIN_SOURCES))}
       AND score >= ${Math.max(0, Math.floor(MIN_SCORE))}
       AND (expires_at IS NULL OR expires_at = '' OR expires_at >= ${sqlString(new Date().toISOString())})
     ORDER BY discover_score DESC, score DESC, source_count DESC, updated_at DESC
     LIMIT 100`,
  );

const pitchTokenText = (pitch) => {
  const tags = (() => {
    try {
      const parsed = JSON.parse(pitch.tags || '[]');
      return Array.isArray(parsed) ? parsed.join(' ') : '';
    } catch {
      return pitch.tags || '';
    }
  })();
  return `${pitch.category || ''} ${pitch.cluster_key || ''} ${pitch.title || ''} ${pitch.keywords || ''} ${tags}`;
};

const articleTokenText = (article) => `${article.category || ''} ${article.title || ''} ${article.summary || ''}`;

const toPublishedSubject = (article) => ({
  ...article,
  tokens: subjectTokens(articleTokenText(article)),
});

const listPublishedSubjects = async () => {
  const bySlug = new Map();
  for (const article of d1(
    `SELECT slug, title, summary, category, status, published_at, scheduled_at, updated_at
     FROM articles
     WHERE status IN ('published', 'scheduled')
     ORDER BY COALESCE(NULLIF(published_at, ''), NULLIF(scheduled_at, ''), updated_at) DESC
     LIMIT 400`,
  )) {
    if (article?.slug) bySlug.set(article.slug, article);
  }

  const publicData = await publicJson('/api/public/articles?limit=400').catch(() => ({ articles: [] }));
  for (const article of publicData.articles || []) {
    if (article?.slug && !bySlug.has(article.slug)) bySlug.set(article.slug, article);
  }

  return [...bySlug.values()].map(toPublishedSubject);
};

const duplicateForPitch = (pitch, publishedSubjects) => {
  const pitchTokens = subjectTokens(pitchTokenText(pitch));
  for (const article of publishedSubjects) {
    const score = overlapScore(pitchTokens, article.tokens);
    if (score.overlap >= 4 && score.ratio >= 0.6) return { article, score };
  }
  return null;
};

const markDuplicatePitch = async (pitch, duplicate, apiAvailable) => {
  const note = `Duplicada de materia ja publicada: ${duplicate.article.slug}`;
  if (apiAvailable) {
    await requestJson('/api/admin/pitches', {
      method: 'PATCH',
      body: JSON.stringify({
        id: pitch.id,
        clusterKey: pitch.cluster_key,
        status: 'dismissed',
      }),
    }).catch((error) => console.warn(`[duplicate] falha ao dispensar ${pitch.id}: ${error.message}`));
  }

  d1(
    `UPDATE editorial_pitches
     SET status = 'dismissed', updated_at = ${sqlString(new Date().toISOString())}
     WHERE id = ${sqlString(pitch.id)};
     UPDATE editorial_memory
     SET status = 'published', article_slug = ${sqlString(duplicate.article.slug)}, last_seen_at = ${sqlString(new Date().toISOString())}
     WHERE last_pitch_id = ${sqlString(pitch.id)} OR subject_key = ${sqlString(pitch.cluster_key || '')}`,
  );
  console.warn(`[duplicate] ${pitch.title} -> ${duplicate.article.slug} (${note})`);
};

const rankPitches = (pitches, recency, recentCounts = new Map()) => {
  const recentCutoff = Date.now() - RECENT_CATEGORY_HOURS * 60 * 60 * 1000;
  return pitches
    .filter((pitch) => Number(pitch.source_count || 0) >= MIN_SOURCES)
    .filter((pitch) => Number(pitch.score || 0) >= MIN_SCORE)
    .filter((pitch) => discoverScoreForPitch(pitch) >= MIN_DISCOVER_SCORE)
    .filter((pitch) => sourcePublishers(pitch).size >= MIN_SOURCES)
    .map((pitch) => {
      const categoryTime = recency.get(pitch.category) || 0;
      const staleBoost = categoryTime && categoryTime > recentCutoff ? 0 : 100000;
      const target = CATEGORY_DAILY_TARGETS[pitch.category] || 1;
      const publishedToday = recentCounts.get(pitch.category) || 0;
      const quotaBoost = Math.max(0, target - publishedToday) * 6500;
      const editorialScore = Number(pitch.score || 0) * editorialWeightForPitch(pitch);
      const discoverScore = discoverScoreForPitch(pitch);
      return {
        pitch,
        rank: staleBoost + quotaBoost + editorialScore * 8 + discoverScore * 16 + Number(pitch.source_count || 0) * 4 - Math.floor(categoryTime / 100000000),
      };
    })
    .sort((a, b) => b.rank - a.rank || Number(b.pitch.score || 0) - Number(a.pitch.score || 0))
    .map((item) => item.pitch);
};

const pulseQueue = async () => {
  if (!ADMIN_TOKEN) return [];
  const data = await requestJson('/api/admin/queue?limit=2', { method: 'POST' });
  return data.published || [];
};

const computeQueueWindow = (pitch) => {
  const gapMinutes = 40 + Math.floor(Math.random() * 51);
  const category = String(pitch.category || '').trim() || 'Brasil';
  const [lastQueued] = d1(
    `SELECT publish_after
     FROM editorial_queue
     WHERE category = ${sqlString(category)}
       AND status = 'queued'
     ORDER BY publish_after DESC
     LIMIT 1`,
  );
  const [lastArticle] = d1(
    `SELECT published_at
     FROM articles
     WHERE category = ${sqlString(category)}
       AND COALESCE(NULLIF(published_at, ''), '') != ''
     ORDER BY published_at DESC
     LIMIT 1`,
  );
  const baseTime = Math.max(
    Date.now(),
    lastQueued?.publish_after ? Date.parse(lastQueued.publish_after) || 0 : 0,
    lastArticle?.published_at ? Date.parse(lastArticle.published_at) || 0 : 0,
  );
  return {
    category,
    gapMinutes,
    publishAfter: new Date(baseTime + gapMinutes * 60 * 1000).toISOString(),
  };
};

const fetchImages = async (pitch) => {
  try {
    const data = await requestJson('/api/admin/pitch-images', {
      method: 'POST',
      body: JSON.stringify({ id: pitch.id, clusterKey: pitch.cluster_key, limit: 8 }),
    });
    return Number(data.saved || 0);
  } catch (error) {
    console.warn(`[images] ${pitch.title}: ${error.message}`);
    return 0;
  }
};

const enqueuePitch = async (pitch, apiAvailable) => {
  const now = new Date().toISOString();
  const { category, gapMinutes, publishAfter } = computeQueueWindow(pitch);
  if (apiAvailable) {
    try {
      const data = await requestJson('/api/admin/pitches', {
        method: 'PATCH',
        body: JSON.stringify({
          id: pitch.id,
          clusterKey: pitch.cluster_key,
          status: 'queued',
          category,
        }),
      });
      return {
        id: String(data.queue?.id || `queue:${pitch.id}`),
        mode: 'queued-api',
        publishAfter: String(data.queue?.publishAfter || ''),
        gapMinutes: Number(data.queue?.gapMinutes || 0),
        draftArticleId: String(data.queue?.draftArticleId || ''),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('rascunho revisado') && !isNetworkError(error)) throw error;
      console.warn(`[queue] ${pitch.title}: ${message}. Aplicando fallback D1 para manter item revisavel na fila.`);
    }
  }

  d1(
    `INSERT INTO editorial_queue (id, pitch_id, category, status, publish_after, draft_article_id, error, updated_at)
     VALUES (${sqlString(`queue:${pitch.id}`)}, ${sqlString(pitch.id)}, ${sqlString(category)}, 'queued', ${sqlString(publishAfter)}, '', '', ${sqlString(now)})
     ON CONFLICT(pitch_id) DO UPDATE SET
       category = excluded.category,
       status = 'queued',
       publish_after = excluded.publish_after,
       error = '',
       updated_at = excluded.updated_at`,
  );
  d1(
    `UPDATE editorial_pitches
     SET status = 'queued', category = ${sqlString(category)}, updated_at = ${sqlString(now)}
     WHERE id = ${sqlString(pitch.id)}`,
  );
  return {
    id: `queue:${pitch.id}`,
    mode: apiAvailable ? 'queued-d1-fallback' : 'queued-d1',
    publishAfter,
    gapMinutes,
    draftArticleId: '',
  };
};

const main = async () => {
  let apiAvailable = Boolean(ADMIN_TOKEN);
  const published = apiAvailable
    ? await pulseQueue().catch((error) => {
        if (!isNetworkError(error)) throw error;
        apiAvailable = false;
        console.warn(`[api] ${error.message}. Continuando em modo D1 fallback sem pulsar/publicar nesta rodada.`);
        return [];
      })
    : [];
  const existingQueued = listQueued();
  if (existingQueued.length >= MAX_OPEN_QUEUE) {
    console.log(JSON.stringify({ ok: true, published, queued: [], existingQueued, skipped: 'queue-cap-reached' }, null, 2));
    return;
  }

  const recency = await buildCategoryRecency();
  const recentCounts = await buildRecentCategoryCounts();
  const pitchData = apiAvailable
    ? await requestJson(`/api/admin/pitches?status=new&minSources=${MIN_SOURCES}&limit=100`).catch((error) => {
        if (!isNetworkError(error)) throw error;
        apiAvailable = false;
        console.warn(`[api] ${error.message}. Buscando pautas diretamente no D1.`);
        return { pitches: listNewPitchesFromD1() };
      })
    : { pitches: listNewPitchesFromD1() };
  const publishedSubjects = await listPublishedSubjects();
  const duplicates = [];
  const uniquePitches = [];
  const categoryBackfill = [];
  const wantedCategories = new Set();
  for (const pitch of pitchData.pitches || []) {
    const duplicate = duplicateForPitch(pitch, publishedSubjects);
    if (duplicate) {
      wantedCategories.add(pitch.category);
      duplicates.push({
        id: pitch.id,
        title: pitch.title,
        duplicateOf: duplicate.article.slug,
        overlap: duplicate.score.overlap,
        ratio: Number(duplicate.score.ratio.toFixed(2)),
      });
      await markDuplicatePitch(pitch, duplicate, apiAvailable);
      continue;
    }
    uniquePitches.push(pitch);
  }
  const rankedUnique = rankPitches(uniquePitches, recency, recentCounts);
  for (const category of wantedCategories) {
    const replacement = rankedUnique.find(
      (pitch) => pitch.category === category && !categoryBackfill.some((item) => item.id === pitch.id),
    );
    if (replacement) categoryBackfill.push(replacement);
  }
  const replacementIds = new Set(categoryBackfill.map((pitch) => pitch.id));
  const candidates = [
    ...categoryBackfill,
    ...rankedUnique.filter((pitch) => !replacementIds.has(pitch.id)),
  ];
  const openSlots = Math.max(0, MAX_OPEN_QUEUE - existingQueued.length);
  const targetQueueCount = Math.max(0, Math.min(MAX_QUEUE_PER_RUN, openSlots));

  const queued = [];
  const errors = [];
  for (const pitch of candidates) {
    if (queued.length >= targetQueueCount) break;
    try {
      const imageCount = apiAvailable ? await fetchImages(pitch) : 0;
      const review = await enqueuePitch(pitch, apiAvailable);
      queued.push({
        id: pitch.id,
        queueId: review?.id || '',
        title: pitch.title,
        category: pitch.category,
        score: pitch.score,
        sourceCount: pitch.source_count,
        imageCount,
        mode: review?.mode || '',
        publishAfter: review?.publishAfter || '',
        gapMinutes: review?.gapMinutes || 0,
      });
    } catch (error) {
      errors.push({
        id: pitch.id,
        title: pitch.title,
        category: pitch.category,
        error: error.message,
      });
      console.warn(`[queue] ${pitch.title}: ${error.message}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: apiAvailable ? 'api' : ADMIN_TOKEN ? 'd1-fallback-api-unavailable' : 'd1-fallback-without-admin-token',
        published,
        queued,
        errors,
        duplicates,
        candidates: candidates.length,
        existingQueued,
        note: 'Novas pautas entram em editorial_queue como revisaveis; somente o pulso da fila tenta publicar itens vencidos.',
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
