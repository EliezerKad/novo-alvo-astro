const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });

const safeId = (value) => String(value || '').replace(/[^a-zA-Z0-9:-]/g, '').slice(0, 96);

export async function onRequestPost({ request, env }) {
  const store = env.VISITOR_COUNTER;
  if (!store) return json({ enabled: false });

  let payload = {};
  try {
    payload = await request.json();
  } catch {}

  const visitorId = safeId(payload.visitorId);
  if (!visitorId) return json({ enabled: false }, { status: 400 });

  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const onlineKey = `online:${visitorId}`;
  const dailyKey = `daily:${today}:${visitorId}`;
  const totalKey = 'total';

  const alreadyCountedToday = await store.get(dailyKey);
  let total = Number((await store.get(totalKey)) || 0);
  if (!alreadyCountedToday) {
    total += 1;
    await store.put(totalKey, String(total));
    await store.put(dailyKey, '1', { expirationTtl: 60 * 60 * 30 });
  }

  await store.put(
    onlineKey,
    JSON.stringify({
      path: String(payload.path || '/').slice(0, 160),
      updatedAt: now,
    }),
    { expirationTtl: 90 },
  );

  const online = await store.list({ prefix: 'online:', limit: 1000 });

  return json({
    enabled: true,
    online: online.keys.length,
    total,
  });
}
