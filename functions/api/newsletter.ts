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
  resendId?: string;
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
  if (names.has(firstToken)) return firstToken === 'joao' ? 'Jo&atilde;o' : titleCase(firstToken);
  return '';
};

export const welcomeHtml = (origin: string, token: string, email: string) => {
  const firstName = inferFirstName(email);
  const greeting = firstName ? `Ol&aacute;, ${firstName}.` : 'Ol&aacute;.';
  const unsubscribeUrl = `${origin}/api/newsletter?unsubscribe=${encodeURIComponent(token)}`;
  const logoSymbolUrl = `${origin}/favicon.svg`;

  return `
  <div style="margin:0;background:#f6f3ee;padding:0;font-family:Arial,Helvetica,sans-serif;color:#171717">
    <div style="max-width:680px;margin:0 auto;padding:42px 18px 32px">
      <div style="padding:8px 0 34px;text-align:center">
        <div style="display:inline-block;text-align:center">
          <div style="display:inline-table;vertical-align:middle">
            <span style="display:inline-block;width:34px;height:34px;vertical-align:middle;margin-right:10px">
              <img src="${logoSymbolUrl}" width="34" height="34" alt="" style="display:block;border:0;outline:none;text-decoration:none">
            </span>
            <span style="display:inline-block;vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1;font-weight:900;letter-spacing:-0.05em;color:#141414">NOVO ALVO</span>
          </div>
          <div style="margin-top:7px;font-size:9px;line-height:1;font-weight:900;letter-spacing:0.32em;text-transform:uppercase;color:#9b948d">Fatos e Impacto 24h</div>
        </div>
      </div>

      <div style="background:#fff;border:1px solid #e8e1d8;border-radius:24px;padding:42px 36px;box-shadow:0 18px 55px rgba(24,24,27,0.08)">
        <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#2f2f2f">${greeting}</p>
        <h1 style="font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:1.12;margin:0 0 28px;letter-spacing:-0.04em;color:#101010">Bem-vindo ao Portal Novo Alvo</h1>

        <p style="margin:0 0 20px;font-size:16px;line-height:1.78;color:#2b2b2b">O Novo Alvo nasceu para ser um portal de informa&ccedil;&atilde;o r&aacute;pida, precisa e sem ru&iacute;do.</p>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.78;color:#2b2b2b">A gente sabe como &eacute; f&aacute;cil se perder entre manchetes apressadas, opini&atilde;o disfar&ccedil;ada de not&iacute;cia e conte&uacute;do feito s&oacute; para disputar aten&ccedil;&atilde;o. Por isso, nossa proposta &eacute; simples: reunir o que importa, explicar com contexto e entregar uma leitura que respeite o seu tempo.</p>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.78;color:#2b2b2b">Aqui, not&iacute;cia n&atilde;o precisa vir com gritaria. Pode ser direta, bem apurada e ainda assim ter linguagem leve, visual limpo e um pouco de respiro.</p>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.78;color:#2b2b2b">O portal acompanha os assuntos que atravessam a vida real: Brasil, cultura, tecnologia, comportamento, sa&uacute;de, economia, entretenimento e tudo aquilo que ajuda a entender melhor o mundo sem precisar morar dentro do feed.</p>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.78;color:#2b2b2b">Tamb&eacute;m somos um portal colaborativo. Se voc&ecirc; trabalha com comunica&ccedil;&atilde;o, acompanha de perto algum tema relevante ou quer compartilhar uma pauta, hist&oacute;ria, fonte ou olhar que mere&ccedil;a espa&ccedil;o, a gente quer ouvir.</p>
        <p style="margin:0 0 30px;font-size:16px;line-height:1.78;color:#2b2b2b">A ideia n&atilde;o &eacute; correr atr&aacute;s de cada tend&ecirc;ncia, nem repetir o que aparece em todo lugar. &Eacute; olhar para os fatos com cuidado, escolher boas pautas e transformar informa&ccedil;&atilde;o em uma leitura &uacute;til, clara e poss&iacute;vel de acompanhar.</p>

        <p style="margin:0">
          <a href="${origin}/" style="display:inline-block;background:#8A1F2D;color:#fff;text-decoration:none;font-weight:800;border-radius:999px;padding:15px 22px">Acessar o portal</a>
        </p>
      </div>

      <div style="padding:30px 0 12px;text-align:center">
        <div style="display:inline-table;vertical-align:middle">
          <span style="display:inline-block;width:24px;height:24px;vertical-align:middle;margin-right:8px">
            <img src="${logoSymbolUrl}" width="24" height="24" alt="" style="display:block;border:0;outline:none;text-decoration:none">
          </span>
          <span style="display:inline-block;vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1;font-weight:900;letter-spacing:-0.05em;color:#222">NOVO ALVO</span>
        </div>
        <div style="margin-top:8px;font-size:9px;line-height:1;font-weight:900;letter-spacing:0.28em;text-transform:uppercase;color:#9b948d">Fatos e Impacto 24h</div>
      </div>

      <p style="font-size:12px;color:#77716a;line-height:1.7;margin:16px 4px 0;text-align:center">
        Voc&ecirc; est&aacute; recebendo este e-mail porque se cadastrou em uma de nossas redes.<br>
        Se n&atilde;o quiser mais receber nossas mensagens, pode
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
      subject: 'O que importa, do jeito que dá vontade de ler',
      html: welcomeHtml(origin, subscriber.unsub_token, subscriber.email),
      text:
        'O Novo Alvo nasceu para ser um portal de informacao rapida, precisa e sem ruido. ' +
        'Somos um portal colaborativo: se voce trabalha com comunicacao, acompanha algum tema relevante ou quer compartilhar uma pauta, a gente quer ouvir. ' +
        `Para cancelar: ${origin}/api/newsletter?unsubscribe=${encodeURIComponent(subscriber.unsub_token)}`,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    return { sent: false, reason: clean((data as { message?: string }).message || response.status, 300) };
  }

  const data = (await response.json().catch(() => ({}))) as { id?: string; data?: { id?: string } };
  return { sent: true, reason: '', resendId: clean(data.id || data.data?.id, 120) };
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
      if (emailResult.resendId) {
        await db
          .prepare(
            `INSERT INTO newsletter_sends (
              id, resend_email_id, email, subject, campaign, provider_status, last_event, sent_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'sent', 'sent', ?, ?)
            ON CONFLICT(resend_email_id) DO UPDATE SET
              email = excluded.email,
              subject = excluded.subject,
              campaign = excluded.campaign,
              provider_status = excluded.provider_status,
              last_event = COALESCE(newsletter_sends.last_event, excluded.last_event),
              updated_at = excluded.updated_at`,
          )
          .bind(
            emailResult.resendId,
            emailResult.resendId,
            email,
            'O que importa, do jeito que da vontade de ler',
            'direct_signup',
            now,
            now,
          )
          .run()
          .catch(() => null);
      }
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
