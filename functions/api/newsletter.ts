type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      run: () => Promise<unknown>;
    };
  };
};

type Env = {
  EDITORIAL_DB?: D1Database;
  RESEND_API_KEY?: string;
  NEWSLETTER_FROM?: string;
  NEWSLETTER_REPLY_TO?: string;
};

type Subscriber = {
  id: string;
  email: string;
  status: string;
  unsub_token: string;
  last_auto_response_at?: string;
};

type EmailResult = {
  sent: boolean;
  reason: string;
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

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);

const welcomeHtml = (origin: string, token: string) => `
  <div style="font-family:Arial,sans-serif;color:#18181b;line-height:1.55;max-width:620px;margin:0 auto;padding:24px">
    <h1 style="font-size:28px;line-height:1.05;margin:0 0 16px">Bem-vindo ao Portal Novo Alvo</h1>
    <p>Obrigado por assinar a newsletter do Portal Novo Alvo.</p>
    <p>A ideia aqui e simples: um briefing curto, direto e editorialmente cuidado, com os fatos que merecem sua atencao antes do ruido tomar conta.</p>
    <p>Enquanto ajustamos a cadencia, voce ja esta na lista.</p>
    <p style="margin-top:24px">
      <a href="${origin}/" style="color:#8A1F2D;font-weight:700">Acessar o portal</a>
    </p>
    <p style="font-size:12px;color:#71717a;margin-top:32px">
      Se voce nao pediu essa inscricao, ignore este e-mail ou use este link para sair:
      <a href="${origin}/api/newsletter?unsubscribe=${encodeURIComponent(token)}" style="color:#71717a">cancelar inscricao</a>.
    </p>
  </div>
`;

const sendWelcomeEmail = async (env: Env, origin: string, subscriber: Subscriber): Promise<EmailResult> => {
  const apiKey = clean(env.RESEND_API_KEY, 500);
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY ausente' };

  const from = clean(env.NEWSLETTER_FROM, 180) || 'Portal Novo Alvo <newsletter@portalnovoalvo.com.br>';
  const replyTo = clean(env.NEWSLETTER_REPLY_TO, 180) || 'contato@portalnovoalvo.com.br';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: subscriber.email,
      reply_to: replyTo,
      subject: 'Bem-vindo ao Portal Novo Alvo',
      html: welcomeHtml(origin, subscriber.unsub_token),
      text:
        'Obrigado por assinar a newsletter do Portal Novo Alvo. Voce ja esta na lista. ' +
        `Para cancelar: ${origin}/api/newsletter?unsubscribe=${encodeURIComponent(subscriber.unsub_token)}`,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    return { sent: false, reason: clean((data as { message?: string }).message || response.status, 300) };
  }

  return { sent: true, reason: '' };
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const db = env.EDITORIAL_DB;
  if (!db) return json({ ok: false, error: 'Banco nao configurado.' }, { status: 503 });

  const url = new URL(request.url);
  const token = clean(url.searchParams.get('unsubscribe'), 120);
  if (!token) return json({ ok: false, error: 'Parametro ausente.' }, { status: 400 });

  const now = new Date().toISOString();
  await db
    .prepare("UPDATE newsletter_subscribers SET status = 'unsubscribed', updated_at = ? WHERE unsub_token = ?")
    .bind(now, token)
    .run();

  return new Response('Inscricao cancelada.', {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const db = env.EDITORIAL_DB;
  if (!db) return json({ ok: false, error: 'Banco nao configurado.' }, { status: 503 });

  const payload = (await request.json().catch(() => null)) as { email?: string; sourcePath?: string } | null;
  const email = clean(payload?.email, 254).toLowerCase();
  if (!isEmail(email)) return json({ ok: false, error: 'Informe um e-mail valido.' }, { status: 400 });

  const now = new Date().toISOString();
  const existing = await db
    .prepare('SELECT id, email, status, unsub_token, last_auto_response_at FROM newsletter_subscribers WHERE email = ? LIMIT 1')
    .bind(email)
    .first<Subscriber>();

  const subscriber: Subscriber = existing || {
    id: crypto.randomUUID(),
    email,
    status: 'subscribed',
    unsub_token: crypto.randomUUID().replace(/-/g, ''),
  };

  await db
    .prepare(
      `INSERT INTO newsletter_subscribers (
        id, email, status, source_path, user_agent, unsub_token, created_at, updated_at, confirmed_at, last_auto_response_at
      ) VALUES (?, ?, 'subscribed', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        status = 'subscribed',
        source_path = excluded.source_path,
        user_agent = excluded.user_agent,
        updated_at = excluded.updated_at,
        confirmed_at = COALESCE(newsletter_subscribers.confirmed_at, excluded.confirmed_at)`,
    )
    .bind(
      subscriber.id,
      email,
      clean(payload?.sourcePath || new URL(request.url).pathname, 300),
      clean(request.headers.get('user-agent'), 500),
      subscriber.unsub_token,
      now,
      now,
      now,
      subscriber.last_auto_response_at || '',
    )
    .run();

  let emailResult: EmailResult = { sent: false, reason: 'ja enviado anteriormente' };
  if (!subscriber.last_auto_response_at) {
    emailResult = await sendWelcomeEmail(env, new URL(request.url).origin, subscriber).catch((error) => ({
      sent: false,
      reason: error instanceof Error ? error.message : 'falha no envio',
    }));
    if (emailResult.sent) {
      await db
        .prepare('UPDATE newsletter_subscribers SET last_auto_response_at = ?, updated_at = ? WHERE email = ?')
        .bind(now, now, email)
        .run();
    }
  }

  return json({
    ok: true,
    subscribed: true,
    emailSent: emailResult.sent,
    emailPending: !emailResult.sent,
    reason: emailResult.sent ? '' : emailResult.reason,
  });
};
