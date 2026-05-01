import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { sortNewsByDate } from '../lib/news';

export async function GET(context: APIContext) {
  const news = sortNewsByDate(await getCollection('news'));
  const site = context.site ?? new URL('https://portalnovoalvo.com.br');

  return rss({
    title: 'Novo Alvo',
    description: 'Noticias, analise e cobertura editorial com foco em fatos relevantes.',
    site,
    trailingSlash: false,
    stylesheet: '/rss/styles.xsl',
    items: news.map((entry) => ({
      title: entry.data.title,
      description: entry.data.seoDescription,
      pubDate: entry.data.publishedAt,
      link: `/noticia/${entry.data.slug}/`,
      categories: [entry.data.category, ...entry.data.tags],
      author: entry.data.author,
    })),
    customData: '<language>pt-BR</language>',
  });
}
