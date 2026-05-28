import { welcomeHtml } from '../newsletter';

type D1Result<T> = {
  results?: T[];
};

type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      all: <T = unknown>() => Promise<D1Result<T>>;
      run: () => Promise<unknown>;
    };
  };
};

type Env = {
  ADMIN_TOKEN?: string;
  EDITORIAL_DB?: D1Database;
  RESEND_API_KEY?: string;
  NEWSLETTER_FROM?: string;
  NEWSLETTER_REPLY_TO?: string;
};

type Subscriber = {
  email: string;
  unsub_token: string;
};

type ResendBatchResponse = {
  data?: Array<{ id?: string }>;
  message?: string;
  error?: { message?: string };
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

const clean = (value: unknown, max = 500) =>
  String(value || '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);

const requireAdmin = (request: Request, env: Env) => {
  const expected = clean(env.ADMIN_TOKEN, 500);
  if (!expected) return json({ ok: false, error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });

  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-admin-token') || '';
  if (token !== expected) return json({ ok: false, error: 'Token editorial invalido.' }, { status: 401 });

  return null;
};

const welcomeText = (origin: string, token: string) =>
  [
    'O Novo Alvo nasceu para ser um portal de informacao rapida, precisa e sem ruido.',
    'A gente reune o que importa, explica com contexto e entrega uma leitura que respeita o seu tempo.',
    'Tambem somos um portal colaborativo. Se voce trabalha com comunicacao, acompanha um tema relevante ou quer compartilhar uma pauta, historia, fonte ou olhar que mereca espaco, a gente quer ouvir.',
    `Acesse o portal: ${origin}/`,
    `Para cancelar: ${origin}/api/newsletter?unsubscribe=${encodeURIComponent(token)}`,
  ].join('\n\n');

const parseJson = (value: string): ResendBatchResponse => {
  try {
    return value ? (JSON.parse(value) as ResendBatchResponse) : {};
  } catch {
    return { message: value };
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = env.EDITORIAL_DB;
  if (!db) return json({ ok: false, error: 'Banco nao configurado.' }, { status: 503 });

  const apiKey = clean(env.RESEND_API_KEY, 500);
  if (!apiKey) return json({ ok: false, error: 'RESEND_API_KEY ausente.' }, { status: 503 });

  const payload = (await request.json().catch(() => ({}))) as {
    offset?: number;
    limit?: number;
    dryRun?: boolean;
    onlyUnsent?: boolean;
    origin?: string;
  };
  const offset = Math.max(0, Math.floor(Number(payload.offset || 0)));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(payload.limit || 100))));
  const dryRun = Boolean(payload.dryRun);
  const onlyUnsent = Boolean(payload.onlyUnsent);
  const origin = clean(payload.origin, 200) || new URL(request.url).origin;
  const from = clean(env.NEWSLETTER_FROM, 180) || 'Portal Novo Alvo <newsletter@portalnovoalvo.com.br>';
  const replyTo = clean(env.NEWSLETTER_REPLY_TO, 180) || 'contato@portalnovoalvo.com.br';

  const subscribers = await db
    .prepare(
      `SELECT email, unsub_token
       FROM newsletter_subscribers
       WHERE email IS NOT NULL
         AND email != ''
         ${onlyUnsent ? "AND (last_auto_response_at IS NULL OR last_auto_response_at = '')" : ''}
       ORDER BY lower(email)
       LIMIT ? OFFSET ?`,
    )
    .bind(limit, offset)
    .all<Subscriber>();

  const contacts = subscribers.results || [];
  if (!contacts.length) return json({ ok: true, sent: 0, offset, limit, onlyUnsent, done: true });

  if (dryRun) {
    return json({
      ok: true,
      dryRun: true,
      offset,
      limit,
      onlyUnsent,
      count: contacts.length,
      first: contacts[0]?.email,
      last: contacts[contacts.length - 1]?.email,
    });
  }

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(
        contacts.map((subscriber) => ({
          from,
          to: [subscriber.email],
          reply_to: replyTo,
          subject: 'O que importa, do jeito que dá vontade de ler',
          html: welcomeHtml(origin, subscriber.unsub_token, subscriber.email),
          text: welcomeText(origin, subscriber.unsub_token),
          tags: [
            { name: 'kind', value: 'welcome' },
            { name: 'campaign', value: 'first_contact_2026_05_28' },
          ],
        })),
      ),
    });
  } catch (error) {
    return json(
      {
        ok: false,
        offset,
        limit,
        onlyUnsent,
        sent: 0,
        error: clean(error instanceof Error ? error.message : error, 500),
      },
      { status: 502 },
    );
  }

  const responseText = await response.text().catch(() => '');
  const data = parseJson(responseText);
  if (!response.ok) {
    return json(
      {
        ok: false,
        offset,
        limit,
        onlyUnsent,
        sent: 0,
        status: response.status,
        error: clean(data.error?.message || data.message || responseText || 'Falha no Resend', 500),
      },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();
  for (const subscriber of contacts) {
    await db
      .prepare('UPDATE newsletter_subscribers SET last_auto_response_at = ?, updated_at = ? WHERE email = ?')
      .bind(now, now, subscriber.email)
      .run();
  }

  return json({
    ok: true,
    offset,
    limit,
    onlyUnsent,
    sent: contacts.length,
    resendIds: (data.data || []).length,
    first: contacts[0]?.email,
    last: contacts[contacts.length - 1]?.email,
    done: contacts.length < limit,
  });
};
