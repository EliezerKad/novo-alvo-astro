import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://portalnovoalvo.com.br');
  const sitemap = new URL('/sitemap-index.xml', origin);

  return new Response(
    `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /admin/*
Disallow: /api/admin/
Disallow: /api/admin/*
Disallow: /redacao
Disallow: /redacao/
Disallow: /redacao/*

User-agent: Googlebot
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /admin/*
Disallow: /api/admin/
Disallow: /api/admin/*
Disallow: /redacao
Disallow: /redacao/
Disallow: /redacao/*

User-agent: Googlebot-News
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /admin/*
Disallow: /api/admin/
Disallow: /api/admin/*
Disallow: /redacao
Disallow: /redacao/
Disallow: /redacao/*

User-agent: Googlebot-Image
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /admin/*
Disallow: /api/admin/
Disallow: /api/admin/*
Disallow: /redacao
Disallow: /redacao/
Disallow: /redacao/*

User-agent: Googlebot-Video
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /admin/*
Disallow: /api/admin/
Disallow: /api/admin/*
Disallow: /redacao
Disallow: /redacao/
Disallow: /redacao/*

User-agent: Google-InspectionTool
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /admin/*
Disallow: /api/admin/
Disallow: /api/admin/*
Disallow: /redacao
Disallow: /redacao/
Disallow: /redacao/*

Sitemap: ${sitemap.href}
`,
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    },
  );
};
