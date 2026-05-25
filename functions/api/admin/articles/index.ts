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

type R2ObjectBody = {
  body: ReadableStream;
  writeHttpMetadata?: (headers: Headers) => void;
};

type R2Bucket = {
  get: (key: string) => Promise<R2ObjectBody | null>;
  put: (
    key: string,
    value: ArrayBuffer,
    options?: {
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
      };
      customMetadata?: Record<string, string>;
    },
  ) => Promise<unknown>;
};

type Env = {
  EDITORIAL_DB?: D1Database;
  ADMIN_TOKEN?: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPOSITORY?: string;
  GITHUB_BRANCH?: string;
  MEDIA_BUCKET?: R2Bucket;
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
  coverCaption?: string;
  seoDescription?: string;
  keywords?: string;
  tags?: unknown[];
  sources?: unknown[];
  media?: unknown[];
  readingMinutes?: number;
  scheduledAt?: string;
  publishedAt?: string;
};

type ExistingArticleRecord = {
  id: string;
  slug?: string;
  status?: string;
  published_at?: string;
};

type StaticPublishResult = Awaited<ReturnType<typeof publishMarkdownToGitHub>> & {
  replaced?: Awaited<ReturnType<typeof deleteMarkdownFromGitHub>> | {
    ok: false;
    skipped: false;
    reason: string;
  };
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

const SUBJECT_STOP_WORDS = new Set([
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
  'mais',
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

const subjectTokens = (value: unknown) =>
  new Set(
    clean(value, 3000)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\bdjoko\b/g, 'djokovic')
      .replace(/\bconselho nacional de justica\b/g, 'cnj')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !SUBJECT_STOP_WORDS.has(token)),
  );

const overlapScore = (left: Set<string>, right: Set<string>) => {
  if (!left.size || !right.size) return { overlap: 0, ratio: 0 };
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return { overlap, ratio: overlap / Math.min(left.size, right.size) };
};

const findDuplicateArticle = async (
  db: D1Database,
  article: ReturnType<typeof normalizePayload>,
  existingId = '',
) => {
  const needle = subjectTokens(`${article.category} ${article.title} ${article.summary} ${article.keywords} ${article.tags}`);
  if (needle.size < 4) return null;

  const result = await db
    .prepare(
      `SELECT id, slug, title, summary, category, keywords, tags
       FROM articles
       WHERE id != ?
         AND status IN ('draft', 'scheduled', 'published')
         AND category = ?
       ORDER BY COALESCE(NULLIF(published_at, ''), scheduled_at, updated_at) DESC
       LIMIT 160`,
    )
    .bind(existingId || article.id, article.category)
    .all<{
      id: string;
      slug: string;
      title: string;
      summary: string;
      category: string;
      keywords?: string;
      tags?: string;
    }>();

  for (const candidate of result.results || []) {
    const haystack = subjectTokens(`${candidate.category} ${candidate.title} ${candidate.summary} ${candidate.keywords || ''} ${candidate.tags || ''}`);
    const score = overlapScore(needle, haystack);
    if (score.overlap >= 5 && score.ratio >= 0.5) {
      return { article: candidate, score };
    }
  }

  return null;
};

const normalizeEditorialQuoteFlow = (html: string) => {
  let output = String(html || '')
    .replace(/([.!?,;:])\s+([\u201d"])/g, '$1$2')
    .replace(/([\u201c"])\s+/g, '$1');

  let previous = '';
  while (output !== previous) {
    previous = output;
    output = output.replace(
      /<p([^>]*)>\s*([^<]*[\u201c"][^<]*?)\s*<\/p>\s*<p[^>]*>\s*([^<]*?[.!?])\s*([\u201d"])\s+([A-Z\u00c0-\u017f0-9][\s\S]*?)\s*<\/p>/gi,
      (_match, attrs, first, quoteEnd, quote, rest) =>
        `<p${attrs}>${String(first).trim()} ${String(quoteEnd).trim()}${quote}</p><p>${String(rest).trim()}</p>`,
    );
  }

  return output.replace(
    /<p([^>]*)>\s*([\s\S]*?[.!?][\u201d"])\s+([A-Z\u00c0-\u017f0-9][^<]*?)\s*<\/p>/g,
    (_match, attrs, quoteSentence, rest) => `<p${attrs}>${String(quoteSentence).trim()}</p><p>${String(rest).trim()}</p>`,
  );
};

const normalizeCurrentPublicRoles = (value: string) =>
  String(value || '')
    .replace(/\bDonald Trump,\s*ex-presidente dos Estados Unidos\b/gi, 'Donald Trump, presidente dos Estados Unidos')
    .replace(/\bex-presidente dos Estados Unidos\s+Donald Trump\b/gi, 'presidente dos Estados Unidos Donald Trump');

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

const cleanImageCredit = (value: unknown) => {
  const credit = clean(value, 180);
  if (!credit) return '';
  const normalized = credit.toLowerCase();
  if (normalized.startsWith('http')) return '';
  if (normalized === 'undefined' || normalized === 'null') return '';
  return credit;
};

const mediaCoverCaption = (mediaJson: string, coverUrl: string) => {
  const media = fromJsonArray(mediaJson);
  const cover = media.find((item) => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return String(record.src || '') === coverUrl || record.role === 'cover';
  });
  if (!cover || typeof cover !== 'object') return '';
  const record = cover as Record<string, unknown>;
  return cleanImageCredit(record.credit || record.caption || record.sourcePublisher);
};

const hasEditorialFlag = (mediaJson: string, homeSection: string) =>
  fromJsonArray(mediaJson).some((item) => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return record.type === 'editorialFlag' && record.homeSection === homeSection;
  });

const mediaHomeSection = (mediaJson: string) => (hasEditorialFlag(mediaJson, 'now') ? 'now' : '');

const mediaFeatured = (mediaJson: string) => hasEditorialFlag(mediaJson, 'featured');

const coverKeyBaseFor = (article: { slug: string; updatedAt?: string }) => {
  const version = clean(article.updatedAt, 40).replace(/[^0-9]/g, '').slice(0, 14) || String(Date.now());
  return `news/${article.slug}-cover-${version}`;
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

const base64ToArrayBuffer = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

const isRemoteImageUrl = (value: string) => /^https?:\/\//i.test(value) && !/\/media\/news\//i.test(value);
const isFallbackRemoteImage = (value: string) => /images\.unsplash\.com|source\.unsplash\.com|picsum\.photos/i.test(value);

const imageExtensionFromType = (contentType: string) => {
  const type = contentType.toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('avif')) return 'avif';
  return 'jpg';
};

const uploadImageBufferToR2 = async (
  env: Env,
  keyBase: string,
  mime: string,
  buffer: ArrayBuffer,
  source: string,
) => {
  if (!env.MEDIA_BUCKET || !buffer.byteLength || buffer.byteLength > 8_000_000) return null;

  const extension = imageExtensionFromType(mime);
  const key = `${keyBase}.${extension}`;
  await env.MEDIA_BUCKET.put(key, buffer, {
    httpMetadata: {
      contentType: mime.split(';')[0],
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      source: source.slice(0, 500),
    },
  });

  return {
    key,
    publicPath: `/media/${key}`,
  };
};

const uploadRemoteImageToR2 = async (env: Env, url: string, keyBase: string) => {
  if (!env.MEDIA_BUCKET || !isRemoteImageUrl(url)) return null;
  if (isFallbackRemoteImage(url)) return null;

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'image/avif,image/webp,image/png,image/jpeg,image/*',
        'user-agent': 'PortalNovoAlvoMediaIngest/1.0',
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!/^image\/(jpeg|jpg|png|webp|avif)/i.test(contentType)) return null;

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 8_000_000) return null;

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > 8_000_000) return null;

    return await uploadImageBufferToR2(env, keyBase, contentType, buffer, url);
  } catch {
    return null;
  }
};

const uploadDataImageToR2 = async (env: Env, dataUrl: string, keyBase: string) => {
  const upload = dataImageToUpload(dataUrl);
  if (!upload) return null;
  return await uploadImageBufferToR2(env, keyBase, upload.mime, base64ToArrayBuffer(upload.content), 'data-url');
};

const remoteImageToUpload = async (value: string) => {
  const url = clean(value, 2000);
  if (!isRemoteImageUrl(url)) return null;
  if (/^https:\/\/portalnovoalvo\.com\.br\/uploads\//i.test(url)) return null;

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'image/avif,image/webp,image/png,image/jpeg,image/*',
        'user-agent': 'PortalNovoAlvoMediaIngest/1.0',
      },
    });

    if (!response.ok) return null;

    const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!/^image\/(jpeg|jpg|png|webp|avif)$/.test(mime)) return null;

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 8_000_000) return null;

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > 8_000_000) return null;

    return {
      mime,
      extension: imageExtensionFromType(mime),
      content: arrayBufferToBase64(buffer),
      source: url,
    };
  } catch {
    return null;
  }
};

