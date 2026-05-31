type D1Result<T> = { results?: T[] };

type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      all: <T = unknown>() => Promise<D1Result<T>>;
      run: () => Promise<unknown>;
    };
    all: <T = unknown>() => Promise<D1Result<T>>;
    run: () => Promise<unknown>;
  };
};

type Env = {
  ADMIN_TOKEN?: string;
  EDITORIAL_DB?: D1Database;
  X_API_KEY?: string;
  X_API_SECRET?: string;
  X_ACCESS_TOKEN?: string;
  X_ACCESS_TOKEN_SECRET?: string;
};

type ArticleRow = {
  id?: string;
  slug?: string;
  title?: string;
  summary?: string;
  category?: string;
  published_at?: string;
  cover_url?: string;
};

type SocialPostRow = {
  id?: string;
  article_id?: string;
  article_slug?: string;
  article_title?: string;
  channel?: string;
  status?: string;
  text?: string;
  tweet_id?: string;
  error?: string;
  created_at?: string;
  posted_at?: string;
};

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

const requireAdmin = (request: Request, env: Env) => {
  const expected = clean(env.ADMIN_TOKEN, 500);
  if (!expected) return json({ ok: false, error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-admin-token') || '';
  if (token !== expected) return json({ ok: false, error: 'Token editorial invalido.' }, { status: 401 });
  return null;
};

const hasXSecrets = (env: Env) =>
  Boolean(clean(env.X_API_KEY, 500) && clean(env.X_API_SECRET, 500) && clean(env.X_ACCESS_TOKEN, 500) && clean(env.X_ACCESS_TOKEN_SECRET, 500));

const ensureTable = async (db: D1Database) => {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS social_posts (
        id TEXT PRIMARY KEY,
        article_id TEXT,
        article_slug TEXT,
        article_title TEXT,
        channel TEXT NOT NULL DEFAULT 'x',
        status TEXT NOT NULL DEFAULT 'draft',
        text TEXT NOT NULL,
        tweet_id TEXT,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        posted_at TEXT
      )`,
    )
    .run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_social_posts_channel_status ON social_posts(channel, status, created_at DESC)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_social_posts_article ON social_posts(article_slug)').run();
};

const oauthEncode = (value: unknown) =>
  encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const base64 = (bytes: ArrayBuffer) => {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const hmacSha1 = async (key: string, text: string) => {
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(text));
  return base64(signature);
};

const oauthHeader = async (env: Env, method: string, endpoint: string) => {
  const params: Record<string, string> = {
    oauth_consumer_key: clean(env.X_API_KEY, 500),
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: clean(env.X_ACCESS_TOKEN, 500),
    oauth_version: '1.0',
  };
  const normalized = Object.entries(params)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const left = `${oauthEncode(leftKey)}=${oauthEncode(leftValue)}`;
      const right = `${oauthEncode(rightKey)}=${oauthEncode(rightValue)}`;
      return left.localeCompare(right);
    })
    .map(([key, value]) => `${oauthEncode(key)}=${oauthEncode(value)}`)
    .join('&');
  const base = [method.toUpperCase(), oauthEncode(endpoint), oauthEncode(normalized)].join('&');
  const signingKey = `${oauthEncode(clean(env.X_API_SECRET, 500))}&${oauthEncode(clean(env.X_ACCESS_TOKEN_SECRET, 500))}`;
  params.oauth_signature = await hmacSha1(signingKey, base);
  return `OAuth ${Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${oauthEncode(key)}="${oauthEncode(value)}"`)
    .join(', ')}`;
};

const articleUrl = (slug: string) =>
  `https://portalnovoalvo.com.br/noticia/${encodeURIComponent(slug)}/?utm_source=x&utm_medium=social&utm_campaign=admin_social`;

const compactText = (value: unknown, max: number) => {
  const text = clean(value, 1000).replace(/\s+/g, ' ');
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

const suggestText = (article: ArticleRow) => {
  const title = clean(article.title, 180);
  const summary = clean(article.summary, 260);
  const slug = clean(article.slug, 180);
  const url = articleUrl(slug);
  const context = summary ? compactText(summary.replace(/\.$/, ''), 118) : compactText(title, 118);
  const prefix = `O que importa: ${context}.`;
  const remaining = Math.max(30, 270 - prefix.length - url.length - 4);
  return `${prefix}\n\n${compactText(title, remaining)}\n${url}`;
};

const postToX = async (env: Env, text: string) => {
  const endpoint = 'https://api.x.com/2/tweets';
  const auth = await oauthHeader(env, 'POST', endpoint);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: auth,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = clean(
      (data as { detail?: string; title?: string; errors?: Array<{ message?: string }> } | null)?.detail ||
        (data as { title?: string } | null)?.title ||
        (data as { errors?: Array<{ message?: string }> } | null)?.errors?.map((item) => item.message).filter(Boolean).join('; '),
      500,
    );
    throw new Error(detail || `X respondeu ${response.status}`);
  }
  return data as { data?: { id?: string; text?: string } };
};

const mapPost = (row: SocialPostRow) => ({
  id: clean(row.id, 80),
  articleId: clean(row.article_id, 80),
  articleSlug: clean(row.article_slug, 180),
  articleTitle: clean(row.article_title, 240),
  channel: clean(row.channel, 20),
  status: clean(row.status, 30),
  text: clean(row.text, 1000),
  tweetId: clean(row.tweet_id, 80),
  error: clean(row.error, 500),
  createdAt: clean(row.created_at, 80),
  postedAt: clean(row.posted_at, 80),
});

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = env.EDITORIAL_DB;
  if (!db) return json({ ok: false, error: 'Banco editorial nao configurado.' }, { status: 503 });
  await ensureTable(db);

  const articles = await db
    .prepare(
      `SELECT id, slug, title, summary, category, published_at, cover_url
         FROM articles
        WHERE status = 'published'
        ORDER BY COALESCE(NULLIF(published_at, ''), updated_at, created_at) DESC
        LIMIT 30`,
    )
    .all<ArticleRow>();

  const posts = await db
    .prepare(
      `SELECT id, article_id, article_slug, article_title, channel, status, text, tweet_id, error, created_at, posted_at
         FROM social_posts
        WHERE channel = 'x'
        ORDER BY created_at DESC
        LIMIT 30`,
    )
    .all<SocialPostRow>();

  const postedSlugs = new Set((posts.results || []).filter((post) => post.status === 'posted').map((post) => clean(post.article_slug, 180)));

  return json({
    ok: true,
    xConfigured: hasXSecrets(env),
    articles: (articles.results || []).map((article) => ({
      id: clean(article.id, 80),
      slug: clean(article.slug, 180),
      title: clean(article.title, 240),
      summary: clean(article.summary, 400),
      category: clean(article.category, 80),
      publishedAt: clean(article.published_at, 80),
      coverUrl: clean(article.cover_url, 500),
      suggestedText: suggestText(article),
      alreadyPosted: postedSlugs.has(clean(article.slug, 180)),
    })),
    posts: (posts.results || []).map(mapPost),
    generatedAt: new Date().toISOString(),
  });
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = env.EDITORIAL_DB;
  if (!db) return json({ ok: false, error: 'Banco editorial nao configurado.' }, { status: 503 });
  await ensureTable(db);

  const payload = (await request.json().catch(() => ({}))) as {
    action?: string;
    articleId?: string;
    text?: string;
    dryRun?: boolean;
  };
  const action = clean(payload.action, 30) || 'post';
  const articleId = clean(payload.articleId, 100);
  const dryRun = Boolean(payload.dryRun);

  if (action === 'status') {
    return json({ ok: true, xConfigured: hasXSecrets(env) });
  }

  const article = await db
    .prepare(
      `SELECT id, slug, title, summary, category, published_at, cover_url
         FROM articles
        WHERE id = ? OR slug = ?
        LIMIT 1`,
    )
    .bind(articleId, articleId)
    .first<ArticleRow>();

  if (!article?.slug) return json({ ok: false, error: 'Materia nao encontrada.' }, { status: 404 });

  const text = compactText(clean(payload.text, 1000) || suggestText(article), 280);
  if (text.length < 10) return json({ ok: false, error: 'Texto do post muito curto.' }, { status: 400 });

  if (dryRun || action === 'draft') {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO social_posts (id, article_id, article_slug, article_title, channel, status, text, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'x', 'draft', ?, ?, ?)`,
      )
      .bind(id, clean(article.id, 80), clean(article.slug, 180), clean(article.title, 240), text, now, now)
      .run();
    return json({ ok: true, post: { id, status: 'draft', text } });
  }

  if (!hasXSecrets(env)) {
    return json(
      {
        ok: false,
        error: 'Secrets do X ausentes. Configure X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN e X_ACCESS_TOKEN_SECRET no Cloudflare.',
      },
      { status: 503 },
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    const result = await postToX(env, text);
    const tweetId = clean(result.data?.id, 80);
    await db
      .prepare(
        `INSERT INTO social_posts (id, article_id, article_slug, article_title, channel, status, text, tweet_id, created_at, updated_at, posted_at)
         VALUES (?, ?, ?, ?, 'x', 'posted', ?, ?, ?, ?, ?)`,
      )
      .bind(id, clean(article.id, 80), clean(article.slug, 180), clean(article.title, 240), text, tweetId, now, now, now)
      .run();
    return json({ ok: true, post: { id, status: 'posted', tweetId, text } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .prepare(
        `INSERT INTO social_posts (id, article_id, article_slug, article_title, channel, status, text, error, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'x', 'error', ?, ?, ?, ?)`,
      )
      .bind(id, clean(article.id, 80), clean(article.slug, 180), clean(article.title, 240), text, clean(message, 500), now, now)
      .run();
    return json({ ok: false, error: 'X nao aceitou a postagem.', detail: message }, { status: 502 });
  }
};
