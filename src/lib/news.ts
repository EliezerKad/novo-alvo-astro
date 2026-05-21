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
  Politica: 'Política',
  Economia: 'Economia',
  Brasil: 'Brasil',
  Mundo: 'Mundo',
  Saude: 'Saúde',
  Tecnologia: 'Tecnologia',
  Esportes: 'Esportes',
  Famosos: 'Famosos',
  Cinema: 'Cinema',
  Entretenimento: 'Entretenimento',
  Ciencia: 'Ciência',
  Educacao: 'Educação',
  Cultura: 'Cultura',
  Lifestyle: 'Lifestyle',
  Games: 'Games',
  Moda: 'Moda',
  Musica: 'Música',
  Futebol: 'Futebol',
  Ocorrencias: 'Ocorrências',
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
  'Ocorrencias',
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
    homeSection: entry.data.homeSection,
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

export function displayCategory(category?: string): string {
  if (!category) return '';
  return categoryLabels[category] || category;
}

export function featuredNews(entries: NewsEntry[]): NewsEntry[] {
  return entries.filter((entry) => entry.data.featured || entry.data.isFeatured);
}

export function urgentNews(entries: NewsEntry[]): NewsEntry[] {
  const occurrencePattern = /\b(acidente|morte|mortes|ferido|feridos|incendio|colisao|tiroteio|desabamento|explosao|resgate|policia|prisao|crime|ocorrencia|ocorrencias)\b/i;
  const occurrences = entries.filter((entry) => {
    const category = categorySlug(entry.data.category);
    const tags = entry.data.tags.join(' ');
    const text = `${entry.data.title} ${entry.data.summary} ${tags}`;
    return category === 'ocorrencias' || /\bocorrencias?\b/i.test(tags) || occurrencePattern.test(text);
  });
  if (occurrences.length > 0) return occurrences.slice(0, 10);

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
