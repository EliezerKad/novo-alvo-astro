import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const loadLocalEnv = (filePath) => {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
};

loadLocalEnv(resolve('.env.automation.local'));
loadLocalEnv(resolve('.env.local'));

const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN || 'https://portalnovoalvo.com.br';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const LIMIT = Number(process.env.PULSE_LIMIT || 2);
const FETCH_TIMEOUT_MS = Number(process.env.PULSE_FETCH_TIMEOUT_MS || 20000);

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`timeout apos ${FETCH_TIMEOUT_MS}ms`)), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const main = async () => {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN ausente.');

  const response = await fetchWithTimeout(`${PORTAL_ORIGIN}/api/admin/queue?limit=${LIMIT}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_TOKEN}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Falha na pulsacao editorial: ${response.status}`);

  console.log(`Pulsacao concluida. Verificadas: ${data.checked || 0}. Publicadas: ${data.published?.length || 0}.`);
  for (const item of data.published || []) {
    console.log(`- ${item.slug}: ${item.title}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
