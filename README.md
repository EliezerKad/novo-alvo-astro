# Novo Alvo Astro

Projeto Astro local para migracao incremental do portal Novo Alvo.

## Comandos

```sh
npm install
npm run dev
npm run build
```

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Deploy command: deixe em branco no deploy automatico via GitHub.
- O projeto esta configurado como `output: 'static'`, compativel com Pages sem runtime Node.

Nao use `npx wrangler deploy` neste projeto. Esse comando e para Workers e gera erro de entry-point.

Se precisar fazer deploy manual por terminal, use:

```sh
npm run build
npx wrangler pages deploy dist --project-name=novo-alvo-astro
```
