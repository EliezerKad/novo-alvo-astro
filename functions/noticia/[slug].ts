type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      all: <T = unknown>() => Promise<{ results?: T[] }>;
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

const decodeVisibleEntities = (value: string) =>
  String(value || '')
    .replace(/&amp;#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&amp;apos;|&apos;/gi, "'")
    .replace(/&amp;quot;|&quot;/gi, '"');

const stripEditorChrome = (html: string) =>
  decodeVisibleEntities(String(html || ''))
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

const fallbackToAssets = async (request: Request, env: Env) => {
  if (!env.ASSETS) return new Response('Not found', { status: 404 });

  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404) return response;

  const url = new URL(request.url);
  const candidates = new Set<string>();
  candidates.add(url.pathname.endsWith('/') ? `${url.pathname}index.html` : `${url.pathname}/index.html`);
  candidates.add(url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : `${url.pathname}/`);

  for (const pathname of candidates) {
    const candidateUrl = new URL(url.href);
    candidateUrl.pathname = pathname;
    const candidate = await env.ASSETS.fetch(new Request(candidateUrl, request));
    if (candidate.status !== 404) return candidate;
  }

  return response;
};

const formatPublished = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(date);
  } catch {
    return date.toISOString();
  }
};

export const onRequestGet = async ({ request, env, params }: { request: Request; env: Env; params: { slug: string } }) => {
  const staticPage = await fallbackToAssets(request, env);
  if (staticPage.status !== 404) return staticPage;

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
  let related: Partial<CmsArticle>[] = [];
  try {
    const relatedResult = await db
      .prepare(
        `SELECT id, slug, title, summary, category, cover_url, cover_alt, published_at, scheduled_at, updated_at
         FROM articles
         WHERE slug != ?
           AND category = ?
           AND (status = 'published' OR (status = 'scheduled' AND scheduled_at <= ?))
         ORDER BY COALESCE(NULLIF(published_at, ''), scheduled_at, updated_at) DESC
         LIMIT 8`,
      )
      .bind(slug, article.category, now)
      .all<Partial<CmsArticle>>();

    related = relatedResult.results || [];
  } catch {
    related = [];
  }
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

  const relatedHtml = related.length
    ? `<section class="related" aria-label="Matérias relacionadas">
        <div class="related-head">
          <span></span>
          <h2>Relacionadas</h2>
        </div>
        <div class="related-track">
          ${related
            .map((item) => {
              const itemUrl = `/noticia/${encodeURIComponent(item.slug || '')}/`;
              const itemImage = item.cover_url || `${url.origin}/og-default.svg`;
              return `<a class="related-card" href="${itemUrl}">
                <img src="${escapeHtml(itemImage)}" alt="${escapeHtml(item.cover_alt || item.title)}" loading="lazy" onerror="this.onerror=null;this.src='/og-default.svg';" />
                <div>
                  <span>${escapeHtml(item.category || article.category)}</span>
                  <h3>${escapeHtml(item.title)}</h3>
                  <p>${escapeHtml(item.summary || '')}</p>
                </div>
              </a>`;
            })
            .join('')}
        </div>
      </section>`
    : '';

  const sourcesHtml = sources.length
    ? `<div class="sources"><span>Fontes</span>${sources
        .map((source) => {
          if (typeof source === 'string') return `<span>${escapeHtml(source)}</span>`;
          const label = source.name || source.url || 'Fonte';
          return source.url
            ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
            : `<span>${escapeHtml(label)}</span>`;
        })
        .join('')}</div>`
    : '';

  const coverHtml = article.cover_url
    ? `<figure class="hero-figure">
        <div>
          <img src="${escapeHtml(article.cover_url)}" alt="${escapeHtml(article.cover_alt || article.title)}" loading="eager" decoding="async" onerror="this.onerror=null;this.src='/og-default.svg';" />
        </div>
        <figcaption>${escapeHtml(article.cover_alt || article.title)}</figcaption>
      </figure>`
    : '';

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
      :root { color-scheme: light dark; --red:#dc2626; --ink:#09090b; --muted:#71717a; --line:#e4e4e7; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:Inter,system-ui,sans-serif; background:#fff; color:var(--ink); }
      .article-page { min-height:100vh; padding-bottom:7rem; background:linear-gradient(180deg,#fff 0%,#fff 62%,#fafafa 100%); }
      .topbar { position:sticky; top:0; z-index:40; border-bottom:1px solid var(--line); background:rgba(255,255,255,.9); backdrop-filter:blur(20px); }
      .topbar-inner { max-width:1180px; margin:auto; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
      .brand { display:flex; align-items:center; gap:12px; color:inherit; text-decoration:none; font-weight:900; letter-spacing:.16em; text-transform:uppercase; }
      .brand img { width:36px; height:36px; }
      .top-actions { display:flex; align-items:center; gap:8px; }
      .pill-link { border:1px solid var(--line); border-radius:14px; padding:11px 14px; text-decoration:none; color:#52525b; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.14em; transition:.25s ease; }
      .pill-link:hover { border-color:var(--red); color:var(--red); }
      .crumbs { max-width:1180px; margin:0 auto; padding:26px 20px 0; display:flex; gap:10px; align-items:center; color:#a1a1aa; font-size:10px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; }
      .crumbs a { color:#71717a; text-decoration:none; }
      main { max-width:1180px; margin:auto; padding:34px 20px 96px; }
      .meta { display:flex; flex-wrap:wrap; gap:14px; align-items:center; color:#a1a1aa; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.18em; }
      .cat { background:var(--red); color:white; border-radius:10px; padding:8px 12px; }
      h1 { margin:34px 0 24px; max-width:1040px; font-family:"Playfair Display",Georgia,serif; font-size:clamp(3rem,8vw,6.7rem); line-height:.96; letter-spacing:-.055em; }
      .summary { max-width:900px; color:#52525b; font-size:clamp(1.35rem,3.2vw,2.05rem); line-height:1.28; font-style:italic; }
      .byline { margin-top:24px; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.16em; color:#3f3f46; }
      .hero-figure { margin:56px 0 76px; }
      .hero-figure div { overflow:hidden; border-radius:42px; background:#f4f4f5; box-shadow:0 24px 80px rgba(15,23,42,.16); aspect-ratio:21/9; }
      .hero-figure img { display:block; width:100%; height:100%; object-fit:cover; }
      figcaption { margin-top:14px; text-align:center; color:#71717a; font-size:12px; font-style:italic; }
      .content { max-width:780px; margin:0 auto; font-family:Georgia,serif; font-size:1.28rem; line-height:1.85; overflow-wrap:anywhere; }
      .content p { margin:0 0 2rem; }
      .content h2 { margin:4rem 0 1.5rem; padding-left:1rem; border-left:4px solid var(--red); font-family:"Playfair Display",Georgia,serif; font-size:2.4rem; line-height:1.05; font-style:italic; }
      .content h3 { margin:3rem 0 1rem; font-family:"Playfair Display",Georgia,serif; font-size:1.75rem; }
      .content img { max-width:100%; border-radius:28px; }
      .content figure { margin:3rem 0; }
      .content a { color:var(--red); font-weight:700; }
      .share { max-width:780px; margin:44px auto 0; padding-top:28px; border-top:1px solid var(--line); display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:18px; }
      .share-label { color:#a1a1aa; font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:.22em; }
      .share-links { display:flex; gap:10px; }
      .share-links a { width:44px; height:44px; display:grid; place-items:center; border-radius:14px; background:#f4f4f5; color:#18181b; text-decoration:none; font-weight:900; transition:.25s ease; }
      .share-links a:hover { background:var(--red); color:white; transform:translateY(-2px); }
      .sources { max-width:780px; margin:48px auto 0; padding-top:24px; border-top:1px solid var(--line); display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .sources span, .sources a { border:1px solid var(--line); border-radius:999px; padding:7px 10px; color:#71717a; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.12em; text-decoration:none; }
      .ad-slot { max-width:780px; min-height:96px; margin:54px auto; border:1px dashed var(--line); border-radius:32px; display:grid; place-items:center; color:#d4d4d8; font-size:8px; font-weight:900; letter-spacing:.35em; text-transform:uppercase; background:#fafafa; }
      .related { margin:72px auto 0; max-width:980px; }
      .related-head { display:flex; align-items:center; gap:14px; border-bottom:2px solid var(--red); padding-bottom:14px; }
      .related-head span { width:22px; height:22px; border-radius:999px; background:var(--red); box-shadow:0 0 34px rgba(220,38,38,.35); }
      .related-head h2 { margin:0; font-family:Inter,system-ui,sans-serif; font-size:12px; line-height:1; letter-spacing:.22em; text-transform:uppercase; font-style:italic; }
      .related-track { margin-top:28px; display:grid; grid-auto-flow:column; grid-auto-columns:minmax(260px,1fr); gap:18px; overflow-x:auto; scroll-snap-type:x mandatory; padding:4px 2px 18px; }
      .related-card { min-width:0; scroll-snap-align:start; overflow:hidden; border:1px solid var(--line); border-radius:28px; background:#fff; color:inherit; text-decoration:none; box-shadow:0 24px 70px rgba(15,23,42,.08); transition:.35s ease; }
      .related-card:hover { transform:translateY(-3px); box-shadow:0 28px 90px rgba(220,38,38,.12); }
      .related-card img { width:100%; height:160px; object-fit:cover; display:block; transition:.6s ease; }
      .related-card:hover img { transform:scale(1.045); }
      .related-card div { padding:18px; }
      .related-card span { color:var(--red); font-size:9px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; }
      .related-card h3 { margin:10px 0 8px; font-family:"Playfair Display",Georgia,serif; font-size:1.55rem; line-height:1; letter-spacing:-.04em; font-style:italic; }
      .related-card p { margin:0; color:#71717a; font-size:.88rem; line-height:1.55; }
      .home-bottom { margin:54px auto 0; width:56px; height:56px; border-radius:22px; background:#18181b; color:white; display:grid; place-items:center; text-decoration:none; box-shadow:0 18px 48px rgba(15,23,42,.24); transition:.3s ease; }
      .home-bottom:hover { background:var(--red); transform:translateY(-2px); }
      footer { border-top:1px solid var(--line); padding:34px 20px; text-align:center; color:#a1a1aa; font-size:10px; font-weight:900; letter-spacing:.18em; text-transform:uppercase; }
      @media (max-width:720px) {
        .topbar-inner { padding:12px 16px; }
        .brand { letter-spacing:.08em; font-size:.86rem; }
        .brand img { width:30px; height:30px; }
        .pill-link { padding:9px 11px; font-size:9px; }
        main { padding:28px 18px 78px; }
        h1 { font-size:clamp(2.8rem,15vw,4.7rem); }
        .hero-figure { margin:36px 0; }
        .hero-figure div { border-radius:30px; aspect-ratio:4/3; }
        .content { font-size:1.14rem; line-height:1.78; }
        .related-track { grid-auto-columns:82%; }
      }
      @media (prefers-color-scheme:dark) {
        :root { --line:#27272a; }
        body, .article-page { background:#09090b; color:#fafafa; }
        .topbar { background:rgba(9,9,11,.88); }
        .pill-link { color:#d4d4d8; }
        .summary, .byline { color:#d4d4d8; }
        .content { color:#e4e4e7; }
        .share-links a, .ad-slot { background:#18181b; color:#e4e4e7; }
        .related-card { background:#09090b; }
        .related-card p { color:#a1a1aa; }
      }
    </style>
  </head>
  <body>
    <div class="article-page">
      <header class="topbar">
        <nav class="topbar-inner">
          <a href="/" class="brand"><img src="/favicon.svg" alt="" /> Portal Novo Alvo</a>
          <div class="top-actions">
            <a href="/buscar/" class="pill-link">Buscar</a>
            <a href="/" class="pill-link">Início</a>
          </div>
        </nav>
      </header>
      <div class="crumbs">
        <a href="/">Início</a>
        <span>/</span>
        <span>${escapeHtml(article.category)}</span>
      </div>
      <main>
        <article>
          <div class="meta">
            <span class="cat">${escapeHtml(article.category)}</span>
            <span>${escapeHtml(formatPublished(published))}</span>
            <span>${escapeHtml(String(article.reading_minutes || 1))} min de leitura</span>
          </div>
          <h1>${escapeHtml(article.title)}</h1>
          <p class="summary">${escapeHtml(article.summary || description)}</p>
          <p class="byline">Por ${escapeHtml(article.author || 'Redação Novo Alvo')}</p>
          ${coverHtml}
          <div class="content">${cleanBody || `<p>${escapeHtml(article.summary || '')}</p>`}</div>
          <div class="share">
            <span class="share-label">Compartilhar matéria</span>
            <div class="share-links">
              <a href="https://wa.me/?text=${encodeURIComponent(`${article.title} - ${canonical}`)}" target="_blank" rel="noopener noreferrer" title="WhatsApp">W</a>
              <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(canonical)}" target="_blank" rel="noopener noreferrer" title="X">X</a>
              <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonical)}" target="_blank" rel="noopener noreferrer" title="Facebook">F</a>
            </div>
          </div>
          ${sourcesHtml}
          <div class="ad-slot">Publicidade</div>
          ${relatedHtml}
          <a href="/" class="home-bottom" aria-label="Voltar para a home">⌂</a>
        </article>
      </main>
      <footer>Portal Novo Alvo - Notícias, fatos e impacto</footer>
    </div>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  });
};
