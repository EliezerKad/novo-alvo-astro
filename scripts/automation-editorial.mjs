const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN || 'https://portalnovoalvo.com.br';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const MIN_SOURCES = Number(process.env.AUTOMATION_MIN_SOURCES || 8);
const MIN_SCORE = Number(process.env.AUTOMATION_MIN_SCORE || 900);
const MAX_QUEUE_PER_RUN = Number(process.env.AUTOMATION_MAX_QUEUE_PER_RUN || 2);
const RECENT_CATEGORY_HOURS = Number(process.env.AUTOMATION_RECENT_CATEGORY_HOURS || 8);

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
  const data = await publicJson('/api/public/articles?limit=30');
  const recency = new Map();
  for (const article of data.articles || []) {
    const category = String(article.category || '').trim();
    if (!category) continue;
    const time = parseDate(article.published_at || article.updated_at || article.created_at);
    recency.set(category, Math.max(recency.get(category) || 0, time));
  }
  return recency;
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
};

const main = async () => {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN ausente.');

  const published = await pulseQueue();
  const recency = await buildCategoryRecency();
  const pitchData = await requestJson(`/api/admin/pitches?status=new&minSources=${MIN_SOURCES}&limit=100`);
  const candidates = rankPitches(pitchData.pitches || [], recency);
  const selected = candidates.slice(0, Math.max(1, Math.min(3, MAX_QUEUE_PER_RUN)));

  const queued = [];
  for (const pitch of selected) {
    const imageCount = await fetchImages(pitch);
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

  console.log(JSON.stringify({ ok: true, published, queued, candidates: candidates.length }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
