import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

loadLocalEnv(resolve('.env.automation.local'));
loadLocalEnv(resolve('.env.local'));

const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN || 'https://portalnovoalvo.com.br';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const D1_DATABASE = process.env.AUTOMATION_D1_DATABASE || 'novo-alvo-editorial';
const MIN_SOURCES = Number(process.env.AUTOMATION_MIN_SOURCES || 8);
const MIN_SCORE = Number(process.env.AUTOMATION_MIN_SCORE || 900);
const MAX_QUEUE_PER_RUN = Number(process.env.AUTOMATION_MAX_QUEUE_PER_RUN || 1);
const MAX_OPEN_QUEUE = Number(process.env.AUTOMATION_MAX_OPEN_QUEUE || 2);
const RECENT_CATEGORY_HOURS = Number(process.env.AUTOMATION_RECENT_CATEGORY_HOURS || 8);
const bundledNpm = resolve('..', '.tools', 'node-v24.15.0-win-x64', process.platform === 'win32' ? 'npm.cmd' : 'bin/npm');
const npmCommand = process.env.NPM_CMD || (existsSync(bundledNpm) ? bundledNpm : process.platform === 'win32' ? 'npm.cmd' : 'npm');

const requestJson = async (path, options = {}) => {
  const response = await fetch(new URL(path, PORTAL_ORIGIN), {
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
  const response = await fetch(new URL(path, PORTAL_ORIGIN));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `${path} respondeu ${response.status}`);
  return data;
};

const parseDate = (value) => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : 0;
};

const sqlString = (value) => `'${String(value || '').replace(/'/g, "''")}'`;

const STOP_WORDS = new Set([
  'a',
  'ao',
  'aos',
  'as',
  'com',
  'como',
  'contra',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'entre',
  'na',
  'nas',
  'no',
  'nos',
  'o',
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
  'um',
  'uma',
]);

const subjectTokens = (value) =>
  new Set(
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\bdjoko\b/g, 'djokovic')
      .replace(/[^a-z0-9]+/g, ' ')
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
  const env = { ...process.env, npm_config_cache: process.env.npm_config_cache || resolve('..', '.npm-cache') };
  const normalizedCommand = command.replace(/\s+/g, ' ').trim();
  const psCommand = `& '${npmCommand.replace(/'/g, "''")}' exec wrangler -- d1 execute ${D1_DATABASE} --remote --json --command @'
${normalizedCommand}
'@`;
  const output =
    process.platform === 'win32'
      ? execFileSync(
          'powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand],
          { encoding: 'utf8', env },
        )
      : execFileSync(
          npmCommand,
          ['exec', 'wrangler', '--', 'd1', 'execute', D1_DATABASE, '--remote', '--json', '--command', normalizedCommand],
          { encoding: 'utf8', env },
        );
  const jsonStart = output.indexOf('[');
  const jsonText = jsonStart >= 0 ? output.slice(jsonStart) : output;
  const chunks = JSON.parse(jsonText);
  return chunks.flatMap((chunk) => chunk?.results || []);
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

const listQueued = () =>
  d1(
    `SELECT q.id, q.status, q.category, q.publish_after, p.title, p.score, p.source_count
     FROM editorial_queue q
     JOIN editorial_pitches p ON p.id = q.pitch_id
     WHERE q.status = 'queued'
     ORDER BY q.publish_after ASC`,
  );

const listNewPitchesFromD1 = () =>
  d1(
    `SELECT id, cluster_key, category, title, summary, keywords, tags, sources, score, source_count, updated_at
     FROM editorial_pitches
     WHERE status = 'new'
       AND source_count >= ${Math.max(1, Math.floor(MIN_SOURCES))}
       AND score >= ${Math.max(0, Math.floor(MIN_SCORE))}
       AND (expires_at IS NULL OR expires_at = '' OR expires_at >= ${sqlString(new Date().toISOString())})
     ORDER BY score DESC, source_count DESC, updated_at DESC
     LIMIT 100`,
  );

const listPublishedSubjects = () =>
  d1(
    `SELECT slug, title, summary, category, published_at, updated_at
     FROM articles
     WHERE status = 'published'
     ORDER BY COALESCE(NULLIF(published_at, ''), updated_at) DESC
     LIMIT 400`,
  ).map((article) => ({
    ...article,
    tokens: subjectTokens(`${article.category || ''} ${article.title || ''} ${article.summary || ''}`),
  }));

