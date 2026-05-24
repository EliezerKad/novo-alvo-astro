type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      all: <T = unknown>() => Promise<{ results?: T[] }>;
    };
  };
};

type Env = {
  EDITORIAL_DB?: D1Database;
};

type ArticleRow = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  author: string;
  cover_url: string;
  cover_alt: string;
  seo_description: string;
  tags: string;
  published_at: string;
  scheduled_at: string;
  updated_at: string;
};

const ORIGIN = 'https://portalnovoalvo.com.br';

const escapeXml = (value: unknown) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const parseArray = (value: string) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
};

const articleDate = (article: ArticleRow) => article.published_at || article.scheduled_at || article.updated_at || new Date().toISOString();

const absoluteUrl = (value: string) => {
  if (!value) return `${ORIGIN}/og-default.svg`;
  try {
    const url = new URL(value, ORIGIN);
    if (!/^https?:$/i.test(url.protocol)) return `${ORIGIN}/og-default.svg`;
    if (url.hostname === 'www.portalnovoalvo.com.br') url.hostname = 'portalnovoalvo.com.br';
    return url.toString();
  } catch {
    return `${ORIGIN}/og-default.svg`;
  }
};

const selectBalanced = (articles: ArticleRow[], limit: number, category?: string) => {
  if (category) return articles.slice(0, limit);

  const selected: ArticleRow[] = [];
  const countByCategory = new Map<string, number>();
  const maxPerCategory = 4;

  for (const article of articles) {
    const count = countByCategory.get(article.category) || 0;
    if (count >= maxPerCategory) continue;
    selected.push(article);
    countByCategory.set(article.category, count + 1);
    if (selected.length >= limit) return selected;
  }

  for (const article of articles) {
    if (selected.some((item) => item.slug === article.slug)) continue;
    selected.push(article);
    if (selected.length >= limit) return selected;
  }

  return selected;
};

export const buildRssResponse = async ({ request, env }: { request: Request; env: Env }) => {
  try {
  const db = env.EDITORIAL_DB;
  if (!db) {
    return new Response('EDITORIAL_DB nao configurado.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const url = new URL(request.url);
  const category = String(url.searchParams.get('category') || '').trim();
  const limit = Math.max(1, Math.min(60, Number(url.searchParams.get('limit') || 40)));
  const now = new Date().toISOString();
  const visibleAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const fields = `slug, title, summary, category, author,
    CASE WHEN cover_url LIKE 'data:%' THEN '' ELSE cover_url END AS cover_url,
    cover_alt, seo_description, tags, published_at, scheduled_at, updated_at`;
  const result = category
    ? await db
        .prepare(
          `SELECT ${fields}
           FROM articles
           WHERE status = 'published'
             AND category = ?
             AND (
               COALESCE(NULLIF(scheduled_at, ''), '') = ''
               OR COALESCE(NULLIF(published_at, ''), updated_at) <= ?
             )
           ORDER BY COALESCE(NULLIF(published_at, ''), scheduled_at, updated_at) DESC
           LIMIT ?`,
        )
        .bind(category, visibleAt, limit)
        .all<ArticleRow>()
    : await db
        .prepare(
          `SELECT ${fields}
           FROM articles
           WHERE status = 'published'
             AND (
               COALESCE(NULLIF(scheduled_at, ''), '') = ''
               OR COALESCE(NULLIF(published_at, ''), updated_at) <= ?
             )
           ORDER BY COALESCE(NULLIF(published_at, ''), scheduled_at, updated_at) DESC
           LIMIT ?`,
        )
        .bind(visibleAt, Math.max(limit * 3, 80))
        .all<ArticleRow>();

  const articles = selectBalanced(result.results || [], limit, category);
  const latestDate = articles[0] ? articleDate(articles[0]) : now;

  const items = articles
    .map((article) => {
      const link = `${ORIGIN}/noticia/${encodeURIComponent(article.slug)}/`;
      const image = absoluteUrl(article.cover_url);
      const description = article.seo_description || article.summary;
      const categories = [article.category, ...parseArray(article.tags)];
      return `<item>
  <title>${escapeXml(article.title)}</title>
  <link>${escapeXml(link)}</link>
  <guid isPermaLink="true">${escapeXml(link)}</guid>
  <description>${escapeXml(description)}</description>
  <pubDate>${escapeXml(new Date(articleDate(article)).toUTCString())}</pubDate>
  <author>${escapeXml(article.author || 'Portal Novo Alvo')}</author>
  ${categories.map((item) => `<category>${escapeXml(item)}</category>`).join('\n  ')}
  <enclosure url="${escapeXml(image)}" length="0" type="image/jpeg" />
  <image>${escapeXml(image)}</image>
  <image_alttext>${escapeXml(article.cover_alt || article.title)}</image_alttext>
  <media:content url="${escapeXml(image)}" medium="image" type="image/jpeg">
    <media:title>${escapeXml(article.cover_alt || article.title)}</media:title>
  </media:content>
  <media:thumbnail url="${escapeXml(image)}" />
</item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>Portal Novo Alvo</title>
  <link>${ORIGIN}/</link>
  <description>Noticias, analise e cobertura editorial com foco em fatos relevantes.</description>
  <language>pt-BR</language>
  <lastBuildDate>${escapeXml(new Date(latestDate).toUTCString())}</lastBuildDate>
  <ttl>10</ttl>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Portal Novo Alvo</title>
  <link>${ORIGIN}/</link>
  <description>Noticias, analise e cobertura editorial com foco em fatos relevantes.</description>
  <language>pt-BR</language>
  <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>
  <ttl>10</ttl>
  <item>
    <title>${escapeXml('RSS temporariamente indisponivel')}</title>
    <link>${ORIGIN}/</link>
    <guid isPermaLink="true">${ORIGIN}/</guid>
    <description>${escapeXml(message)}</description>
    <pubDate>${escapeXml(new Date().toUTCString())}</pubDate>
  </item>
</channel>
</rss>`;
    return new Response(xml, {
      headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
};
