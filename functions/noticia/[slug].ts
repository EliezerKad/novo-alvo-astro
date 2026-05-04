type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
    };
  };
};

type Env = {
  EDITORIAL_DB?: D1Database;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
};

type CmsArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body_html: string;
  category: string;
  author: string;
  status: string;
  cover_url: string;
  cover_alt: string;
  seo_description: string;
  keywords: string;
  sources: string;
  media: string;
  reading_minutes: number;
  scheduled_at: string;
  published_at: string;
  created_at: string;
  updated_at: string;
};

const escapeHtml = (value: unknown) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const stripEditorChrome = (html: string) =>
  String(html || '')
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/\scontenteditable="[^"]*"/gi, '')
    .replace(/\sdata-[a-z0-9-]+="[^"]*"/gi, '')
    .replace(/\sclass="[^"]*(?:media-actions|carousel-controls|editor-only)[^"]*"/gi, '');

const parseSources = (value: string): Array<{ name?: string; url?: string; note?: string } | string> => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const fallbackToAssets = (request: Request, env: Env) =>
  env.ASSETS?.fetch(request) || new Response('Not found', { status: 404 });

export const onRequestGet = async ({ request, env, params }: { request: Request; env: Env; params: { slug: string } }) => {
  const db = env.EDITORIAL_DB;
  if (!db) return fallbackToAssets(request, env);

  const slug = String(params.slug || '').trim();
  const now = new Date().toISOString();
  const article = await db
    .prepare(
      `SELECT
        id, slug, title, summary, body_html, category, author, status, cover_url, cover_alt,
        seo_description, keywords, sources, media, reading_minutes, scheduled_at, published_at, created_at, updated_at
       FROM articles
       WHERE slug = ?
         AND (status = 'published' OR (status = 'scheduled' AND scheduled_at <= ?))
       LIMIT 1`,
    )
    .bind(slug, now)
    .first<CmsArticle>();

  if (!article) return fallbackToAssets(request, env);

  const url = new URL(request.url);
  const canonical = `${url.origin}/noticia/${encodeURIComponent(article.slug)}/`;
  const published = article.published_at || article.scheduled_at || article.created_at || article.updated_at;
  const modified = article.updated_at || published;
  const description = article.seo_description || article.summary || `Leia ${article.title} no Portal Novo Alvo.`;
  const image = article.cover_url || `${url.origin}/og-default.svg`;
  const sources = parseSources(article.sources);
  const cleanBody = stripEditorChrome(article.body_html);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description,
    image: [image],
    datePublished: published,
    dateModified: modified,
    author: [{ '@type': 'Person', name: article.author || 'Redação Novo Alvo' }],
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: 'Portal Novo Alvo',
      logo: { '@type': 'ImageObject', url: `${url.origin}/og-default.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    articleSection: article.category,
    keywords: article.keywords,
    isAccessibleForFree: true,
    inLanguage: 'pt-BR',
  };

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${escapeHtml(article.title)} | Portal Novo Alvo</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta property="og:site_name" content="Portal Novo Alvo" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(article.title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:alt" content="${escapeHtml(article.cover_alt || article.title)}" />
    <meta property="article:published_time" content="${escapeHtml(published)}" />
    <meta property="article:modified_time" content="${escapeHtml(modified)}" />
    <meta property="article:author" content="${escapeHtml(article.author || 'Redação Novo Alvo')}" />
    <meta property="article:section" content="${escapeHtml(article.category)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(article.title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Playfair+Display:ital,wght@0,900;1,900&display=swap" />
    <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
    <style>
      :root { color-scheme: light dark; --red:#dc2626; --ink:#09090b; --muted:#71717a; }
      * { box-sizing: border-box; }
      body { margin:0; font-family: Inter, system-ui, sans-serif; background:#fff; color:var(--ink); }
      .top { position:sticky; top:0; z-index:10; border-bottom:1px solid #eee; background:rgba(255,255,255,.9); backdrop-filter:blur(18px); }
      .nav { max-width:1120px; margin:auto; padding:18px 20px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
      .brand { display:flex; align-items:center; gap:12px; color:inherit; text-decoration:none; font-weight:900; letter-spacing:.16em; text-transform:uppercase; }
      .brand img { width:34px; height:34px; }
      .back { border:1px solid #e4e4e7; border-radius:999px; padding:10px 14px; text-decoration:none; color:#52525b; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.14em; }
      main { max-width:1050px; margin:auto; padding:64px 20px 96px; }
      .meta { display:flex; flex-wrap:wrap; gap:14px; align-items:center; color:#a1a1aa; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.18em; }
      .cat { background:var(--red); color:white; border-radius:10px; padding:8px 12px; }
      h1 { margin:34px 0 24px; max-width:980px; font-family:"Playfair Display", Georgia, serif; font-size:clamp(2.7rem,8vw,5.8rem); line-height:.96; letter-spacing:-.055em; }
      .summary { max-width:820px; color:#52525b; font-size:clamp(1.35rem,3.2vw,2rem); line-height:1.25; font-style:italic; }
      .byline { margin-top:24px; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.16em; color:#3f3f46; }
      figure { margin:56px 0; }
      figure img { display:block; width:100%; max-height:620px; object-fit:cover; border-radius:38px; box-shadow:0 24px 80px rgba(15,23,42,.16); }
      figcaption { margin-top:14px; text-align:center; color:#71717a; font-size:12px; font-style:italic; }
      .content { max-width:780px; margin:0 auto; font-family: Georgia, serif; font-size:1.28rem; line-height:1.85; overflow-wrap:anywhere; }
      .content p { margin:0 0 2rem; }
      .content h2 { margin:4rem 0 1.5rem; padding-left:1rem; border-left:4px solid var(--red); font-family:"Playfair Display", Georgia, serif; font-size:2.4rem; line-height:1.05; font-style:italic; }
      .content h3 { margin:3rem 0 1rem; font-family:"Playfair Display", Georgia, serif; font-size:1.75rem; }
      .content img { max-width:100%; border-radius:28px; }
      .content figure { margin:3rem 0; }
      .content a { color:var(--red); font-weight:700; }
      .sources { max-width:780px; margin:48px auto 0; padding-top:24px; border-top:1px solid #eee; display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .sources span, .sources a { border:1px solid #eee; border-radius:999px; padding:7px 10px; color:#71717a; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.12em; text-decoration:none; }
      @media (prefers-color-scheme: dark) {
        body { background:#09090b; color:#fafafa; }
        .top { border-color:#27272a; background:rgba(9,9,11,.88); }
        .back { border-color:#27272a; color:#d4d4d8; }
        .summary, .byline { color:#d4d4d8; }
        .content { color:#e4e4e7; }
        .sources { border-color:#27272a; }
        .sources span, .sources a { border-color:#27272a; color:#d4d4d8; }
      }
    </style>
  </head>
  <body>
    <header class="top">
      <nav class="nav">
        <a href="/" class="brand"><img src="/favicon.svg" alt="" /> Portal Novo Alvo</a>
        <a href="/" class="back">Início</a>
      </nav>
    </header>
    <main>
      <article>
        <div class="meta">
          <span class="cat">${escapeHtml(article.category)}</span>
          <span>${escapeHtml(new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(published)))}</span>
          <span>${escapeHtml(String(article.reading_minutes || 1))} min de leitura</span>
        </div>
        <h1>${escapeHtml(article.title)}</h1>
        <p class="summary">${escapeHtml(article.summary || description)}</p>
        <p class="byline">Por ${escapeHtml(article.author || 'Redação Novo Alvo')}</p>
        ${
          article.cover_url
            ? `<figure><img src="${escapeHtml(article.cover_url)}" alt="${escapeHtml(article.cover_alt || article.title)}" loading="eager" decoding="async" /><figcaption>${escapeHtml(article.cover_alt || article.title)}</figcaption></figure>`
            : ''
        }
        <div class="content">${cleanBody || `<p>${escapeHtml(article.summary || '')}</p>`}</div>
        ${
          sources.length
            ? `<div class="sources"><span>Fontes</span>${sources
                .map((source) => {
                  if (typeof source === 'string') return `<span>${escapeHtml(source)}</span>`;
                  const label = source.name || source.url || 'Fonte';
                  return source.url
                    ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
                    : `<span>${escapeHtml(label)}</span>`;
                })
                .join('')}</div>`
            : ''
        }
      </article>
    </main>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  });
};
