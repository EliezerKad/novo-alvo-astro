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

const normalizeWhyItMatters = (html: string) =>
  String(html || '').replace(
    /<blockquote([^>]*)>\s*(?:<p>\s*)?(?:<strong>\s*)?Por que isso importa\s*[:?]\s*(?:<\/strong>\s*)?([\s\S]*?)(?:\s*<\/p>)?\s*<\/blockquote>/gi,
    (_match, attrs, text) => `<blockquote${attrs}><strong>Por que isso importa?</strong> ${String(text).trim()}</blockquote>`,
  );

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

const formatEditorialDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    })
      .format(date)
      .toUpperCase();
  } catch {
    return date.toISOString();
  }
};

const articleShellAssets = async (request: Request, env: Env) => {
  if (!env.ASSETS) return '';

  const url = new URL(request.url);
  const candidates = [
    '/noticia/gabriel-ganley-influenciador-fitness-morre-aos-22-anos-em-sao-paulo/',
    '/noticia/shakira-burna-boy-dai-dai-clipe-oficial/',
    '/noticia/drake-lanca-tres-albuns-e-agita-disputa-do-streaming/',
  ];

  for (const pathname of candidates) {
    try {
      const templateUrl = new URL(url.href);
      templateUrl.pathname = pathname;
      templateUrl.search = '';
      const response = await env.ASSETS.fetch(new Request(templateUrl, request));
      if (!response.ok) continue;
      const html = await response.text();
      const links = html.match(/<link rel="stylesheet" href="\/_astro\/[^"]+">/g) || [];
      if (links.length) return links.join('\n');
    } catch {}
  }

  return '';
};

