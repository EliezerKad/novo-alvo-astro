type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      all: <T = unknown>() => Promise<{ results?: T[] }>;
      run: () => Promise<unknown>;
    };
  };
};

type Env = {
  EDITORIAL_DB?: D1Database;
  ADMIN_TOKEN?: string;
};

type SourcePayload = {
  id?: string;
  name?: string;
  category?: string;
  siteUrl?: string;
  site_url?: string;
  feedUrl?: string;
  feed_url?: string;
  country?: string;
  language?: string;
  trustLevel?: number;
  trust_level?: number;
  weight?: number;
  active?: boolean | number;
  status?: string;
  notes?: string;
  discoveredFrom?: string;
  discovered_from?: string;
};

type SourceRecord = {
  id: string;
  name: string;
  category: string;
  site_url?: string;
  feed_url: string;
  source_type?: string;
  country?: string;
  language?: string;
  trust_level?: number;
  weight?: number;
  active?: number;
  status?: string;
  last_checked_at?: string;
  last_item_count?: number;
  last_error?: string;
  notes?: string;
  discovered_from?: string;
  created_at?: string;
  updated_at?: string;
};

const categories = new Set([
  'Politica',
  'Economia',
  'Brasil',
  'Mundo',
  'Saude',
  'Tecnologia',
  'Esportes',
  'Famosos',
  'Cinema',
  'Entretenimento',
  'Ciencia',
  'Educacao',
  'Cultura',
  'Lifestyle',
  'Games',
  'Moda',
  'Musica',
  'Futebol',
  'Ocorrencias',
]);

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

const normalizeCategoryKey = (value: unknown) =>
  clean(value, 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const categoryByKey = new Map([...categories].map((category) => [normalizeCategoryKey(category), category]));

const normalizeCategory = (value: unknown) => categoryByKey.get(normalizeCategoryKey(value)) || 'Brasil';

const normalizeUrl = (value: unknown) => {
  const raw = clean(value, 1200);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!/^https?:$/i.test(url.protocol)) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
};

const inferSiteUrl = (feedUrl: string, fallback = '') => {
  const explicit = normalizeUrl(fallback);
  if (explicit) return explicit;
  try {
    const url = new URL(feedUrl);
    return `${url.protocol}//${url.hostname}/`;
  } catch {
    return '';
  }
};

