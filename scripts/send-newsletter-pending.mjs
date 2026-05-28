import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const envPath = path.join(root, '.env.automation.local');

const readLocalEnv = () => {
  const values = {};
  if (!fs.existsSync(envPath)) return values;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
    if (!match) continue;
    values[match[1].trim()] = match[2].trim();
  }

  return values;
};

const args = new Map();
for (const arg of process.argv.slice(2)) {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  args.set(key, value);
}

const localEnv = readLocalEnv();
const token = process.env.ADMIN_TOKEN || localEnv.ADMIN_TOKEN;
const endpoint =
  process.env.NEWSLETTER_SEND_ENDPOINT ||
  localEnv.NEWSLETTER_SEND_ENDPOINT ||
  'https://novo-alvo-astro.pages.dev/api/admin/newsletter-send';
const publicOrigin = process.env.PORTAL_ORIGIN || localEnv.PORTAL_ORIGIN || 'https://portalnovoalvo.com.br';
const max = Number(args.get('max') || process.env.NEWSLETTER_SEND_MAX || 190);
const batchSize = Math.min(100, Math.max(1, Number(args.get('batch') || process.env.NEWSLETTER_SEND_BATCH || 10)));
const pauseMs = Math.max(0, Number(args.get('pauseMs') || process.env.NEWSLETTER_SEND_PAUSE_MS || 1000));

if (!token) {
  console.error('[newsletter-send] ADMIN_TOKEN ausente.');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let sent = 0;
let batches = 0;
let quotaHit = false;

while (sent < max) {
  const limit = Math.min(batchSize, max - sent);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      offset: 0,
      limit,
      onlyUnsent: true,
      origin: publicOrigin,
    }),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!response.ok || !data.ok) {
    const message = data.error || data.message || `HTTP ${response.status}`;
    if (response.status === 502 && /quota/i.test(message)) {
      quotaHit = true;
      console.log(`[newsletter-send] Cota atingida depois de ${sent} envios novos.`);
      break;
    }
    console.error(`[newsletter-send] Erro no lote ${batches + 1}: ${message}`);
    process.exit(1);
  }

  const count = Number(data.sent || 0);
  batches += 1;
  sent += count;

  console.log(
    `[newsletter-send] lote=${batches} enviados=${count} total=${sent} primeiro=${data.first || '-'} ultimo=${data.last || '-'}`,
  );

  if (data.done || count === 0) break;
  await sleep(pauseMs);
}

console.log(JSON.stringify({ ok: true, sent, batches, quotaHit, max, batchSize }));
