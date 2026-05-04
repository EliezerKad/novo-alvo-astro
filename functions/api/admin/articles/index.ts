type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      all: <T = unknown>() => Promise<{ results?: T[] }>;
      run: () => Promise<unknown>;
    };
    all: <T = unknown>() => Promise<{ results?: T[] }>;
  };
};

type Env = {
  EDITORIAL_DB?: D1Database;
  ADMIN_TOKEN?: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPOSITORY?: string;
  GITHUB_BRANCH?: string;
};

type ArticlePayload = {
  id?: string;
  slug?: string;
  title?: string;
  summary?: string;
  bodyHtml?: string;
  category?: string;
  author?: string;
  status?: string;
  coverUrl?: string;
  coverAlt?: string;
  seoDescription?: string;
  keywords?: string;
  tags?: unknown[];
  sources?: unknown[];
  media?: unknown[];
  readingMinutes?: number;
  scheduledAt?: string;
  publishedAt?: string;
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

const uid = () => crypto.randomUUID();

const clean = (value: unknown, max = 2000) =>
  String(value || '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);

const slugify = (value: unknown) =>
  clean(value, 180)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

const asJson = (value: unknown) => JSON.stringify(Array.isArray(value) ? value : []);

const fromJsonArray = (value: string): unknown[] => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const yamlString = (value: unknown) => JSON.stringify(String(value || ''));

const yamlStringArray = (value: string) => {
  const items = fromJsonArray(value)
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        return record.name || record.url || record.label || '';
      }
      return '';
    })
    .map((item) => clean(item, 160))
    .filter(Boolean);

  return `[${items.map(yamlString).join(', ')}]`;
};

