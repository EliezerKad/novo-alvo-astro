type Env = {
  ADMIN_TOKEN?: string;
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });

const sessionCookie = (value: string, maxAge: number) =>
  [
    `admin_session=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].join('; ');

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  if (!env.ADMIN_TOKEN) {
    return json({ error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });
  }

  let token = '';
  try {
    const payload = (await request.json()) as { token?: string };
    token = String(payload.token || '').trim();
  } catch {
    return json({ error: 'JSON invalido.' }, { status: 400 });
  }

  if (token !== env.ADMIN_TOKEN) {
    return json({ error: 'Chave editorial invalida.' }, { status: 401 });
  }

  return json(
    { ok: true },
    {
      headers: {
        'set-cookie': sessionCookie(token, 60 * 60 * 12),
      },
    },
  );
};

export const onRequestDelete = async () =>
  json(
    { ok: true },
    {
      headers: {
        'set-cookie': sessionCookie('', 0),
      },
    },
  );
