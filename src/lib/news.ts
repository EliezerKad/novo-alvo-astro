import type { CollectionEntry } from 'astro:content';
import type { Article } from '../types';

export type NewsEntry = CollectionEntry<'news'>;

export const categoriesList = [
  'Politica',
  'Economia',
  'Brasil',
  'Mundo',
  'Saude',
  'Tecnologia',
  'Esportes',
  'Famosos',
  'Cinema',
];

export const categoryLabels: Record<string, string> = {
  Politica: 'Politica',
  Economia: 'Economia',
  Brasil: 'Brasil',
  Mundo: 'Mundo',
  Saude: 'Saude',
  Tecnologia: 'Tecnologia',
  Esportes: 'Esportes',
  Famosos: 'Famosos',
  Cinema: 'Cinema',
  Entretenimento: 'Entretenimento',
  Ciencia: 'Ciencia',
  Educacao: 'Educacao',
  Cultura: 'Cultura',
  Lifestyle: 'Lifestyle',
  Games: 'Games',
  Moda: 'Moda',
  Musica: 'Musica',
  Futebol: 'Futebol',
  Geral: 'Geral',
};

export const subCategoriesList = [
  'Entretenimento',
  'Ciencia',
  'Educacao',
  'Cultura',
  'Lifestyle',
  'Games',
  'Moda',
  'Musica',
  'Futebol',
];

export function sortNewsByDate(entries: NewsEntry[]): NewsEntry[] {
  return [...entries].sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}

export function newsEntryToArticle(entry: NewsEntry): Article {
  return {
    id: entry.id,
    title: entry.data.title,
    content: '',
    summary: entry.data.summary,
    breakingSummary: entry.data.breakingSummary,
    imageUrl: entry.data.cover.src,
    imageCaption: entry.data.cover.caption,
    imageLayout: entry.data.cover.layout,
    category: entry.data.category,
    sources: entry.data.sources,
    publishedAt: entry.data.publishedAt.toISOString(),
    createdAt: (entry.data.updatedAt ?? entry.data.publishedAt).toISOString(),
    slug: entry.data.slug,
    isFeatured: entry.data.featured || entry.data.isFeatured,
    views: entry.data.views,
    author: entry.data.author,
  };
}

export function categorySlug(category: string): string {
  return category
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function categoryFromSlug(slug: string, categories = [...categoriesList, ...subCategoriesList]): string | undefined {
  return categories.find((category) => categorySlug(category) === slug);
}

export function categoryUrl(category: string): string {
  return `/categoria/${categorySlug(category)}/`;
}

export function featuredNews(entries: NewsEntry[]): NewsEntry[] {
  return entries.filter((entry) => entry.data.featured || entry.data.isFeatured);
}

export function urgentNews(entries: NewsEntry[]): NewsEntry[] {
  const urgent = entries.filter((entry) => entry.data.urgent || entry.data.breakingSummary);
  return urgent.length > 0 ? urgent : featuredNews(entries);
}

export function relatedNews(current: NewsEntry, entries: NewsEntry[], limit = 4): Article[] {
  const sameCategory = entries.filter(
    (entry) => entry.id !== current.id && entry.data.category === current.data.category,
  );
  const fallback = entries
    .filter((entry) => entry.id !== current.id && entry.data.category !== current.data.category)
    .sort((a, b) => b.data.views - a.data.views);

  return [...sameCategory, ...fallback].slice(0, limit).map(newsEntryToArticle);
}
