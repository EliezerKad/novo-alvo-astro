import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://portalnovoalvo.com.br');
  const sitemap = new URL('/sitemap-index.xml', origin);

  return new Response(
    `User-agent: *
Allow: /
Disallow: /admin/

Sitemap: ${sitemap.href}
`,
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    },
  );
};
