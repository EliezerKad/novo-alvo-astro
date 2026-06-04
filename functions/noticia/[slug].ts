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

const CANONICAL_ORIGIN = 'https://portalnovoalvo.com.br';

const escapeHtml = (value: unknown) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const categoryLabels: Record<string, string> = {
  Politica: 'Política',
  Saude: 'Saúde',
  Ciencia: 'Ciência',
  Educacao: 'Educação',
  Musica: 'Música',
  Ocorrencias: 'Ocorrências',
};

const displayCategory = (category?: string) => {
  const cleanCategory = String(category || '').replace(/\u0000/g, '').trim().slice(0, 80);
  return categoryLabels[cleanCategory] || cleanCategory;
};

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

const themeBootScript = `<script>
      try {
        const stored = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', stored === 'dark' || (!stored && prefersDark));
      } catch {}
    </script>`;

const themeToggleButton = `<button
              type="button"
              class="w-10 h-10 shrink-0 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-sm hover:bg-[#8A1F2D] hover:border-[#8A1F2D] hover:text-white dark:hover:text-white transition-all text-zinc-700 dark:text-zinc-200"
              title="Modo Escuro"
              aria-label="Ativar modo escuro"
              data-theme-toggle
            >
              <svg class="w-4 h-4 dark:hidden" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>
              </svg>
              <svg class="hidden w-4 h-4 dark:block" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
              </svg>
            </button>`;

const themeToggleScript = `<script>
      (() => {
        const applyTheme = (theme) => {
          document.documentElement.classList.toggle('dark', theme === 'dark');
          document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
            button.title = theme === 'dark' ? 'Modo Claro' : 'Modo Escuro';
            button.setAttribute('aria-label', theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
          });
        };
        document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
          button.addEventListener('click', () => {
            const nextTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            try { localStorage.setItem('theme', nextTheme); } catch {}
            applyTheme(nextTheme);
          });
        });
        applyTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      })();
    </script>`;

const dynamicArticleStyle = `<style>
      .article-content .audio-card {
        margin: 2.75rem 0;
        border-left: 4px solid #8A1F2D;
        border-radius: 0 1.35rem 1.35rem 0;
        background: rgba(138, 31, 45, 0.055);
        padding: 1.2rem 1.25rem;
      }
      .article-content .audio-card p {
        margin: 0 0 0.85rem;
      }
      .article-content .audio-card audio {
        display: block;
        width: 100%;
      }
      .article-content .audio-card figcaption {
        margin: 0.85rem 0 0;
        color: #71717a;
        font-size: 0.92rem;
        font-weight: 700;
        line-height: 1.55;
      }
      .dark .article-content .audio-card {
        background: rgba(138, 31, 45, 0.18);
      }
      .dark .article-content .audio-card figcaption {
        color: rgb(161 161 170);
      }
    </style>`;

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