const inferName = (feedUrl: string, fallback = '') => {
  const explicit = clean(fallback, 120);
  if (explicit) return explicit;
  try {
    return new URL(feedUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'Fonte editorial';
  }
};

const requireAdmin = (request: Request, env: Env) => {
  if (!env.ADMIN_TOKEN) return json({ error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-admin-token') || '';
  if (token !== env.ADMIN_TOKEN) return json({ error: 'Token editorial invalido.' }, { status: 401 });
  return null;
};

const getDb = (env: Env) => env.EDITORIAL_DB;

const textBetween = (xml: string, tag: string) => {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return decodeEntities(match?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};

const decodeEntities = (value: string) =>
  String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const parseFeedPreview = (xml: string) => {
  const body = String(xml || '');
  const channelTitle = textBetween(body.match(/<channel\b[\s\S]*?<\/channel>/i)?.[0] || body, 'title');
  const itemMatches = [...body.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].slice(0, 5);
  const items = itemMatches.map((match) => {
    const itemXml = match[0];
    return {
      title: textBetween(itemXml, 'title'),
      link: textBetween(itemXml, 'link'),
      publishedAt: textBetween(itemXml, 'pubDate') || textBetween(itemXml, 'published') || textBetween(itemXml, 'updated'),
    };
  }).filter((item) => item.title);

  return {
    title: channelTitle,
    itemCount: [...body.matchAll(/<(item|entry)\b/gi)].length,
    items,
  };
};

const testFeed = async (feedUrl: string) => {
  const startedAt = Date.now();
  const response = await fetch(feedUrl, {
    headers: {
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      'user-agent': 'PortalNovoAlvoSourceTester/1.0',
    },
    signal: AbortSignal.timeout(14000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const preview = parseFeedPreview(text);
  if (!preview.itemCount) throw new Error('RSS sem itens detectaveis.');
  return {
    ok: true,
    status: 'ok',
    ms: Date.now() - startedAt,
    ...preview,
  };
};

const toSourceRow = (source: SourceRecord) => ({
  id: source.id,
  name: source.name,
  category: source.category,
  siteUrl: source.site_url || '',
  feedUrl: source.feed_url,
  sourceType: source.source_type || 'rss',
  country: source.country || 'BR',
  language: source.language || 'pt-BR',
  trustLevel: Number(source.trust_level || 3),
  weight: Number(source.weight || 1),
  active: Number(source.active ?? 1) === 1,
  status: source.status || 'untested',
  lastCheckedAt: source.last_checked_at || '',
  lastItemCount: Number(source.last_item_count || 0),
  lastError: source.last_error || '',
  notes: source.notes || '',
  discoveredFrom: source.discovered_from || '',
  createdAt: source.created_at || '',
  updatedAt: source.updated_at || '',
});

const normalizeSourcePayload = (source: SourcePayload) => {
  const feedUrl = normalizeUrl(source.feedUrl || source.feed_url);
  if (!feedUrl) throw new Error('URL de RSS invalida.');
  const category = normalizeCategory(source.category);
  return {
    id: clean(source.id, 120) || crypto.randomUUID(),
    name: inferName(feedUrl, source.name),
    category,
    siteUrl: inferSiteUrl(feedUrl, source.siteUrl || source.site_url),
    feedUrl,
    country: clean(source.country || 'BR', 20),
    language: clean(source.language || 'pt-BR', 20),
    trustLevel: Math.max(1, Math.min(5, Number(source.trustLevel ?? source.trust_level ?? 3))),
    weight: Math.max(1, Math.min(10, Number(source.weight || 1))),
    active: source.active === false || source.active === 0 ? 0 : 1,
    status: clean(source.status || 'untested', 40),
    notes: clean(source.notes, 1000),
    discoveredFrom: clean(source.discoveredFrom || source.discovered_from, 1200),
  };
};

const tableMissing = (error: unknown) => /no such table: editorial_sources/i.test(String((error as Error)?.message || error));

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  const url = new URL(request.url);
  const active = url.searchParams.get('active');
  const category = clean(url.searchParams.get('category'), 80);
  const categoriesParam = clean(url.searchParams.get('categories'), 400);
  const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get('limit') || 500)));

  const filters: string[] = [];
  const values: unknown[] = [];
  if (active === '1' || active === 'true') filters.push('active = 1');
  if (active === '0' || active === 'false') filters.push('active = 0');
  if (category) {
    filters.push('category = ?');
    values.push(normalizeCategory(category));
  } else if (categoriesParam) {
    const normalized = [...new Set(categoriesParam.split(',').map(normalizeCategory).filter(Boolean))];
    if (normalized.length) {
      filters.push(`category IN (${normalized.map(() => '?').join(', ')})`);
      values.push(...normalized);
    }
  }

  try {
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await db
      .prepare(
        `SELECT * FROM editorial_sources
         ${where}
         ORDER BY active DESC, category ASC, trust_level DESC, weight DESC, name ASC
         LIMIT ?`,
      )
      .bind(...values, limit)
      .all<SourceRecord>();

    return json({ ok: true, sources: (result.results || []).map(toSourceRow) });
  } catch (error) {
    if (tableMissing(error)) {
      return json({ error: 'Tabela editorial_sources nao encontrada. Rode migrations/0006_editorial_sources.sql no D1.' }, { status: 503 });
    }
    return json({ error: (error as Error).message || 'Falha ao listar fontes.' }, { status: 500 });
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const action = clean(body.action || 'save', 40);

  if (action === 'test') {
    const urls = Array.isArray(body.urls) ? body.urls : [body.feedUrl || body.feed_url || body.url];
    const category = normalizeCategory(body.category);
    const results = [];
    for (const rawUrl of urls) {
      const feedUrl = normalizeUrl(rawUrl);
      if (!feedUrl) {
        results.push({ ok: false, feedUrl: clean(rawUrl, 1200), category, error: 'URL invalida.' });
        continue;
      }
      try {
        const preview = await testFeed(feedUrl);
        results.push({
          ...preview,
          feedUrl,
          category,
          name: preview.title || inferName(feedUrl),
          siteUrl: inferSiteUrl(feedUrl),
        });
      } catch (error) {
        results.push({
          ok: false,
          status: 'error',
          feedUrl,
          category,
          name: inferName(feedUrl),
          siteUrl: inferSiteUrl(feedUrl),
          error: (error as Error).message || 'Falha ao testar RSS.',
        });
      }
    }
    return json({ ok: true, results });
  }

  const sources = Array.isArray(body.sources) ? body.sources : [body.source || body];
  const saved = [];

  try {
    for (const rawSource of sources) {
      const source = normalizeSourcePayload(rawSource || {});
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO editorial_sources (
             id, name, category, site_url, feed_url, source_type, country, language,
             trust_level, weight, active, status, notes, discovered_from, updated_at
           )
           VALUES (?, ?, ?, ?, ?, 'rss', ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(feed_url) DO UPDATE SET
             name = excluded.name,
             category = excluded.category,
             site_url = excluded.site_url,
             country = excluded.country,
             language = excluded.language,
             trust_level = excluded.trust_level,
             weight = excluded.weight,
             active = excluded.active,
             status = excluded.status,
             notes = excluded.notes,
             discovered_from = excluded.discovered_from,
             updated_at = excluded.updated_at`,
        )
        .bind(
          source.id,
          source.name,
          source.category,
          source.siteUrl,
          source.feedUrl,
          source.country,
          source.language,
          source.trustLevel,
          source.weight,
          source.active,
          source.status,
          source.notes,
          source.discoveredFrom,
          now,
        )
        .run();
      saved.push(source);
    }
    return json({ ok: true, saved });
  } catch (error) {
    if (tableMissing(error)) {
      return json({ error: 'Tabela editorial_sources nao encontrada. Rode migrations/0006_editorial_sources.sql no D1.' }, { status: 503 });
    }
    return json({ error: (error as Error).message || 'Falha ao salvar fontes.' }, { status: 500 });
  }
};

export const onRequestPatch = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const id = clean(body.id, 120);
  const feedUrl = normalizeUrl(body.feedUrl || body.feed_url);
  if (!id && !feedUrl) return json({ error: 'Informe id ou feedUrl.' }, { status: 400 });

  const updates: string[] = [];
  const values: unknown[] = [];
  const setIfPresent = (field: string, value: unknown, mapper = (item: unknown) => item) => {
    if (value === undefined) return;
    updates.push(`${field} = ?`);
    values.push(mapper(value));
  };

  setIfPresent('name', body.name, (value) => clean(value, 120));
  setIfPresent('category', body.category, normalizeCategory);
  setIfPresent('site_url', body.siteUrl ?? body.site_url, normalizeUrl);
  setIfPresent('trust_level', body.trustLevel ?? body.trust_level, (value) => Math.max(1, Math.min(5, Number(value || 3))));
  setIfPresent('weight', body.weight, (value) => Math.max(1, Math.min(10, Number(value || 1))));
  setIfPresent('active', body.active, (value) => (value === false || value === 0 ? 0 : 1));
  setIfPresent('status', body.status, (value) => clean(value, 40));
  setIfPresent('notes', body.notes, (value) => clean(value, 1000));
  setIfPresent('last_error', body.lastError ?? body.last_error, (value) => clean(value, 1000));
  setIfPresent('last_item_count', body.lastItemCount ?? body.last_item_count, (value) => Math.max(0, Number(value || 0)));
  setIfPresent('last_checked_at', body.lastCheckedAt ?? body.last_checked_at, (value) => clean(value, 80));

  if (!updates.length) return json({ error: 'Nenhum campo para atualizar.' }, { status: 400 });
  updates.push('updated_at = ?');
  values.push(new Date().toISOString());

  try {
    const where = id ? 'id = ?' : 'feed_url = ?';
    values.push(id || feedUrl);
    await db.prepare(`UPDATE editorial_sources SET ${updates.join(', ')} WHERE ${where}`).bind(...values).run();
    return json({ ok: true });
  } catch (error) {
    if (tableMissing(error)) {
      return json({ error: 'Tabela editorial_sources nao encontrada. Rode migrations/0006_editorial_sources.sql no D1.' }, { status: 503 });
    }
    return json({ error: (error as Error).message || 'Falha ao atualizar fonte.' }, { status: 500 });
  }
};

export const onRequestDelete = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  const url = new URL(request.url);
  const id = clean(url.searchParams.get('id'), 120);
  const feedUrl = normalizeUrl(url.searchParams.get('feedUrl'));
  if (!id && !feedUrl) return json({ error: 'Informe id ou feedUrl.' }, { status: 400 });

  try {
    await db.prepare(`DELETE FROM editorial_sources WHERE ${id ? 'id = ?' : 'feed_url = ?'}`).bind(id || feedUrl).run();
    return json({ ok: true });
  } catch (error) {
    if (tableMissing(error)) {
      return json({ error: 'Tabela editorial_sources nao encontrada. Rode migrations/0006_editorial_sources.sql no D1.' }, { status: 503 });
    }
    return json({ error: (error as Error).message || 'Falha ao remover fonte.' }, { status: 500 });
  }
};