export const onRequestGet = async ({ request, env, params }: { request: Request; env: Env; params: { slug: string } }) => {
  const db = env.EDITORIAL_DB;
  const slug = String(params.slug || '').trim();
  const now = new Date().toISOString();

  if (db && slug) {
    const gate = await db
      .prepare('SELECT status, scheduled_at FROM articles WHERE slug = ? LIMIT 1')
      .bind(slug)
      .first<Pick<CmsArticle, 'status' | 'scheduled_at'>>();
    const isPublic = gate?.status === 'published' || (gate?.status === 'scheduled' && String(gate.scheduled_at || '') <= now);
    if (gate && !isPublic) {
      return new Response('Not found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  }

  if (!db) return fallbackToAssets(request, env);

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

  if (!article) {
    const staticPage = await fallbackToAssets(request, env);
    return staticPage;
  }
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
  const cleanBody = normalizeWhyItMatters(stripEditorChrome(article.body_html));
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
    ? `<div class="mt-8 flex flex-col gap-3 border-t border-black/10 pt-5 dark:border-zinc-800 md:mt-10 md:flex-row md:items-start md:gap-4">
          <span class="shrink-0 text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-600">Fontes:</span>
          <ul class="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-500">${sources
        .map((source) => {
          if (typeof source === 'string') return `<li class="rounded-md border border-black/10 bg-white/45 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900/60">${escapeHtml(source)}</li>`;
          const label = source.name || source.url || 'Fonte';
          return source.url
            ? `<li class="rounded-md border border-black/10 bg-white/45 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900/60"><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></li>`
            : `<li class="rounded-md border border-black/10 bg-white/45 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900/60">${escapeHtml(label)}</li>`;
        })
        .join('')}</ul></div>`
    : '';

  const coverHtml = article.cover_url
    ? `<figure class="mt-8 md:mt-10">
        <div class="min-h-[280px] overflow-hidden rounded-[1.6rem] bg-[#ebe8df] shadow-[0_24px_70px_rgba(16,16,16,0.12)] sm:min-h-[360px] md:min-h-[520px] md:rounded-[2.25rem]">
          <img src="${escapeHtml(article.cover_url)}" alt="${escapeHtml(article.cover_alt || article.title)}" class="h-full min-h-[280px] w-full object-cover sm:min-h-[360px] md:min-h-[520px]" referrerpolicy="no-referrer" loading="eager" decoding="async" fetchpriority="high" onerror="this.onerror=null;this.src='/og-default.svg';" />
        </div>
        <figcaption class="mt-3 break-words px-1 text-xs font-bold leading-5 text-zinc-400">${escapeHtml(article.cover_alt || article.title)}</figcaption>
      </figure>`
    : '';
  const shellAssets = await articleShellAssets(request, env);
  const shareText = encodeURIComponent(`${article.title} - ${canonical}`);
  const encodedTitle = encodeURIComponent(article.title);
  const encodedUrl = encodeURIComponent(canonical);
  const topRelated = related.slice(0, 3);
  const sideRelatedHtml = topRelated.length
    ? `<section class="rounded-[1.45rem] border border-black/10 bg-white p-4 shadow-[0_18px_50px_rgba(16,16,16,0.055)] dark:border-zinc-800 dark:bg-zinc-900 md:rounded-[1.75rem] md:p-5">
        <h2 class="mb-4 text-lg font-black tracking-[-0.045em] text-zinc-950 dark:text-zinc-50">Giro de Noticias</h2>
        <div class="grid">${topRelated
          .map((item) => {
            const itemUrl = `/noticia/${encodeURIComponent(item.slug || '')}/`;
            const itemImage = item.cover_url || `${url.origin}/og-default.svg`;
            return `<a href="${itemUrl}" class="group grid grid-cols-[82px_1fr] gap-3 border-t border-black/10 py-3 first:border-t-0 first:pt-0 last:pb-0 dark:border-zinc-800">
              <div class="h-[62px] w-[82px] overflow-hidden rounded-2xl bg-[#ebe8df] dark:bg-zinc-800">
                <img src="${escapeHtml(itemImage)}" alt="${escapeHtml(item.cover_alt || item.title)}" class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/og-default.svg';" />
              </div>
              <div>
                <h3 class="text-sm font-black leading-snug tracking-[-0.025em] text-zinc-950 transition-colors group-hover:text-[#8A1F2D] dark:text-zinc-50">${escapeHtml(item.title)}</h3>
                <p class="mt-1 text-[11px] font-bold text-zinc-400">${escapeHtml(item.category || article.category)} • <span data-live-view-count="${escapeHtml(item.slug || '')}">0 acessos</span></p>
              </div>
            </a>`;
          })
          .join('')}</div>
      </section>`
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
    ${shellAssets}
    <template data-disabled-legacy-dynamic-style>
      :root { color-scheme: light dark; --red:#8A1F2D; --ink:#101010; --muted:#71717a; --line:rgba(16,16,16,.10); --paper:#f5f3ee; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:Inter,system-ui,sans-serif; background:var(--paper); color:var(--ink); }
      .article-page { min-height:100vh; padding-bottom:5rem; background:var(--paper); color:var(--ink); transition:background .3s ease,color .3s ease; }
      .topbar { position:fixed; inset:0 0 auto; z-index:40; border-bottom:1px solid var(--line); background:rgba(255,255,255,.82); backdrop-filter:blur(20px); }
      .topbar-inner { max-width:1280px; margin:auto; padding:14px 16px; display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:12px; }
      .brand { display:flex; align-items:center; justify-content:center; gap:8px; color:inherit; text-decoration:none; font-family:"Playfair Display",Georgia,serif; font-size:1.7rem; font-weight:900; letter-spacing:-.06em; line-height:1; }
      .brand img { width:34px; height:34px; }
      .top-actions { display:flex; align-items:center; gap:8px; }
      .top-actions:first-child { justify-content:flex-start; }
      .top-actions:last-child { justify-content:flex-end; }
      .pill-link { display:inline-flex; min-height:40px; align-items:center; justify-content:center; border:1px solid var(--line); border-radius:14px; padding:0 14px; text-decoration:none; color:#52525b; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.12em; transition:.25s ease; }
      .pill-link:hover { border-color:var(--red); color:var(--red); background:rgba(138,31,45,.06); }
      .crumbs { max-width:1240px; margin:0 auto; padding:0; display:flex; gap:10px; align-items:center; color:#71717a; font-size:11px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
      .article-page > .crumbs { display:none; }
      .crumbs a { color:#71717a; text-decoration:none; }
      main { max-width:1240px; margin:auto; padding:120px 12px 80px; }
      .meta { margin-top:28px; display:flex; flex-wrap:wrap; gap:8px; align-items:center; color:#71717a; font-size:11px; font-weight:900; }
      .meta span { display:inline-flex; min-height:40px; align-items:center; border:1px solid var(--line); border-radius:999px; background:#fff; padding:0 14px; box-shadow:0 8px 24px rgba(16,16,16,.035); }
      .meta .cat { border-color:transparent; background:rgba(138,31,45,.10); color:var(--red); text-transform:uppercase; letter-spacing:.08em; }
      h1 { margin:34px 0 0; max-width:980px; font-family:Inter,system-ui,sans-serif; font-size:clamp(2.65rem,10.5vw,5.875rem); font-weight:950; line-height:.9; letter-spacing:-.088em; color:#101010; }
      .summary { margin-top:24px; max-width:760px; color:#52525b; font-size:clamp(1.12rem,2.2vw,1.5rem); font-weight:500; line-height:1.5; font-style:normal; }
      .byline { margin-top:24px; display:inline-flex; align-items:center; border:1px solid var(--line); border-radius:1.25rem; background:#fff; padding:12px 16px; color:#18181b; font-size:12px; font-weight:900; box-shadow:0 18px 50px rgba(16,16,16,.055); }
      .hero-figure { margin:38px 0 64px; max-width:900px; }
      .hero-figure div { min-height:280px; overflow:hidden; border-radius:1.6rem; background:#ebe8df; box-shadow:0 24px 70px rgba(16,16,16,.12); aspect-ratio:16/9; }
      .hero-figure img { display:block; width:100%; height:100%; object-fit:cover; }
      figcaption { margin-top:12px; color:#71717a; font-size:12px; font-weight:800; line-height:1.5; }
      .content { max-width:760px; font-family:Inter,system-ui,sans-serif; overflow-wrap:anywhere; }
      .content p { margin:0 0 1.55rem; color:#292927; font-size:clamp(1.05rem,1.35vw,1.2rem); font-weight:400; line-height:1.82; letter-spacing:-.01em; }
      .content h2 { margin:2.75rem 0 1rem; color:#101010; font-family:Inter,system-ui,sans-serif; font-size:clamp(1.32rem,2.4vw,1.72rem); font-weight:950; line-height:1.08; letter-spacing:-.055em; }
      .content h3 { margin:2.15rem 0 .85rem; color:#101010; font-family:Inter,system-ui,sans-serif; font-size:clamp(1.12rem,1.9vw,1.36rem); font-weight:900; line-height:1.16; letter-spacing:-.04em; }
      .content img { max-width:100%; border-radius:28px; }
      .content figure { margin:3rem 0; }
      .content a { color:var(--red); font-weight:700; }
      .content blockquote { margin:3rem 0 0; border-left:4px solid var(--red); border-radius:0 1.25rem 1.25rem 0; background:rgba(138,31,45,.08); padding:1.15rem 1.25rem; color:#18181b; font-family:Inter,system-ui,sans-serif; font-size:clamp(1.06rem,1.75vw,1.28rem); font-weight:400; line-height:1.45; letter-spacing:-.025em; }
      .content blockquote strong:first-child { font-weight:900; }
      .content blockquote p { margin:0; color:inherit; font-size:inherit; font-weight:400; line-height:inherit; }
      .share { max-width:760px; margin:44px 0 0; padding-top:28px; border-top:1px solid var(--line); display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:18px; }
      .share-label { color:#a1a1aa; font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:.22em; }
      .share-links { display:flex; gap:10px; }
      .share-links a { width:44px; height:44px; display:grid; place-items:center; border-radius:14px; background:#f4f4f5; color:#18181b; text-decoration:none; font-weight:900; transition:.25s ease; }
      .share-links a:hover { background:var(--red); color:white; transform:translateY(-2px); }
      .sources { max-width:760px; margin:48px 0 0; padding-top:24px; border-top:1px solid var(--line); display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .sources span, .sources a { border:1px solid var(--line); border-radius:8px; background:rgba(255,255,255,.45); padding:7px 10px; color:#71717a; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.12em; text-decoration:none; }
      .ad-slot { max-width:728px; min-height:90px; margin:54px 0; border:1px dashed var(--line); border-radius:1.5rem; display:grid; place-items:center; color:#d4d4d8; font-size:8px; font-weight:900; letter-spacing:.35em; text-transform:uppercase; background:#fafafa; }
      .related { margin:72px 0 0; max-width:980px; }
      .related-head { display:flex; align-items:center; gap:14px; border-bottom:1px solid var(--line); padding-bottom:14px; }
      .related-head span { width:22px; height:22px; border-radius:999px; background:var(--red); box-shadow:0 0 34px rgba(220,38,38,.35); }
      .related-head h2 { margin:0; font-family:Inter,system-ui,sans-serif; font-size:12px; line-height:1; letter-spacing:.22em; text-transform:uppercase; }
      .related-track { margin-top:28px; display:grid; grid-auto-flow:column; grid-auto-columns:minmax(260px,1fr); gap:18px; overflow-x:auto; scroll-snap-type:x mandatory; padding:4px 2px 18px; }
      .related-card { min-width:0; scroll-snap-align:start; overflow:hidden; border:1px solid var(--line); border-radius:28px; background:#fff; color:inherit; text-decoration:none; box-shadow:0 24px 70px rgba(15,23,42,.08); transition:.35s ease; }
      .related-card:hover { transform:translateY(-3px); box-shadow:0 28px 90px rgba(220,38,38,.12); }
      .related-card img { width:100%; height:160px; object-fit:cover; display:block; transition:.6s ease; }
      .related-card:hover img { transform:scale(1.045); }
      .related-card div { padding:18px; }
      .related-card span { color:var(--red); font-size:9px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; }
      .related-card h3 { margin:10px 0 8px; font-family:"Playfair Display",Georgia,serif; font-size:1.55rem; line-height:1; letter-spacing:-.04em; font-style:italic; }
      .related-card p { margin:0; color:#71717a; font-size:.88rem; line-height:1.55; }
      .home-bottom { margin:54px 0 0; width:56px; height:56px; border-radius:22px; background:#18181b; color:white; display:grid; place-items:center; text-decoration:none; box-shadow:0 18px 48px rgba(15,23,42,.24); transition:.3s ease; }
      .home-bottom:hover { background:var(--red); transform:translateY(-2px); }
      footer { border-top:1px solid var(--line); padding:34px 20px; color:#a1a1aa; font-size:10px; font-weight:900; letter-spacing:.18em; text-transform:uppercase; }
      @media (max-width:720px) {
        .topbar-inner { padding:12px 16px; grid-template-columns:auto 1fr auto; }
        .brand { font-size:1.25rem; }
        .brand img { width:30px; height:30px; }
        .pill-link { min-height:36px; padding:0 11px; font-size:9px; }
        main { padding:96px 18px 78px; }
        h1 { font-size:clamp(2.8rem,14vw,4.7rem); }
        .hero-figure { margin:36px 0; }
        .hero-figure div { border-radius:1.35rem; aspect-ratio:4/3; }
        .related-track { grid-auto-columns:82%; }
      }
      @media (prefers-color-scheme:dark) {
        :root { --line:#27272a; }
        body, .article-page { background:linear-gradient(180deg,#080809 0%,#141416 50%,#080809 100%); color:#fafafa; }
        .topbar { background:rgba(9,9,11,.82); }
        .pill-link { color:#d4d4d8; }
        h1, .content h2, .content h3 { color:#fafafa; }
        .summary { color:#a1a1aa; }
        .byline, .meta span { border-color:#27272a; background:#18181b; color:#e4e4e7; }
        .content p { color:#d4d4d8; }
        .content blockquote { background:rgba(138,31,45,.18); color:#f4f4f5; }
        .share-links a, .ad-slot { background:#18181b; color:#e4e4e7; }
        .sources span, .sources a { border-color:#27272a; background:rgba(24,24,27,.60); }
        .related-card { background:#09090b; }
        .related-card p { color:#a1a1aa; }
      }
    </template>
  </head>
  <body>
    <article class="min-h-screen bg-[#f5f3ee] pb-20 text-[#101010] transition-colors duration-300 dark:bg-[linear-gradient(180deg,#080809_0%,#141416_50%,#080809_100%)] dark:text-zinc-50">
      <nav class="fixed top-0 inset-x-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl z-50 border-b border-zinc-100 dark:border-zinc-800 py-4 lg:py-6">
        <div class="max-w-7xl mx-auto px-4 flex justify-between items-center">
          <a href="/" class="group flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
            <div class="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all">
              <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>
            </div>
            <span class="hidden md:block font-black uppercase tracking-widest text-[10px]">Voltar</span>
          </a>
          <a href="/" class="group flex items-center gap-2 text-zinc-900 dark:text-zinc-50" aria-label="Portal Novo Alvo">
            <img src="/favicon.svg" alt="" class="h-8 w-8 md:h-9 md:w-9" />
            <span class="text-2xl font-serif font-black tracking-tighter leading-none transition-colors group-hover:text-[#501620] md:text-[1.7rem]">NOVO ALVO</span>
          </a>
          <div class="flex items-center gap-2">
            <a href="https://wa.me/?text=${shareText}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-zinc-100 dark:bg-zinc-800 hover:bg-red-600 hover:text-white dark:text-zinc-400" title="Compartilhar">↗</a>
          </div>
        </div>
      </nav>
      <div class="pt-20 lg:pt-32"></div>
      <header class="mx-auto max-w-[1240px] px-3 pb-10 pt-6 sm:px-4 md:pb-16 md:pt-12">
        <nav aria-label="Breadcrumb" class="mb-6 flex flex-wrap items-center gap-2 text-[11px] font-extrabold text-zinc-500 dark:text-zinc-500 md:mb-8 md:text-xs">
          <a href="/" class="transition-colors hover:text-[#8A1F2D]">Inicio</a><span class="text-zinc-400">/</span><a href="/?category=${encodeURIComponent(article.category)}" class="transition-colors hover:text-[#8A1F2D]">${escapeHtml(article.category)}</a><span class="text-zinc-400">/</span><span class="font-black text-[#8A1F2D]">${escapeHtml(article.title)}</span>
        </nav>
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-11">
          <div>
            <span class="mb-4 inline-flex h-8 items-center rounded-full bg-[#8A1F2D]/10 px-3.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#8A1F2D] md:mb-5 md:h-9 md:px-4 md:text-xs">${escapeHtml(article.category)}</span>
            <h1 class="max-w-5xl text-[clamp(2.65rem,15vw,5.875rem)] font-sans font-black leading-[0.9] tracking-[-0.088em] text-[#101010] dark:text-zinc-50 sm:text-[clamp(3.35rem,11vw,5.875rem)]">${escapeHtml(article.title)}</h1>
            <p class="mt-5 max-w-3xl text-lg font-medium leading-7 text-zinc-600 dark:text-zinc-400 md:mt-6 md:text-2xl md:leading-9">${escapeHtml(article.summary || description)}</p>
            <div class="mt-6 flex flex-wrap gap-2 md:mt-8">
              <span class="inline-flex min-h-9 items-center rounded-full border border-black/10 bg-white px-3.5 text-[11px] font-extrabold text-zinc-600 shadow-[0_8px_24px_rgba(16,16,16,0.035)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 md:min-h-10 md:px-4 md:text-xs"><strong class="mr-1 text-zinc-950 dark:text-zinc-50">${escapeHtml(formatEditorialDate(published))}</strong></span>
              <span data-live-view-count="${escapeHtml(article.slug)}" class="inline-flex min-h-9 items-center rounded-full border border-black/10 bg-white px-3.5 text-[11px] font-extrabold text-zinc-600 shadow-[0_8px_24px_rgba(16,16,16,0.035)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 md:min-h-10 md:px-4 md:text-xs">0 acessos</span>
              <span class="inline-flex min-h-9 items-center rounded-full border border-black/10 bg-white px-3.5 text-[11px] font-extrabold text-zinc-600 shadow-[0_8px_24px_rgba(16,16,16,0.035)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 md:min-h-10 md:px-4 md:text-xs">${escapeHtml(String(article.reading_minutes || 1))} min de leitura</span>
            </div>
            <div class="mt-6 inline-flex items-center gap-3 rounded-[1.25rem] border border-black/10 bg-white p-2.5 pr-4 shadow-[0_18px_50px_rgba(16,16,16,0.055)] dark:border-zinc-800 dark:bg-zinc-900 md:mt-8 md:rounded-[1.375rem] md:p-3 md:pr-5">
              <div class="grid h-11 w-11 place-items-center rounded-xl bg-[#8A1F2D] text-xs font-black text-white md:h-12 md:w-12 md:rounded-2xl md:text-sm">NA</div>
              <div><div class="text-sm font-black text-zinc-950 dark:text-zinc-50">Por ${escapeHtml(article.author || 'Redacao Novo Alvo')}</div><div class="mt-0.5 text-xs font-bold text-zinc-400">Fatos e Impacto 24h</div></div>
            </div>
            ${coverHtml}
          </div>
          <aside class="lg:self-stretch">
            <div class="grid h-full content-start gap-4 md:grid-cols-2 lg:grid-cols-1 lg:gap-5">
              <section class="rounded-[1.45rem] border border-black/10 bg-white p-4 shadow-[0_18px_50px_rgba(16,16,16,0.055)] dark:border-zinc-800 dark:bg-zinc-900 md:rounded-[1.75rem] md:p-5">
                <h2 class="mb-3 text-base font-black tracking-[-0.045em] text-zinc-950 dark:text-zinc-50 md:mb-4 md:text-lg">Compartilhe</h2>
                <div class="grid gap-2">
                  <a href="https://wa.me/?text=${shareText}" target="_blank" rel="noopener noreferrer" class="flex h-10 items-center justify-between rounded-full bg-[#8A1F2D] px-4 text-[11px] font-black text-white transition-transform hover:-translate-y-0.5 md:h-11 md:text-xs">WhatsApp <span>→</span></a>
                  <a href="https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}" target="_blank" rel="noopener noreferrer" class="flex h-10 items-center justify-between rounded-full border border-black/10 bg-[#f5f3ee] px-4 text-[11px] font-black text-zinc-600 transition-all hover:border-[#8A1F2D]/30 hover:text-[#8A1F2D] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 md:h-11 md:text-xs">X / Twitter <span>→</span></a>
                  <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer" class="flex h-10 items-center justify-between rounded-full border border-black/10 bg-[#f5f3ee] px-4 text-[11px] font-black text-zinc-600 transition-all hover:border-[#8A1F2D]/30 hover:text-[#8A1F2D] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 md:h-11 md:text-xs">Facebook <span>→</span></a>
                </div>
              </section>
              <div class="lg:sticky lg:top-28 lg:self-start"><div class="overflow-hidden relative flex flex-col items-center justify-center min-h-[260px] rounded-[1.75rem]"><div class="absolute top-1 left-2 z-10 pointer-events-none"><span class="text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Publicidade</span></div></div></div>
            </div>
          </aside>
        </div>
      </header>
      <section class="mx-auto max-w-[1240px] px-3 pb-14 sm:px-4 md:pb-16">
        <div class="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,760px)_340px] lg:gap-14">
          <div>
            <div class="prose prose-zinc max-w-none prose-p:mb-6 prose-p:text-[1.08rem] prose-p:font-normal prose-p:leading-[1.78] prose-p:tracking-[-0.01em] prose-p:text-[#292927] md:prose-p:mb-7 md:prose-p:text-xl md:prose-p:leading-[1.82] prose-headings:font-sans prose-headings:font-black prose-headings:tracking-[-0.065em] prose-headings:text-zinc-950 prose-h2:mb-4 prose-h2:mt-11 prose-h2:text-3xl prose-h2:leading-none md:prose-h2:mb-5 md:prose-h2:mt-14 md:prose-h2:text-4xl prose-h3:mb-3 prose-h3:mt-8 prose-h3:text-2xl md:prose-h3:mb-4 md:prose-h3:mt-10 prose-strong:text-zinc-950 prose-strong:font-black prose-ul:mb-8 prose-ul:list-disc prose-ul:pl-6 prose-li:mb-2 prose-li:text-lg prose-li:leading-8 prose-a:text-[#8A1F2D] prose-a:font-bold prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-[4px] prose-blockquote:border-[#8A1F2D] prose-blockquote:pl-5 prose-blockquote:text-2xl prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:leading-tight prose-blockquote:tracking-[-0.035em] md:prose-blockquote:border-l-[5px] md:prose-blockquote:pl-7 md:prose-blockquote:text-3xl dark:prose-invert dark:prose-p:text-zinc-300 dark:prose-headings:text-zinc-50 article-content overflow-hidden break-words [word-break:break-word] [overflow-wrap:break-word]">${cleanBody || `<p>${escapeHtml(article.summary || '')}</p>`}</div>
            ${sourcesHtml}
            <div class="mt-12 flex justify-center border-t border-black/10 pt-8 dark:border-zinc-800"><div class="overflow-hidden relative flex flex-col items-center justify-center h-[90px] w-full max-w-[728px]"><div class="absolute top-1 left-2 z-10 pointer-events-none"><span class="text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Publicidade</span></div></div></div>
          </div>
          <aside class="grid h-fit gap-5 lg:sticky lg:top-28 lg:self-start">${sideRelatedHtml}</aside>
        </div>
      </section>
    </article>
    <div class="article-page" style="display:none">
      <header class="topbar">
        <nav class="topbar-inner">
          <div class="top-actions"><a href="/" class="pill-link">Voltar</a></div>
          <a href="/" class="brand"><img src="/favicon.svg" alt="" /> NOVO ALVO</a>
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
          <div class="crumbs">
            <a href="/">Inicio</a>
            <span>/</span>
            <span>${escapeHtml(article.category)}</span>
          </div>
          <div class="meta">
            <span class="cat">${escapeHtml(article.category)}</span>
            <span>${escapeHtml(formatPublished(published))}</span>
            <span data-live-view-count="${escapeHtml(article.slug)}">0 acessos</span>
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
    <script>
      (() => {
        const nodes = Array.from(document.querySelectorAll('[data-live-view-count]'));
        const slugs = [...new Set(nodes.map((node) => node.getAttribute('data-live-view-count')).filter(Boolean))];
        if (!slugs.length) return;
        fetch('/api/public/views?slugs=' + encodeURIComponent(slugs.join(',')))
          .then((response) => response.ok ? response.json() : { views: {} })
          .then((data) => {
            const views = data && typeof data.views === 'object' ? data.views : {};
            nodes.forEach((node) => {
              const slug = node.getAttribute('data-live-view-count');
              const value = Number(views[slug] || 0);
              node.textContent = value + ' acessos';
            });
          })
          .catch(() => {});
      })();
    </script>
    <script>
      (() => {
        try {
          const key = 'novo-alvo-visitor-id';
          const existing = localStorage.getItem(key);
          const visitorId = existing || (crypto.randomUUID ? crypto.randomUUID() : 'fallback-' + Date.now() + '-' + Math.random());
          if (!existing) localStorage.setItem(key, visitorId);
          window.setTimeout(() => {
            fetch('/api/visits', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ visitorId, path: window.location.pathname }),
            }).catch(() => {});
          }, 1500);
        } catch {}
      })();
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  });
};