const prepareArticleMedia = async (env: Env, article: ReturnType<typeof normalizePayload>, origin: string) => {
  if (!env.MEDIA_BUCKET) return article;

  const coverUpload = dataImageToUpload(article.coverUrl);
  if (coverUpload || !isRemoteImageUrl(article.coverUrl)) return article;

  const uploadedCover = await uploadRemoteImageToR2(env, article.coverUrl, coverKeyBaseFor(article));
  if (!uploadedCover) return article;

  const publicCoverUrl = `${origin}${uploadedCover.publicPath}`;
  const media = fromJsonArray(article.media).map((item) => {
    if (!item || typeof item !== 'object') return item;
    const record = item as Record<string, unknown>;
    if (String(record.src || '') !== article.coverUrl) return item;
    return {
      ...record,
      src: publicCoverUrl,
      stored: 'r2',
    };
  });

  return {
    ...article,
    coverUrl: publicCoverUrl,
    media: JSON.stringify(media.length ? media : [{ src: publicCoverUrl, type: 'image', alt: article.coverAlt }]),
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

const deleteGitHubFile = async ({
  repository,
  branch,
  path,
  message,
  headers,
}: {
  repository: string;
  branch: string;
  path: string;
  message: string;
  headers: Record<string, string>;
}) => {
  const apiUrl = githubApiUrl(repository, path);
  const existingResponse = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  if (existingResponse.status === 404) {
    return { skipped: true, reason: 'Arquivo editorial não encontrado no GitHub.' };
  }
  if (!existingResponse.ok) {
    const errorText = await existingResponse.text();
    throw new Error(`GitHub recusou consulta de ${path}: ${errorText.slice(0, 500)}`);
  }

  const existing = (await existingResponse.json()) as { sha?: string };
  if (!existing.sha) throw new Error(`GitHub não retornou SHA para ${path}.`);

  const response = await fetch(apiUrl, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({
      branch,
      message,
      sha: existing.sha,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub recusou exclusão de ${path}: ${errorText.slice(0, 500)}`);
  }

  return (await response.json()) as { commit?: { html_url?: string } };
};

const createMarkdownFile = (article: ReturnType<typeof normalizePayload>, id: string, publishedAt: string) => {
  const tags = yamlStringArray(article.tags || article.keywords);
  const sources = yamlStringArray(article.sources);
  const body = article.bodyHtml || `<p>${article.summary}</p>`;
  const coverUrl = publicUrl(article.coverUrl) || `https://picsum.photos/seed/${id}/1600/900`;
  const coverCaption = cleanImageCredit(article.coverCaption) || mediaCoverCaption(article.media, article.coverUrl) || '';

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
featured: ${mediaFeatured(article.media) ? 'true' : 'false'}
isFeatured: false
urgent: false
homeSection: ${yamlString(mediaHomeSection(article.media))}
views: 0
cover:
  src: ${yamlString(coverUrl)}
  alt: ${yamlString(article.coverAlt || article.title)}
  caption: ${yamlString(coverCaption)}
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
    const r2Cover = await uploadDataImageToR2(env, articleForMarkdown.coverUrl, coverKeyBaseFor(article));
    if (r2Cover) {
      articleForMarkdown.coverUrl = r2Cover.publicPath;
      uploadedAssets.push(r2Cover.key);
    } else {
      const assetName = `${article.slug}-cover-${clean(article.updatedAt, 40).replace(/[^0-9]/g, '').slice(0, 14) || Date.now()}.${coverUpload.extension}`;
      const assetPath = `public/uploads/news/${assetName}`;
      await putGitHubFile({
        repository,
        branch,
        path: assetPath,
        content: coverUpload.content,
        message: `upload article cover: ${article.title}`,
        headers,
      });
      articleForMarkdown.coverUrl = `/uploads/news/${assetName}`;
      uploadedAssets.push(assetPath);
    }
  } else {
    const r2Cover = await uploadRemoteImageToR2(env, articleForMarkdown.coverUrl, coverKeyBaseFor(article));
    if (r2Cover) {
      articleForMarkdown.coverUrl = r2Cover.publicPath;
      uploadedAssets.push(r2Cover.key);
    } else {
      const remoteCoverUpload = await remoteImageToUpload(articleForMarkdown.coverUrl);
      if (remoteCoverUpload) {
        const assetName = `${article.slug}-cover-${clean(article.updatedAt, 40).replace(/[^0-9]/g, '').slice(0, 14) || Date.now()}.${remoteCoverUpload.extension}`;
        const assetPath = `public/uploads/news/${assetName}`;
        await putGitHubFile({
          repository,
          branch,
          path: assetPath,
          content: remoteCoverUpload.content,
          message: `mirror article cover: ${article.title}`,
          headers,
        });
        articleForMarkdown.coverUrl = `/uploads/news/${assetName}`;
        uploadedAssets.push(assetPath);
      }
    }
  }

  let inlineIndex = 0;
  const inlineUploads: Array<{ path: string; content: string }> = [];
  const dataInlineImages = [...articleForMarkdown.bodyHtml.matchAll(/data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+/gi)].map((match) => match[0]);
  for (const dataUrl of dataInlineImages) {
    const upload = dataImageToUpload(dataUrl);
    if (!upload) continue;
    inlineIndex += 1;
    const r2Image = await uploadDataImageToR2(env, dataUrl, `news/${article.slug}-${inlineIndex}`);
    if (r2Image) {
      uploadedAssets.push(r2Image.key);
      articleForMarkdown.bodyHtml = articleForMarkdown.bodyHtml.split(dataUrl).join(r2Image.publicPath);
    } else {
      const assetPath = `public/uploads/news/${article.slug}-${inlineIndex}.${upload.extension}`;
      uploadedAssets.push(assetPath);
      inlineUploads.push({ path: assetPath, content: upload.content });
      articleForMarkdown.bodyHtml = articleForMarkdown.bodyHtml.split(dataUrl).join(`/uploads/news/${article.slug}-${inlineIndex}.${upload.extension}`);
    }
  }

  const remoteInlineImages = [
    ...new Set(
      [...articleForMarkdown.bodyHtml.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi)]
        .map((match) => match[1])
        .filter((src) => !/^https:\/\/portalnovoalvo\.com\.br\/(?:uploads|media)\//i.test(src) && !isFallbackRemoteImage(src)),
    ),
  ].slice(0, 4);

  for (const remoteImage of remoteInlineImages) {
    inlineIndex += 1;
    const r2Image = await uploadRemoteImageToR2(env, remoteImage, `news/${article.slug}-${inlineIndex}`);
    if (r2Image) {
      uploadedAssets.push(r2Image.key);
      articleForMarkdown.bodyHtml = articleForMarkdown.bodyHtml.split(remoteImage).join(r2Image.publicPath);
    } else {
      const upload = await remoteImageToUpload(remoteImage);
      if (!upload) continue;
      const assetPath = `public/uploads/news/${article.slug}-${inlineIndex}.${upload.extension}`;
      uploadedAssets.push(assetPath);
      inlineUploads.push({ path: assetPath, content: upload.content });
      articleForMarkdown.bodyHtml = articleForMarkdown.bodyHtml.split(remoteImage).join(`/uploads/news/${article.slug}-${inlineIndex}.${upload.extension}`);
    }
  }

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

const deleteMarkdownFromGitHub = async (env: Env, article: { slug?: string; title?: string }) => {
  const slug = slugify(article.slug || '');
  if (!slug) return { ok: false, skipped: true, reason: 'Slug ausente.' };
  if (!env.GITHUB_TOKEN) {
    return {
      ok: false,
      skipped: true,
      reason: 'GITHUB_TOKEN não configurado. A matéria foi removida do banco, mas o arquivo estático não foi apagado.',
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

  const path = `src/content/news/${slug}.md`;
  const result = await deleteGitHubFile({
    repository,
    branch,
    path,
    message: `remove article: ${article.title || slug}`,
    headers,
  });
  const deleteResult = result as {
    skipped?: boolean;
    reason?: string;
    commit?: { html_url?: string };
  };

  return {
    ok: true,
    skipped: Boolean(deleteResult.skipped),
    path,
    commitUrl: deleteResult.commit?.html_url,
    reason: deleteResult.reason,
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
    summary: normalizeCurrentPublicRoles(clean(payload.summary, 700)),
    bodyHtml: normalizeCurrentPublicRoles(normalizeEditorialQuoteFlow(clean(payload.bodyHtml, 250000))),
    category: clean(payload.category, 80) || 'Política',
    author: clean(payload.author, 120) || 'Redação Novo Alvo',
    status,
    coverUrl: clean(payload.coverUrl, 8000000),
    coverAlt: clean(payload.coverAlt, 240),
    coverCaption: cleanImageCredit(payload.coverCaption),
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

  const origin = new URL(request.url).origin;
  const article = await prepareArticleMedia(env, normalizePayload(rawPayload), origin);
  const requestedId = clean(rawPayload.id, 80);
  const existingById = requestedId
    ? await db
        .prepare('SELECT id, slug, status, published_at FROM articles WHERE id = ? LIMIT 1')
        .bind(requestedId)
        .first<ExistingArticleRecord>()
    : null;
  const existingBySlug = article.slug
    ? await db
        .prepare('SELECT id, slug, status, published_at FROM articles WHERE slug = ? LIMIT 1')
        .bind(article.slug)
        .first<ExistingArticleRecord>()
    : null;

  if (existingById && existingBySlug && existingBySlug.id !== existingById.id) {
    return json(
      {
        error:
          'Este slug ja esta em uso por outra materia. Ajuste o slug antes de salvar para evitar publicacao duplicada.',
      },
      { status: 409 },
    );
  }

  const existing = existingById || existingBySlug;
  const id = existing?.id || article.id;
  const previousSlug = clean(existing?.slug, 160);
  const previousPublishedAt = clean(existing?.published_at, 80);
  const duplicate = await findDuplicateArticle(db, article, id);
  if (!existing && duplicate) {
    return json(
      {
        error:
          `Possivel materia duplicada: o assunto ja existe em "${duplicate.article.title}" (${duplicate.article.slug}). Edite a materia existente em vez de criar uma nova.`,
        duplicateOf: duplicate.article.slug,
      },
      { status: 409 },
    );
  }

  const publishedAt =
    article.status === 'published'
      ? article.publishedAt || previousPublishedAt || article.updatedAt
      : article.publishedAt || previousPublishedAt || '';

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

  const staticPublish: StaticPublishResult | null =
    article.status === 'published' ? await publishMarkdownToGitHub(env, article, id, publishedAt).catch((error) => ({
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : 'Falha desconhecida ao publicar no GitHub.',
    })) : null;

  if (
    staticPublish?.ok &&
    previousSlug &&
    previousSlug !== article.slug &&
    (existing?.status === 'published' || previousPublishedAt)
  ) {
    staticPublish.replaced = await deleteMarkdownFromGitHub(env, {
      slug: previousSlug,
      title: existing?.slug || previousSlug,
    }).catch((error) => ({
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : 'Falha desconhecida ao remover arquivo antigo.',
    }));
  }

  return json({
    ok: true,
    staticPublish,
    article: {
      id,
      slug: article.slug,
      status: article.status,
      publishedAt,
      updatedAt: article.updatedAt,
    },
  });
};

export const onRequestDelete = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = getDb(env);
  if (!db) return json({ error: 'Binding EDITORIAL_DB não configurado.' }, { status: 503 });

  const url = new URL(request.url);
  const id = clean(url.searchParams.get('id') || url.searchParams.get('slug'), 120);
  if (!id) return json({ error: 'Informe id ou slug da matéria.' }, { status: 400 });

  const article = await db
    .prepare('SELECT id, slug, title, status FROM articles WHERE id = ? OR slug = ? LIMIT 1')
    .bind(id, id)
    .first<{ id: string; slug: string; title: string; status: string }>();

  if (!article) return json({ error: 'Matéria não encontrada.' }, { status: 404 });

  await db.prepare('DELETE FROM articles WHERE id = ?').bind(article.id).run();
  const staticDelete =
    article.slug && (article.status === 'published' || article.status === 'scheduled')
      ? await deleteMarkdownFromGitHub(env, article).catch((error) => ({
          ok: false,
          skipped: false,
          reason: error instanceof Error ? error.message : 'Falha desconhecida ao remover arquivo estático.',
        }))
      : null;

  return json({
    ok: true,
    staticDelete,
    deleted: {
      id: article.id,
      slug: article.slug,
      status: article.status,
    },
  });
};
