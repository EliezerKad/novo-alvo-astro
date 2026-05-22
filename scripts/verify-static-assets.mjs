import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, normalize, relative, sep } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const routesPath = join(distDir, '_routes.json');
const indexPath = join(distDir, 'index.html');

const fail = (message) => {
  console.error(`[verify-static-assets] ${message}`);
  process.exitCode = 1;
};

const readText = (path) => readFileSync(path, 'utf8');

const assertInsideDist = (path) => {
  const rel = relative(distDir, path);
  if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
    throw new Error(`Asset path escapes dist: ${path}`);
  }
};

if (!existsSync(distDir)) {
  fail('Missing dist directory. Run astro build before this check.');
}

if (!existsSync(indexPath)) {
  fail('Missing dist/index.html.');
}

if (!existsSync(routesPath)) {
  fail('Missing dist/_routes.json.');
} else {
  try {
    const routes = JSON.parse(readText(routesPath));
    const includesAll = Array.isArray(routes.include) && routes.include.includes('/*');
    const excludesAstro = Array.isArray(routes.exclude) && routes.exclude.includes('/_astro/*');
    if (includesAll) {
      fail('dist/_routes.json must not include /* because it can route static assets through Pages Functions.');
    }
    if (!excludesAstro) {
      fail('dist/_routes.json must exclude /_astro/* so Astro CSS/JS bypass Pages Functions.');
    }
  } catch (error) {
    fail(`Could not parse dist/_routes.json: ${error.message}`);
  }
}

const listHtmlFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(path);
    return entry.isFile() && entry.name.endsWith('.html') ? [path] : [];
  });

const assetPaths = new Set();

for (const htmlPath of listHtmlFiles(distDir)) {
  const html = readText(htmlPath);
  const assetMatches = html.matchAll(/["']([^"']*\/_astro\/[^"']+\.(?:css|js))["']/g);
  for (const match of assetMatches) {
    assetPaths.add(new URL(match[1], 'https://portalnovoalvo.com.br').pathname);
  }
}

if (!assetPaths.size) {
  fail('No /_astro CSS or JS assets were referenced by generated HTML.');
}

for (const assetPath of [...assetPaths].sort()) {
  const localPath = normalize(join(distDir, assetPath));
  assertInsideDist(localPath);

  if (!existsSync(localPath)) {
    fail(`Referenced asset is missing: ${assetPath}`);
    continue;
  }

  const stats = statSync(localPath);
  if (!stats.isFile() || stats.size < 128) {
    fail(`Referenced asset is too small or not a file: ${assetPath} (${stats.size} bytes)`);
    continue;
  }

  const content = readText(localPath);
  const start = content.trimStart().slice(0, 80).toLowerCase();

  if (start.startsWith('<!doctype html') || start.startsWith('<html')) {
    fail(`Referenced asset contains HTML instead of static content: ${assetPath}`);
  }

  if (assetPath.endsWith('.css') && !content.includes('{')) {
    fail(`CSS asset does not look like a valid stylesheet: ${assetPath}`);
  }

  if (assetPath.endsWith('.js') && !/\b(import|function|const|var|let)\b/.test(content.slice(0, 2048))) {
    fail(`JS asset does not look like executable JavaScript: ${assetPath}`);
  }
}

if (!process.exitCode) {
  console.log(`[verify-static-assets] OK: ${assetPaths.size} /_astro assets verified.`);
}
