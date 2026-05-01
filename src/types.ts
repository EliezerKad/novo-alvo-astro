export interface Article {
  id: string;
  title: string;
  content: string;
  summary: string;
  breakingSummary?: string;
  imageUrl?: string;
  imageCaption?: string;
  imageLayout?: 'full' | 'half' | 'none';
  category: string;
  sources: string[];
  publishedAt: string;
  createdAt: string;
  slug: string;
  isFeatured?: boolean;
  views?: number;
  author?: string;
}