const duplicateForPitch = (pitch, publishedSubjects) => {
  const pitchTokens = subjectTokens(
    `${pitch.category || ''} ${pitch.cluster_key || ''} ${pitch.title || ''} ${pitch.summary || ''} ${pitch.keywords || ''} ${pitch.tags || ''}`,
  );
  for (const article of publishedSubjects) {
    const score = overlapScore(pitchTokens, article.tokens);
    if (score.overlap >= 5 && score.ratio >= 0.55) return { article, score };
  }
  return null;
};

const markDuplicatePitch = async (pitch, duplicate) => {
  const note = `Duplicada de materia ja publicada: ${duplicate.article.slug}`;
  if (ADMIN_TOKEN) {
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

const rankPitches = (pitches, recency) => {
  const recentCutoff = Date.now() - RECENT_CATEGORY_HOURS * 60 * 60 * 1000;
  return pitches
    .filter((pitch) => Number(pitch.source_count || 0) >= MIN_SOURCES)
    .filter((pitch) => Number(pitch.score || 0) >= MIN_SCORE)
    .filter((pitch) => sourcePublishers(pitch).size >= MIN_SOURCES)
    .map((pitch) => {
      const categoryTime = recency.get(pitch.category) || 0;
      const staleBoost = categoryTime && categoryTime > recentCutoff ? 0 : 100000;
      return {
        pitch,
        rank: staleBoost + Number(pitch.score || 0) * 10 + Number(pitch.source_count || 0) - Math.floor(categoryTime / 100000000),
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

const enqueuePitch = async (pitch) => {
  if (ADMIN_TOKEN) {
    const data = await requestJson('/api/admin/pitches', {
      method: 'PATCH',
      body: JSON.stringify({
        id: pitch.id,
        clusterKey: pitch.cluster_key,
        status: 'queued',
        category: pitch.category,
      }),
    });
    return data.queue;
  }

  const now = new Date().toISOString();
  const lastQueued = listQueued()
    .filter((item) => item.category === pitch.category)
    .map((item) => parseDate(item.publish_after))
    .sort((a, b) => b - a)[0] || 0;
  const baseTime = Math.max(Date.now(), lastQueued);
  const gapMinutes = 40 + Math.floor(Math.random() * 51);
  const publishAfter = new Date(baseTime + gapMinutes * 60 * 1000).toISOString();
  const queueId = `queue:${pitch.id}`;

  d1(
    `UPDATE editorial_pitches
     SET status = 'queued', updated_at = ${sqlString(now)}
     WHERE id = ${sqlString(pitch.id)};
     INSERT INTO editorial_queue (id, pitch_id, category, status, publish_after, updated_at)
     VALUES (${sqlString(queueId)}, ${sqlString(pitch.id)}, ${sqlString(pitch.category)}, 'queued', ${sqlString(publishAfter)}, ${sqlString(now)})
     ON CONFLICT(pitch_id) DO UPDATE SET
       category = excluded.category,
       status = 'queued',
       publish_after = excluded.publish_after,
       error = '',
       updated_at = excluded.updated_at`,
  );
  return { id: queueId, publishAfter, gapMinutes, mode: 'd1-fallback' };
};

const main = async () => {
  const published = await pulseQueue();
  const existingQueued = listQueued();
  if (existingQueued.length >= MAX_OPEN_QUEUE) {
    console.log(JSON.stringify({ ok: true, published, queued: [], existingQueued, skipped: 'queue-cap-reached' }, null, 2));
    return;
  }

  const recency = await buildCategoryRecency();
  const pitchData = ADMIN_TOKEN
    ? await requestJson(`/api/admin/pitches?status=new&minSources=${MIN_SOURCES}&limit=100`)
    : { pitches: listNewPitchesFromD1() };
  const publishedSubjects = listPublishedSubjects();
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
      await markDuplicatePitch(pitch, duplicate);
      continue;
    }
    uniquePitches.push(pitch);
  }
  const rankedUnique = rankPitches(uniquePitches, recency);
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
  const selected = candidates.slice(0, Math.max(0, Math.min(MAX_QUEUE_PER_RUN, openSlots)));

  const queued = [];
  for (const pitch of selected) {
    const imageCount = ADMIN_TOKEN ? await fetchImages(pitch) : 0;
    const queue = await enqueuePitch(pitch);
    queued.push({
      id: pitch.id,
      title: pitch.title,
      category: pitch.category,
      score: pitch.score,
      sourceCount: pitch.source_count,
      imageCount,
      publishAfter: queue?.publishAfter || '',
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: ADMIN_TOKEN ? 'api' : 'd1-fallback-without-admin-token',
        published,
        queued,
        duplicates,
        candidates: candidates.length,
        existingQueued,
        note: ADMIN_TOKEN ? '' : 'Sem ADMIN_TOKEN: enfileira pelo D1, mas nao pulsa/publica nem busca imagens pela API.',
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