const publicUrl = (value: string) => {
  const cleanValue = clean(value, 8000000);
  if (!cleanValue) return '';
  if (/^blob:/i.test(cleanValue)) return '';
  if (/^https?:\/\//i.test(cleanValue)) return cleanValue;
  if (cleanValue.startsWith('/')) return `https://portalnovoalvo.com.br${cleanValue}`;
  return cleanValue;
};

const toBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

const dataImageToUpload = (value: string) => {
  const match = String(value || '').match(/^data:(image\/(?:png|jpe?g|webp));base64,([\s\S]+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const extension = mime.includes('png') ? 'png' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'webp';
  const content = match[2].replace(/\s/g, '');
  try {
    atob(content);
  } catch {
    return null;
  }
  return {
    mime,
    extension,
    content,
  };
};

const githubApiUrl = (repository: string, path: string) =>
  `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`;

const putGitHubFile = async ({
  repository,
  branch,
  path,
  content,
  message,
  headers,
}: {
  repository: string;
  branch: string;
  path: string;
  content: string;
  message: string;
  headers: Record<string, string>;
}) => {
  const apiUrl = githubApiUrl(repository, path);
  const existingResponse = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  const existing = existingResponse.ok ? ((await existingResponse.json()) as { sha?: string }) : null;
  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      branch,
      message,
      content,
      sha: existing?.sha,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub recusou ${path}: ${errorText.slice(0, 500)}`);
  }

  return (await response.json()) as { commit?: { html_url?: string }; content?: { html_url?: string } };
};

const createMarkdownFile = (article: ReturnType<typeof normalizePayload>, id: string, publishedAt: string) => {
  const tags = yamlStringArray(article.tags || article.keywords);
  const sources = yamlStringArray(article.sources);
  const body = article.bodyHtml || `<p>${article.summary}</p>`;
  const coverUrl = publicUrl(article.coverUrl) || `https://picsum.photos/seed/${id}/1600/900`;

  return `---
title: ${yamlString(article.title)}
slug: ${yamlString(article.slug)}
summary: ${yamlString(article.summary)}
seoDescription: ${yamlString(article.seoDescription || article.summary)}
category: ${yamlString(article.category)}
author: ${yamlString(article.author)}
sources: ${sources}
publishedAt: ${yamlString(publishedAt)}
updatedAt: ${yamlString(article.updatedAt)}
featured: false
isFeatured: false
urgent: false
views: 0
cover:
  src: ${yamlString(coverUrl)}
  alt: ${yamlString(article.coverAlt || article.title)}
  caption: ${yamlString(article.coverAlt || '')}
  layout: ${yamlString(article.coverUrl ? 'full' : 'none')}
ogImage: ${yamlString(coverUrl)}
tags: ${tags}
---

${body}
`;
};

const publishMarkdownToGitHub = async (
  env: Env,
  article: ReturnType<typeof normalizePayload>,
  id: string,
  publishedAt: string,
) => {
  if (!env.GITHUB_TOKEN) {
    return {
      ok: false,
      skipped: true,
      reason:
        'GITHUB_TOKEN não configurado. A matéria foi salva no banco, mas ainda não foi enviada para o template Astro estático.',
    };
  }

  const repository = clean(env.GITHUB_REPOSITORY, 160) || 'EliezerKad/novo-alvo-astro';
  const branch = clean(env.GITHUB_BRANCH, 80) || 'main';
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'content-type': 'application/json',
    'user-agent': 'portal-novo-alvo-editorial-cms',
    'x-github-api-version': '2022-11-28',
  };

  const articleForMarkdown = { ...article };
  const uploadedAssets: string[] = [];
  const coverUpload = dataImageToUpload(articleForMarkdown.coverUrl);
  if (coverUpload) {
    const assetPath = `public/uploads/news/${article.slug}-cover.${coverUpload.extension}`;
    await putGitHubFile({
      repository,
      branch,
      path: assetPath,
      content: coverUpload.content,
      message: `upload article cover: ${article.title}`,
      headers,
    });
    articleForMarkdown.coverUrl = `/uploads/news/${article.slug}-cover.${coverUpload.extension}`;
    uploadedAssets.push(assetPath);
  }

  let inlineIndex = 0;
  const inlineUploads: Array<{ path: string; content: string }> = [];
  articleForMarkdown.bodyHtml = articleForMarkdown.bodyHtml.replace(/data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+/gi, (dataUrl) => {
    const upload = dataImageToUpload(dataUrl);
    if (!upload) return dataUrl;
    inlineIndex += 1;
    const assetPath = `public/uploads/news/${article.slug}-${inlineIndex}.${upload.extension}`;
    uploadedAssets.push(assetPath);
    inlineUploads.push({ path: assetPath, content: upload.content });
    return `/uploads/news/${article.slug}-${inlineIndex}.${upload.extension}`;
  });

  for (const upload of inlineUploads) {
    await putGitHubFile({
      repository,
      branch,
      path: upload.path,
      content: upload.content,
      message: `upload article media: ${article.title}`,
      headers,
    });
  }

  const path = `src/content/news/${article.slug}.md`;
  const markdown = createMarkdownFile(articleForMarkdown, id, publishedAt);
  const result = await putGitHubFile({
    repository,
    branch,
    path,
    content: toBase64(markdown),
    message: `publish article: ${article.title}`,
    headers,
  });

  return {
    ok: true,
    skipped: false,
    path,
    uploadedAssets,
    commitUrl: result.commit?.html_url,
    fileUrl: result.content?.html_url,
  };
};

const requireAdmin = (request: Request, env: Env) => {
  if (!env.ADMIN_TOKEN) {
    return json(
      {
        error:
          'ADMIN_TOKEN não configurado. Crie uma variável secreta ADMIN_TOKEN no Cloudflare Pages antes de usar o CMS.',
      },
      { status: 503 },
    );
  }

  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-admin-token') || '';
  if (token !== env.ADMIN_TOKEN) return json({ error: 'Token editorial inválido.' }, { status: 401 });
  return null;
};

const getDb = (env: Env) => env.EDITORIAL_DB;

const normalizePayload = (payload: ArticlePayload) => {
  const title = clean(payload.title, 220);
  const status = ['draft', 'scheduled', 'published'].includes(clean(payload.status, 24)) ? clean(payload.status, 24) : 'draft';
  const now = new Date().toISOString();
  return {
    id: clean(payload.id, 80) || uid(),
    slug: slugify(payload.slug || title || uid()),
    title: title || 'Matéria sem título',
    summary: clean(payload.summary, 700),
    bodyHtml: clean(payload.bodyHtml, 250000),
    category: clean(payload.category, 80) || 'Política',
    author: clean(payload.author, 120) || 'Redação Novo Alvo',
    status,
    coverUrl: clean(payload.coverUrl, 8000000),
    coverAlt: clean(payload.coverAlt, 240),
    seoDescription: clean(payload.seoDescription, 220),
    keywords: clean(payload.keywords, 700),
    tags: asJson(payload.tags),
    sources: asJson(payload.sources),
    media: asJson(payload.media),
    readingMinutes: Math.max(0, Math.min(999, Number(payload.readingMinutes || 0))),
    scheduledAt: clean(payload.scheduledAt, 40),
    publishedAt: clean(payload.publishedAt, 40),
    updatedAt: now,
  };
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB não configurado.' }, { status: 503 });

  const url = new URL(request.url);
  const id = clean(url.searchParams.get('id'), 120);
  const status = clean(url.searchParams.get('status'), 24);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 50)));

  if (id) {
    const article = await db
      .prepare(
        `SELECT
          id, slug, title, summary, body_html, category, author, status, cover_url, cover_alt,
          seo_description, keywords, tags, sources, media, reading_minutes, scheduled_at, published_at, created_at, updated_at
        FROM articles
        WHERE id = ? OR slug = ?
        LIMIT 1`,
      )
      .bind(id, id)
      .first();

    if (!article) return json({ error: 'Matéria não encontrada.' }, { status: 404 });
    return json({ article });
  }

  let result;
  if (status === 'published') {
    result = await db
      .prepare(
        `SELECT id, slug, title, summary, category, author, status, cover_url, scheduled_at, published_at, created_at, updated_at
         FROM articles
         WHERE status = 'published' OR COALESCE(NULLIF(published_at, ''), '') != ''
         ORDER BY COALESCE(NULLIF(published_at, ''), updated_at) DESC
         LIMIT ?`,
      )
      .bind(limit)
      .all();
  } else if (status === 'scheduled') {
    result = await db
      .prepare(
        `SELECT id, slug, title, summary, category, author, status, cover_url, scheduled_at, published_at, created_at, updated_at
         FROM articles
         WHERE status = 'scheduled'
            OR (COALESCE(NULLIF(scheduled_at, ''), '') != '' AND COALESCE(NULLIF(published_at, ''), '') = '' AND status != 'published')
         ORDER BY scheduled_at DESC, updated_at DESC
         LIMIT ?`,
      )
      .bind(limit)
      .all();
  } else if (status) {
    result = await db
      .prepare(
        'SELECT id, slug, title, summary, category, author, status, cover_url, scheduled_at, published_at, created_at, updated_at FROM articles WHERE status = ? ORDER BY updated_at DESC LIMIT ?',
      )
      .bind(status, limit)
      .all();
  } else {
    result = await db
      .prepare(
        'SELECT id, slug, title, summary, category, author, status, cover_url, scheduled_at, published_at, created_at, updated_at FROM articles ORDER BY updated_at DESC LIMIT ?',
      )
      .bind(limit)
      .all();
  }

  return json({ articles: result.results || [] });
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB não configurado.' }, { status: 503 });

  let rawPayload: ArticlePayload;
  try {
    rawPayload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const article = normalizePayload(rawPayload);
  const existing = await db.prepare('SELECT id FROM articles WHERE id = ? OR slug = ? LIMIT 1').bind(article.id, article.slug).first<{ id: string }>();
  const id = existing?.id || article.id;
  const publishedAt = article.status === 'published' ? article.publishedAt || article.updatedAt : article.publishedAt || '';

  await db
    .prepare(
      `INSERT INTO articles (
        id, slug, title, summary, body_html, category, author, status, cover_url, cover_alt,
        seo_description, keywords, tags, sources, media, reading_minutes, scheduled_at, published_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        title = excluded.title,
        summary = excluded.summary,
        body_html = excluded.body_html,
        category = excluded.category,
        author = excluded.author,
        status = excluded.status,
        cover_url = excluded.cover_url,
        cover_alt = excluded.cover_alt,
        seo_description = excluded.seo_description,
        keywords = excluded.keywords,
        tags = excluded.tags,
        sources = excluded.sources,
        media = excluded.media,
        reading_minutes = excluded.reading_minutes,
        scheduled_at = excluded.scheduled_at,
        published_at = excluded.published_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      article.slug,
      article.title,
      article.summary,
      article.bodyHtml,
      article.category,
      article.author,
      article.status,
      article.coverUrl,
      article.coverAlt,
      article.seoDescription,
      article.keywords,
      article.tags,
      article.sources,
      article.media,
      article.readingMinutes,
      article.scheduledAt,
      publishedAt,
      article.updatedAt,
    )
    .run();

  const staticPublish =
    article.status === 'published' ? await publishMarkdownToGitHub(env, article, id, publishedAt).catch((error) => ({
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : 'Falha desconhecida ao publicar no GitHub.',
    })) : null;

  return json({
    ok: true,
    staticPublish,
    article: {
      id,
      slug: article.slug,
      status: article.status,
      updatedAt: article.updatedAt,
    },
  });
};
