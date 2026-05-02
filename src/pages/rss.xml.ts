import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { sortNewsByDate } from '../lib/news';

const escapeXmlAttribute = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

export async function GET(context: APIContext) {
  const news = sortNewsByDate(await getCollection('news'));
  const site = context.site ?? new URL('https://portalnovoalvo.com.br');

  return rss({
    title: 'Novo Alvo',
    description: 'Noticias, analise e cobertura editorial com foco em fatos relevantes.',
    site,
    xmlns: {
      media: 'http://search.yahoo.com/mrss/',
    },
    trailingSlash: false,
    stylesheet: '/rss/styles.xsl',
    items: news.map((entry) => {
      const imageUrl = entry.data.ogImage ?? entry.data.cover.src;
      const escapedImageUrl = escapeXmlAttribute(imageUrl);
      const escapedImageAlt = escapeXmlAttribute(entry.data.cover.alt);

      return {
        title: entry.data.title,
        description: entry.data.seoDescription,
        pubDate: entry.data.publishedAt,
        link: `/noticia/${entry.data.slug}/`,
        categories: [entry.data.category, ...entry.data.tags],
        author: entry.data.author,
        enclosure: {
          url: imageUrl,
          length: 0,
          type: 'image/jpeg',
        },
        customData: `<media:content url="${escapedImageUrl}" medium="image" type="image/jpeg"><media:title>${escapedImageAlt}</media:title></media:content><media:thumbnail url="${escapedImageUrl}" />`,
      };
    }),
    customData: '<language>pt-BR</language>',
  });
}
