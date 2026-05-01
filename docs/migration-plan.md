# Migração incremental do portal React para Astro

## Estrutura atual analisada

- O portal original está em `portal-novo-alvo-manual-main/` e continua sem alterações.
- A aplicação atual é um SPA React com Vite: `src/main.tsx` monta `src/App.tsx`.
- Rotas atuais via `react-router-dom`: `/`, `/noticia/:slug`, `/admin`, `/sobre`, `/politica-de-privacidade` e `/contato`.
- Páginas React atuais: `Home`, `ArticleDetail`, `Admin`, `Contato`, `Sobre` e `PoliticaPrivacidade`.
- Componentes compartilhados: `Navbar`, `Footer`, logos, menu mobile, prompt de notificações e cards de anúncio.
- Estado e serviços ficam em `src/lib`, `src/context` e `src/hooks`, com Firebase, Gemini, cache e presença.
- Dependências de atenção na migração: `firebase`, `@google/genai`, `react-quill-new`, `motion`, `lucide-react`, `react-markdown`, `rss-parser` e `date-fns`.
- Cloudflare Pages já usa `public/_headers`, `public/_routes.json`, `functions/sitemap.xml.ts` e `wrangler.jsonc`.

## Estratégia recomendada

1. Migrar primeiro shell estático: layout Astro com `Navbar`, `Footer`, SEO e páginas institucionais.
2. Reusar componentes React como ilhas Astro usando diretivas `client:*` apenas onde houver interatividade.
3. Mover dados públicos de artigos para conteúdo estático ou JSON versionado antes de substituir leituras client-side.
4. Portar `Home` e `ArticleDetail` para rotas Astro, mantendo cards e UI em React durante a transição.
5. Manter `Admin` como ilha React protegida enquanto Firebase/Auth continuam client-side.
6. Replicar os arquivos Cloudflare em `public` e portar `functions/sitemap.xml.ts` somente quando a geração de sitemap for definida.
7. Trocar gradualmente `react-router-dom` por rotas de arquivo Astro: `src/pages/index.astro`, `src/pages/noticia/[slug].astro`, `src/pages/sobre.astro`, `src/pages/politica-de-privacidade.astro`, `src/pages/contato.astro` e `src/pages/admin.astro`.

## Cuidados Cloudflare Pages

- Evitar APIs Node no runtime do cliente e no build final.
- Manter saída estática em `dist`.
- Se houver SSR no futuro, adicionar explicitamente `@astrojs/cloudflare`; para a migração inicial estática, não é necessário.