const parseSources = (value: string): Array<{ name?: string; publisher?: string; title?: string; url?: string; sourceUrl?: string; note?: string } | string> => {
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
  let mostReadNow: Array<Partial<CmsArticle> & { views?: number }> = [];
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const mostReadResult = await db
      .prepare(
        `SELECT a.id, a.slug, a.title, a.summary, a.category, a.cover_url, a.cover_alt,
                a.published_at, a.scheduled_at, a.updated_at, COUNT(e.event_key) AS views
           FROM article_view_events e
           INNER JOIN articles a ON a.slug = e.slug
          WHERE e.viewed_at >= ?
            AND a.slug != ?
            AND (a.status = 'published' OR (a.status = 'scheduled' AND a.scheduled_at <= ?))
          GROUP BY a.id, a.slug, a.title, a.summary, a.category, a.cover_url, a.cover_alt, a.published_at, a.scheduled_at, a.updated_at
          ORDER BY views DESC, COALESCE(NULLIF(a.published_at, ''), a.scheduled_at, a.updated_at) DESC
          LIMIT 4`,
      )
      .bind(dayAgo, slug, now)
      .all<Partial<CmsArticle> & { views?: number }>();

    mostReadNow = mostReadResult.results || [];
  } catch {
    mostReadNow = [];
  }

  if (mostReadNow.length < 4) {
    try {
      const fallbackMostRead = await db
        .prepare(
          `SELECT a.id, a.slug, a.title, a.summary, a.category, a.cover_url, a.cover_alt,
                  a.published_at, a.scheduled_at, a.updated_at, COALESCE(v.total_views, 0) AS views
             FROM articles a
             LEFT JOIN article_views v ON v.slug = a.slug
            WHERE a.slug != ?
              AND (a.status = 'published' OR (a.status = 'scheduled' AND a.scheduled_at <= ?))
            ORDER BY COALESCE(v.total_views, 0) DESC, COALESCE(NULLIF(a.published_at, ''), a.scheduled_at, a.updated_at) DESC
            LIMIT 8`,
        )
        .bind(slug, now)
        .all<Partial<CmsArticle> & { views?: number }>();

      const seenMost = new Set(mostReadNow.map((item) => item.slug).filter(Boolean));
      mostReadNow = [
        ...mostReadNow,
        ...((fallbackMostRead.results || []).filter((item) => item.slug && !seenMost.has(item.slug)).slice(0, 4 - mostReadNow.length)),
      ];
    } catch {}
  }
  const canonical = `${CANONICAL_ORIGIN}/noticia/${encodeURIComponent(article.slug)}/`;
  const published = article.published_at || article.scheduled_at || article.created_at || article.updated_at;
  const modified = article.updated_at || published;
  const description = article.seo_description || article.summary || `Leia ${article.title} no Portal Novo Alvo.`;
  const image = article.cover_url || `${CANONICAL_ORIGIN}/og-default.svg`;
  const sources = parseSources(article.sources);
  const cleanBody = normalizeEditorialQuoteFlow(normalizeWhyItMatters(stripEditorChrome(article.body_html)));
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
      logo: { '@type': 'ImageObject', url: `${CANONICAL_ORIGIN}/og-default.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    articleSection: article.category,
    keywords: article.keywords,
    isAccessibleForFree: true,
    inLanguage: 'pt-BR',
  };

  const sourcesHtml = sources.length
    ? `<div class="mt-8 flex flex-col gap-3 border-t border-black/10 pt-5 dark:border-zinc-800 md:mt-10 md:flex-row md:items-start md:gap-4">
          <span class="shrink-0 text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-600">Fontes:</span>
          <ul class="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-500">${sources
        .map((source) => {
          if (typeof source === 'string') return `<li class="rounded-md border border-black/10 bg-white/45 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900/60">${escapeHtml(source)}</li>`;
          const label = source.name || source.publisher || source.title || source.url || source.sourceUrl || 'Fonte';
          const url = source.url || source.sourceUrl || '';
          return url
            ? `<li class="rounded-md border border-black/10 bg-white/45 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900/60"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></li>`
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
            const itemImage = item.cover_url || `${CANONICAL_ORIGIN}/og-default.svg`;
            return `<a href="${itemUrl}" class="group grid grid-cols-[82px_1fr] gap-3 border-t border-black/10 py-3 first:border-t-0 first:pt-0 last:pb-0 dark:border-zinc-800">
              <div class="h-[62px] w-[82px] overflow-hidden rounded-2xl bg-[#ebe8df] dark:bg-zinc-800">
                <img src="${escapeHtml(itemImage)}" alt="${escapeHtml(item.cover_alt || item.title)}" class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/og-default.svg';" />
              </div>
              <div>
                <h3 class="text-sm font-black leading-snug tracking-[-0.025em] text-zinc-950 transition-colors group-hover:text-[#8A1F2D] dark:text-zinc-50">${escapeHtml(item.title)}</h3>
                <p class="mt-1 text-[11px] font-bold text-zinc-400">${escapeHtml(displayCategory(item.category || article.category))} • <span data-live-view-count="${escapeHtml(item.slug || '')}">0 views</span></p>
              </div>
            </a>`;
          })
          .join('')}</div>
      </section>`
    : '';
  const recommendationCard = (item: Partial<CmsArticle> & { views?: number }) => {
    const itemUrl = `/noticia/${encodeURIComponent(item.slug || '')}/`;
    const itemImage = item.cover_url || `${CANONICAL_ORIGIN}/og-default.svg`;
    const itemDate = formatEditorialDate(item.published_at || item.scheduled_at || item.updated_at || '');
    return `<a href="${itemUrl}" class="group grid min-w-0 grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-[1.15rem] border border-black/10 bg-white/60 p-2.5 transition-all hover:-translate-y-0.5 hover:border-[#8A1F2D]/25 hover:bg-white hover:shadow-[0_18px_48px_rgba(16,16,16,0.08)] dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:bg-zinc-900">
      <div class="h-[72px] w-[88px] overflow-hidden rounded-[0.95rem] bg-[#ebe8df] dark:bg-zinc-800">
        <img src="${escapeHtml(itemImage)}" alt="${escapeHtml(item.cover_alt || item.title)}" class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/og-default.svg';" />
      </div>
      <div class="min-w-0 py-1">
        <span class="text-[8px] font-black uppercase tracking-[0.12em] text-[#8A1F2D]">${escapeHtml(displayCategory(item.category || article.category))}</span>
        <h3 class="mt-1 line-clamp-2 text-sm font-black leading-tight tracking-[-0.025em] text-zinc-950 transition-colors group-hover:text-[#8A1F2D] dark:text-zinc-50">${escapeHtml(item.title)}</h3>
        <p class="mt-1 text-[10px] font-bold uppercase tracking-[0.04em] text-zinc-400">${escapeHtml(itemDate)}${typeof item.views === 'number' ? ` • ${Number(item.views || 0)} views` : ''}</p>
      </div>
    </a>`;
  };
  const pickDistinct = <T extends Partial<CmsArticle>>(items: T[], limit: number, seen: Set<string>) => {
    const selected: T[] = [];
    for (const item of items) {
      const itemSlug = item.slug || '';
      if (!itemSlug || seen.has(itemSlug)) continue;
      selected.push(item);
      seen.add(itemSlug);
      if (selected.length >= limit) break;
    }
    return selected;
  };
  const recommendationSeen = new Set<string>([article.slug]);
  const recommendationGroups = [
    { title: 'Relacionadas', label: 'Contexto', items: pickDistinct(related, 4, recommendationSeen) },
    { title: 'Da mesma editoria', label: displayCategory(article.category), items: pickDistinct(related, 4, recommendationSeen) },
    { title: 'Mais lidas agora', label: '24h', items: pickDistinct(mostReadNow, 4, recommendationSeen) },
  ].filter((group) => group.items.length > 0);
  const recommendationsHtml = recommendationGroups.length
    ? `<section class="mt-10 grid gap-5 md:mt-14" aria-label="Recomendacoes de leitura">
        ${recommendationGroups
          .map(
            (group) => `<div class="rounded-[1.45rem] border border-black/10 bg-white/45 p-4 shadow-[0_18px_50px_rgba(16,16,16,0.04)] dark:border-zinc-800 dark:bg-zinc-950/30 md:rounded-[1.75rem] md:p-5">
              <div class="mb-4 flex items-center justify-between gap-3">
                <h2 class="text-base font-black tracking-[-0.035em] text-zinc-950 dark:text-zinc-50">${escapeHtml(group.title)}</h2>
                <span class="text-[9px] font-black uppercase tracking-[0.12em] text-[#8A1F2D]">${escapeHtml(group.label)}</span>
              </div>
              <div class="grid gap-3 md:grid-cols-2">${group.items.map(recommendationCard).join('')}</div>
            </div>`,
          )
          .join('')}
      </section>`
    : '';
  const newsletterHtml = `<section class="group relative mx-auto max-w-[900px] overflow-hidden rounded-[1.45rem] border border-black/10 bg-[#101010] p-4 text-white shadow-[0_18px_48px_rgba(16,16,16,0.14)] transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_24px_68px_rgba(16,16,16,0.18)] dark:border-white/10 dark:bg-zinc-950 md:rounded-[1.75rem] md:p-5">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(138,31,45,0.36),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.07),transparent_34%)]"></div>
        <div class="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
        <div class="relative z-10 grid gap-4 md:grid-cols-[minmax(0,1fr)_360px] md:items-end md:gap-8">
          <div class="space-y-2.5">
            <span class="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.2em] text-[#f4c8cf] ring-1 ring-white/10">Newsletter</span>
            <h3 class="max-w-md font-sans text-2xl font-black leading-[0.95] tracking-[-0.065em] text-white md:text-[2rem]">O essencial antes do ruido.</h3>
            <p class="max-w-lg text-sm font-medium leading-6 text-white/62">Um briefing curto para acompanhar os fatos que movem o dia.</p>
          </div>
          <div class="hidden rounded-[1.15rem] border border-emerald-300/25 bg-emerald-400/10 p-4 text-sm font-bold leading-6 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" data-newsletter-confirmation>
            <span class="block text-[9px] font-black uppercase tracking-[0.22em] text-emerald-200">Inscricao confirmada</span>
            <span class="mt-1 block" data-newsletter-confirmation-message>Você está na lista. Enviamos uma mensagem de boas-vindas.</span>
          </div>
          <form class="relative" data-newsletter-form>
            <input type="email" required name="email" placeholder="seu e-mail" class="h-11 w-full rounded-full border border-white/10 bg-white/[0.08] px-4 pr-24 text-sm font-bold text-white outline-none transition-all placeholder:text-white/35 focus:border-[#f4c8cf]/60 focus:ring-2 focus:ring-[#8A1F2D]/45" />
            <button type="submit" class="absolute bottom-1.5 right-1.5 top-1.5 inline-flex items-center justify-center rounded-full bg-[#8A1F2D] px-4 text-[9px] font-black uppercase tracking-[0.12em] text-white transition-all hover:bg-white hover:text-[#8A1F2D]">Assinar</button>
          </form>
          <p class="hidden text-xs font-bold text-white/65" data-newsletter-status aria-live="polite"></p>
        </div>
      </section>`;

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
    ${themeBootScript}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Playfair+Display:ital,wght@0,900;1,900&display=swap" />
    <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
    ${shellAssets}
    ${dynamicArticleStyle}

  </head>
  <body>
    <article class="min-h-screen bg-[#f5f3ee] pb-20 text-[#101010] transition-colors duration-300 dark:bg-[linear-gradient(180deg,#080809_0%,#141416_50%,#080809_100%)] dark:text-zinc-50">
      <nav class="fixed top-0 inset-x-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl z-50 border-b border-zinc-100 dark:border-zinc-800 py-4 lg:py-6">
        <div class="max-w-7xl mx-auto px-4 flex justify-between items-center">
          <a href="/" class="group flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
            <div class="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-[#8A1F2D] group-hover:text-white transition-all">
              <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>
            </div>
            <span class="hidden md:block font-black uppercase tracking-widest text-[10px]">Voltar</span>
          </a>
          <a href="/" class="group grid grid-cols-[auto_1fr] items-center gap-x-2 text-zinc-900 dark:text-zinc-50" aria-label="Portal Novo Alvo">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" class="h-8 w-8 text-[#8A1F2D] transition-colors group-hover:text-[#501620] md:h-9 md:w-9" aria-hidden="true">
              <circle cx="250" cy="250" r="209" fill="none" stroke="currentColor" stroke-width="29"></circle>
              <line x1="250" y1="21" x2="250" y2="114" stroke="currentColor" stroke-width="21"></line>
              <line x1="250" y1="386" x2="250" y2="479" stroke="currentColor" stroke-width="21"></line>
              <line x1="21" y1="250" x2="114" y2="250" stroke="currentColor" stroke-width="21"></line>
              <line x1="386" y1="250" x2="479" y2="250" stroke="currentColor" stroke-width="21"></line>
              <line x1="275.5" y1="275.5" x2="338.7" y2="338.7" stroke="currentColor" stroke-width="21" stroke-linecap="butt"></line>
              <line x1="224.5" y1="224.5" x2="161.3" y2="161.3" stroke="currentColor" stroke-width="21" stroke-linecap="butt"></line>
              <rect x="214" y="214" width="72" height="72" fill="currentColor"></rect>
            </svg>
            <span class="text-2xl font-serif font-black tracking-tighter leading-none transition-colors group-hover:text-[#501620] md:text-[1.7rem]">NOVO ALVO</span>
            <span class="col-start-2 mt-0.5 hidden text-[6px] font-black uppercase italic tracking-[0.4em] text-zinc-400 sm:block">Fatos e Impacto 24h</span>
          </a>
          <div class="flex items-center gap-2">
            ${themeToggleButton}
            <a href="https://wa.me/?text=${shareText}" target="_blank" rel="noopener noreferrer" data-share-channel="whatsapp" data-share-slug="${escapeHtml(article.slug)}" class="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-zinc-100 dark:bg-zinc-800 hover:bg-[#8A1F2D] hover:text-white dark:text-zinc-400" title="Compartilhar">↗</a>
          </div>
        </div>
      </nav>
      <div class="pt-20 lg:pt-32"></div>
      <header class="mx-auto max-w-[1240px] px-3 pb-10 pt-6 sm:px-4 md:pb-16 md:pt-12">
        <nav aria-label="Breadcrumb" class="mb-6 flex flex-wrap items-center gap-2 text-[11px] font-extrabold text-zinc-500 dark:text-zinc-500 md:mb-8 md:text-xs">
          <a href="/" class="transition-colors hover:text-[#8A1F2D]">Inicio</a><span class="text-zinc-400">/</span><a href="/?category=${encodeURIComponent(article.category)}" class="transition-colors hover:text-[#8A1F2D]">${escapeHtml(displayCategory(article.category))}</a><span class="text-zinc-400">/</span><span class="font-black text-[#8A1F2D]">${escapeHtml(article.title)}</span>
        </nav>
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-11">
          <div>
            <span class="mb-4 inline-flex h-8 items-center rounded-full bg-[#8A1F2D]/10 px-3.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#8A1F2D] md:mb-5 md:h-9 md:px-4 md:text-xs">${escapeHtml(displayCategory(article.category))}</span>
            <h1 class="max-w-5xl text-[clamp(2.65rem,15vw,5.875rem)] font-sans font-black leading-[0.9] tracking-[-0.088em] text-[#101010] dark:text-zinc-50 sm:text-[clamp(3.35rem,11vw,5.875rem)]">${escapeHtml(article.title)}</h1>
            <p class="mt-5 max-w-3xl text-lg font-medium leading-7 text-zinc-600 dark:text-zinc-400 md:mt-6 md:text-2xl md:leading-9">${escapeHtml(article.summary || description)}</p>
            <div class="mt-6 flex flex-wrap gap-2 md:mt-8">
              <span class="inline-flex min-h-9 items-center rounded-full border border-black/10 bg-white px-3.5 text-[11px] font-extrabold text-zinc-600 shadow-[0_8px_24px_rgba(16,16,16,0.035)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 md:min-h-10 md:px-4 md:text-xs"><strong class="mr-1 text-zinc-950 dark:text-zinc-50">${escapeHtml(formatEditorialDate(published))}</strong></span>
              <span data-live-view-count="${escapeHtml(article.slug)}" class="inline-flex min-h-9 items-center rounded-full border border-black/10 bg-white px-3.5 text-[11px] font-extrabold text-zinc-600 shadow-[0_8px_24px_rgba(16,16,16,0.035)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 md:min-h-10 md:px-4 md:text-xs">0 views</span>
              <span class="inline-flex min-h-9 items-center rounded-full border border-black/10 bg-white px-3.5 text-[11px] font-extrabold text-zinc-600 shadow-[0_8px_24px_rgba(16,16,16,0.035)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 md:min-h-10 md:px-4 md:text-xs">${escapeHtml(String(article.reading_minutes || 1))} min de leitura</span>
            </div>
            <div class="mt-6 inline-flex items-center gap-3 rounded-[1.25rem] border border-black/10 bg-white p-2.5 pr-4 shadow-[0_18px_50px_rgba(16,16,16,0.055)] dark:border-zinc-800 dark:bg-zinc-900 md:mt-8 md:rounded-[1.375rem] md:p-3 md:pr-5">
              <div class="grid h-11 w-11 place-items-center rounded-xl bg-[#8A1F2D] text-xs font-black text-white md:h-12 md:w-12 md:rounded-2xl md:text-sm">NA</div>
              <div><div class="text-sm font-black text-zinc-950 dark:text-zinc-50">Por ${escapeHtml(article.author || 'Redação Novo Alvo')}</div><div class="mt-0.5 text-xs font-bold text-zinc-400">Fatos e Impacto 24h</div></div>
            </div>
            ${coverHtml}
          </div>
          <aside class="lg:self-stretch">
            <div class="grid h-full content-start gap-4 md:grid-cols-2 lg:grid-cols-1 lg:gap-5">
              <section class="rounded-[1.45rem] border border-black/10 bg-white p-4 shadow-[0_18px_50px_rgba(16,16,16,0.055)] dark:border-zinc-800 dark:bg-zinc-900 md:rounded-[1.75rem] md:p-5">
                <h2 class="mb-3 text-base font-black tracking-[-0.045em] text-zinc-950 dark:text-zinc-50 md:mb-4 md:text-lg">Compartilhe</h2>
                <div class="grid gap-2">
                  <a href="https://wa.me/?text=${shareText}" target="_blank" rel="noopener noreferrer" data-share-channel="whatsapp" data-share-slug="${escapeHtml(article.slug)}" class="flex h-10 items-center justify-between rounded-full bg-[#8A1F2D] px-4 text-[11px] font-black text-white transition-transform hover:-translate-y-0.5 md:h-11 md:text-xs">WhatsApp <span>→</span></a>
                  <a href="https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}" target="_blank" rel="noopener noreferrer" data-share-channel="x" data-share-slug="${escapeHtml(article.slug)}" class="flex h-10 items-center justify-between rounded-full border border-black/10 bg-[#f5f3ee] px-4 text-[11px] font-black text-zinc-600 transition-all hover:border-[#8A1F2D]/30 hover:text-[#8A1F2D] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 md:h-11 md:text-xs">X / Twitter <span>→</span></a>
                  <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer" data-share-channel="facebook" data-share-slug="${escapeHtml(article.slug)}" class="flex h-10 items-center justify-between rounded-full border border-black/10 bg-[#f5f3ee] px-4 text-[11px] font-black text-zinc-600 transition-all hover:border-[#8A1F2D]/30 hover:text-[#8A1F2D] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 md:h-11 md:text-xs">Facebook <span>→</span></a>
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
            <div class="prose prose-zinc max-w-none prose-p:mb-6 prose-p:text-[1.08rem] prose-p:font-normal prose-p:leading-[1.78] prose-p:tracking-[-0.01em] prose-p:text-[#292927] md:prose-p:mb-7 md:prose-p:text-xl md:prose-p:leading-[1.82] prose-headings:font-sans prose-headings:font-black prose-headings:tracking-[-0.065em] prose-headings:text-zinc-950 prose-h2:mb-4 prose-h2:mt-11 prose-h2:text-3xl prose-h2:leading-none md:prose-h2:mb-5 md:prose-h2:mt-14 md:prose-h2:text-4xl prose-h3:mb-3 prose-h3:mt-8 prose-h3:text-2xl md:prose-h3:mb-4 md:prose-h3:mt-10 prose-strong:text-zinc-950 prose-strong:font-black prose-ul:mb-8 prose-ul:list-disc prose-ul:pl-6 prose-li:mb-2 prose-li:text-lg prose-li:leading-8 prose-a:text-[#8A1F2D] prose-a:font-bold prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-[4px] prose-blockquote:border-[#8A1F2D] prose-blockquote:pl-5 prose-blockquote:text-[1.08rem] prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:leading-[1.78] prose-blockquote:tracking-[-0.01em] md:prose-blockquote:border-l-[5px] md:prose-blockquote:pl-7 md:prose-blockquote:text-xl md:prose-blockquote:leading-[1.82] dark:prose-invert dark:prose-p:text-zinc-300 dark:prose-headings:text-zinc-50 article-content overflow-hidden break-words [word-break:break-word] [overflow-wrap:break-word]">${cleanBody || `<p>${escapeHtml(article.summary || '')}</p>`}</div>
            ${sourcesHtml}
            <div class="mt-12 flex justify-center border-t border-black/10 pt-8 dark:border-zinc-800"><div class="overflow-hidden relative flex flex-col items-center justify-center h-[90px] w-full max-w-[728px]"><div class="absolute top-1 left-2 z-10 pointer-events-none"><span class="text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Publicidade</span></div></div></div>
          </div>
          <aside class="grid h-fit gap-5 lg:sticky lg:top-28 lg:self-start">${sideRelatedHtml}</aside>
        </div>
        <div class="mt-12 md:mt-16">${newsletterHtml}</div>
        ${recommendationsHtml}
      </section>
    </article>
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
              node.textContent = value + ' views';
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
    <script>
      (() => {
        const key = 'novo-alvo-visitor-id';
        const getVisitorId = () => {
          try {
            const existing = localStorage.getItem(key);
            if (existing) return existing;
            const next = crypto.randomUUID ? crypto.randomUUID() : 'fallback-' + Date.now() + '-' + Math.random();
            localStorage.setItem(key, next);
            return next;
          } catch {
            return 'fallback-' + Date.now() + '-' + Math.random();
          }
        };
        const trackShare = (link) => {
          const body = JSON.stringify({
            visitorId: getVisitorId(),
            slug: link.dataset.shareSlug || '',
            channel: link.dataset.shareChannel || '',
            path: window.location.pathname,
          });
          try {
            if (navigator.sendBeacon) {
              navigator.sendBeacon('/api/share', new Blob([body], { type: 'application/json' }));
              return;
            }
          } catch {}
          fetch('/api/share', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
            keepalive: true,
          }).catch(() => {});
        };
        document.querySelectorAll('[data-share-channel][data-share-slug]').forEach((link) => {
          link.addEventListener('click', () => trackShare(link));
        });
      })();
    </script>
    <script>
      document.querySelectorAll('[data-newsletter-form]').forEach((form) => {
        const wrapper = form.parentElement;
        const status = wrapper && wrapper.querySelector('[data-newsletter-status]');
        const confirmation = wrapper && wrapper.querySelector('[data-newsletter-confirmation]');
        const confirmationMessage = wrapper && wrapper.querySelector('[data-newsletter-confirmation-message]');
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const email = String(new FormData(form).get('email') || '').trim();
          const button = form.querySelector('button[type="submit"]');
          if (button) button.disabled = true;
          if (confirmation) confirmation.classList.add('hidden');
          if (status) {
            status.classList.remove('hidden');
            status.textContent = 'Salvando sua inscricao...';
          }
          try {
            const response = await fetch('/api/newsletter', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ email, sourcePath: window.location.pathname }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Nao foi possivel assinar agora.');
            form.reset();
            form.classList.add('hidden');
            if (status) {
              status.classList.add('hidden');
              status.textContent = '';
            }
            if (confirmation) {
              confirmation.classList.remove('hidden');
              if (confirmationMessage) {
                confirmationMessage.textContent = data.emailSent
                  ? 'Você está na lista. Enviamos uma mensagem de boas-vindas para seu e-mail.'
                  : 'Você está na lista. A mensagem de boas-vindas será enviada em breve.';
              }
            }
          } catch (error) {
            if (status) status.textContent = error instanceof Error ? error.message : 'Nao foi possivel assinar agora.';
          } finally {
            if (button) button.disabled = false;
          }
        });
      });
    </script>
    ${themeToggleScript}
  </body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  });
};
