const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN || 'https://portalnovoalvo.com.br';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const LIMIT = Number(process.env.PULSE_LIMIT || 2);

const main = async () => {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN ausente.');

  const response = await fetch(`${PORTAL_ORIGIN}/api/admin/queue?limit=${LIMIT}`, {
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
