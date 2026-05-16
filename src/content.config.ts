import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const news = defineCollection({
  loader: glob({ base: './src/content/news', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    summary: z.string(),
    seoDescription: z.string(),
    breakingSummary: z.string().optional(),
    category: z.string(),
    subcategory: z.string().optional(),
    author: z.string(),
    sources: z.array(z.string()).default([]),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    featured: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    urgent: z.boolean().default(false),
    homeSection: z.string().optional(),
    views: z.number().int().nonnegative().default(0),
    cover: z.object({
      src: z.url(),
      alt: z.string(),
      caption: z.string().optional(),
      layout: z.enum(['full', 'half', 'none']).default('full'),
    }),
    ogImage: z.url().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { news };
