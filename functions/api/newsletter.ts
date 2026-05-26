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

const titleCase = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : '');

const inferFirstName = (email: string) => {
  const local = clean(email.split('@')[0], 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const firstToken = local.split(/[._+-]+/).find(Boolean) || '';
  const names = new Set([
    'aline',
    'alisson',
    'allan',
    'amanda',
    'ana',
    'andresa',
    'bianca',
    'bruna',
    'bruno',
    'carol',
    'daniel',
    'diego',
    'fernanda',
    'gabriel',
    'joao',
    'jose',
    'julia',
    'juliana',
    'larissa',
    'lucas',
    'marcelo',
    'maria',
    'paulo',
    'rafael',
    'renata',
    'thiago',
  ]);
  if (names.has(firstToken)) return firstToken === 'joao' ? 'João' : titleCase(firstToken);
  return '';
};

const welcomeHtml = (origin: string, token: string, email: string) => {
  const firstName = inferFirstName(email);
  const greeting = firstName ? `Olá, ${firstName}.` : 'Olá.';
  const unsubscribeUrl = `${origin}/api/newsletter?unsubscribe=${encodeURIComponent(token)}`;
  return `
  <div style="margin:0;background:#f4f1ec;padding:0;font-family:Arial,Helvetica,sans-serif;color:#171717">
    <div style="max-width:680px;margin:0 auto;padding:34px 18px 28px">
      <div style="padding:22px 0 26px;text-align:center">
        <div style="display:inline-block;border-top:1px solid #d8d1c7;border-bottom:1px solid #d8d1c7;padding:13px 18px;font-size:15px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#8A1F2D">Portal Novo Alvo</div>
      </div>

      <div style="background:#fff;border:1px solid #e8e1d8;border-radius:22px;padding:34px 30px;box-shadow:0 18px 55px rgba(24,24,27,0.08)">
        <p style="margin:0 0 18px;font-size:16px;line-height:1.7">${greeting}</p>
        <h1 style="font-size:32px;line-height:1.05;margin:0 0 22px;letter-spacing:-0.04em;color:#101010">Bem-vindo ao Portal Novo Alvo</h1>

        <p style="margin:0 0 18px;font-size:16px;line-height:1.72">Você está recebendo este e-mail porque se cadastrou em uma de nossas redes ou demonstrou interesse em acompanhar o Portal Novo Alvo.</p>
        <p style="margin:0 0 18px;font-size:16px;line-height:1.72">O Novo Alvo nasceu para acompanhar o que muda o Brasil e o mundo sem transformar tudo em barulho. A ideia é simples: selecionar fatos relevantes, organizar contexto e entregar uma leitura rápida, clara e útil para quem precisa entender o que está acontecendo sem perder tempo no excesso de informação.</p>
        <p style="margin:0 0 18px;font-size:16px;line-height:1.72">Nossa curadoria olha com atenção para tecnologia, comportamento, saúde mental, cultura, economia, política, programas sociais, carreira e os movimentos que afetam a vida prática de quem trabalha, estuda, empreende, cuida de pessoas ou tenta simplesmente se manter bem informado.</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.72">A newsletter que você vai receber não será uma lista automática de links. Vamos priorizar assuntos que merecem contexto, explicar por que eles importam e indicar leituras do portal quando fizer sentido.</p>

        <div style="border-left:4px solid #8A1F2D;background:#f7f2ef;border-radius:0 16px 16px 0;padding:18px 18px;margin:28px 0">
          <p style="margin:0 0 10px;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#8A1F2D">O que esperar</p>
          <ul style="margin:0;padding-left:18px;color:#27272a;font-size:15px;line-height:1.75">
            <li>Um resumo enxuto dos temas mais importantes da semana</li>
            <li>Destaques por área, sem excesso de manchetes</li>
            <li>Contexto para tecnologia, saúde, cultura, trabalho e políticas públicas</li>
            <li>Links para matérias selecionadas quando elas realmente ajudarem a entender melhor o assunto</li>
          </ul>
        </div>

        <p style="margin:0 0 26px;font-size:16px;line-height:1.72">Neste primeiro envio, queremos só abrir a conversa. Se essa proposta fizer sentido para você, seja bem-vindo ao Portal Novo Alvo.</p>

        <p style="margin:0 0 4px">
          <a href="${origin}/" style="display:inline-block;background:#8A1F2D;color:#fff;text-decoration:none;font-weight:800;border-radius:999px;padding:14px 22px">Acessar o Portal Novo Alvo</a>
        </p>
      </div>

      <p style="font-size:12px;color:#77716a;line-height:1.65;margin:22px 4px 0;text-align:center">
        Você está recebendo este e-mail porque se cadastrou em uma de nossas redes.<br>
        Se não quiser mais receber nossas mensagens, pode
        <a href="${unsubscribeUrl}" style="color:#8A1F2D;text-decoration:underline">se descadastrar aqui</a>.
      </p>
    </div>
  </div>
`;
};

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
      html: welcomeHtml(origin, subscriber.unsub_token, subscriber.email),
      text:
        'Voce esta recebendo este e-mail porque se cadastrou em uma de nossas redes. ' +
        'O Portal Novo Alvo seleciona fatos relevantes, organiza contexto e entrega uma leitura rapida, clara e util. ' +
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
