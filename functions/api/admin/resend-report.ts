type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      all: <T = unknown>() => Promise<{ results?: T[] }>;
    };
  };
};

type Env = {
  ADMIN_TOKEN?: string;
  EDITORIAL_DB?: D1Database;
  RESEND_API_KEY?: string;
};

type ResendEmail = {
  id?: string;
  to?: string[];
  from?: string;
  subject?: string;
  created_at?: string;
  last_event?: string;
  scheduled_at?: string | null;
};

type SubscriberRow = {
  status?: string;
  total?: number;
};

type CampaignTotals = {
  total?: number;
  subscribed?: number;
  unsubscribed?: number;
  sent?: number;
  pending?: number;
  unsubscribed_after_send?: number;
};

type UnsubscribedRow = {
  email?: string;
  updated_at?: string;
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

const clean = (value: unknown, max = 1000) =>
  String(value || '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);

const requireAdmin = (request: Request, env: Env) => {
  if (!env.ADMIN_TOKEN) return json({ ok: false, error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-admin-token') || '';
  if (token !== env.ADMIN_TOKEN) return json({ ok: false, error: 'Token editorial invalido.' }, { status: 401 });
  return null;
};

const safeNumber = (value: unknown) => Number(value || 0) || 0;

const eventLabel = (event: string) => {
  const normalized = clean(event, 40).toLowerCase();
  if (!normalized) return 'unknown';
  if (normalized === 'email.opened') return 'opened';
  if (normalized === 'email.clicked') return 'clicked';
  if (normalized === 'email.delivered') return 'delivered';
  if (normalized === 'email.bounced') return 'bounced';
  if (normalized === 'email.complained') return 'complained';
  return normalized;
};

const resendFetch = async (apiKey: string, path: string) => {
  const response = await fetch(`https://api.resend.com${path}`, {
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      clean((data as { message?: string; error?: string } | null)?.message || (data as { error?: string } | null)?.error, 300) ||
      `Resend respondeu ${response.status}`;
    throw new Error(message);
  }
  return data as { data?: unknown[]; has_more?: boolean };
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const apiKey = clean(env.RESEND_API_KEY, 500);
  if (!apiKey) return json({ ok: false, error: 'RESEND_API_KEY nao configurada no Cloudflare.' }, { status: 503 });

  const url = new URL(request.url);
  const subjectFilter = clean(url.searchParams.get('subject'), 120).toLowerCase();

  try {
    const [emailsResponse, broadcastsResponse, subscriberTotals, campaignTotals, recentUnsubscribes] = await Promise.all([
      resendFetch(apiKey, '/emails'),
      resendFetch(apiKey, '/broadcasts').catch((error) => ({ data: [], error: error instanceof Error ? error.message : String(error) })),
      env.EDITORIAL_DB
        ? env.EDITORIAL_DB.prepare(
            `SELECT status, COUNT(*) AS total
               FROM newsletter_subscribers
              GROUP BY status`,
          )
            .bind()
            .all<SubscriberRow>()
            .catch(() => ({ results: [] }))
        : Promise.resolve({ results: [] }),
      env.EDITORIAL_DB
        ? env.EDITORIAL_DB.prepare(
            `SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'subscribed' THEN 1 ELSE 0 END) AS subscribed,
                SUM(CASE WHEN status = 'unsubscribed' THEN 1 ELSE 0 END) AS unsubscribed,
                SUM(CASE WHEN last_auto_response_at IS NOT NULL AND last_auto_response_at != '' THEN 1 ELSE 0 END) AS sent,
                SUM(CASE WHEN last_auto_response_at IS NULL OR last_auto_response_at = '' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'unsubscribed' AND last_auto_response_at IS NOT NULL AND last_auto_response_at != '' THEN 1 ELSE 0 END) AS unsubscribed_after_send
               FROM newsletter_subscribers`,
          )
            .bind()
            .first<CampaignTotals>()
            .catch(() => null)
        : Promise.resolve(null),
      env.EDITORIAL_DB
        ? env.EDITORIAL_DB.prepare(
            `SELECT email, updated_at
               FROM newsletter_subscribers
              WHERE status = 'unsubscribed'
                AND last_auto_response_at IS NOT NULL
                AND last_auto_response_at != ''
              ORDER BY updated_at DESC
              LIMIT 8`,
          )
            .bind()
            .all<UnsubscribedRow>()
            .catch(() => ({ results: [] }))
        : Promise.resolve({ results: [] }),
    ]);

    const rawEmails = Array.isArray(emailsResponse.data) ? (emailsResponse.data as ResendEmail[]) : [];
    const emails = rawEmails
      .map((email) => {
        const event = eventLabel(email.last_event || '');
        return {
          id: clean(email.id, 80),
          to: Array.isArray(email.to) ? email.to.map((item) => clean(item, 254)).filter(Boolean) : [],
          from: clean(email.from, 180),
          subject: clean(email.subject, 240),
          createdAt: clean(email.created_at, 80),
          scheduledAt: clean(email.scheduled_at, 80),
          lastEvent: event,
          opened: event === 'opened' || event === 'clicked',
          clicked: event === 'clicked',
        };
      })
      .filter((email) => !subjectFilter || email.subject.toLowerCase().includes(subjectFilter))
      .slice(0, 100);

    const eventCounts = emails.reduce<Record<string, number>>((counts, email) => {
      counts[email.lastEvent] = (counts[email.lastEvent] || 0) + 1;
      return counts;
    }, {});

    const subscribers = Object.fromEntries(
      (subscriberTotals.results || []).map((row) => [clean(row.status, 40) || 'unknown', safeNumber(row.total)]),
    );

    return json({
      ok: true,
      emails: {
        total: emails.length,
        hasMore: Boolean(emailsResponse.has_more),
        eventCounts,
        rows: emails,
      },
      broadcasts: {
        rows: Array.isArray(broadcastsResponse.data) ? broadcastsResponse.data : [],
        error: 'error' in broadcastsResponse ? broadcastsResponse.error : '',
      },
      subscribers,
      campaign: {
        total: safeNumber(campaignTotals?.total),
        subscribed: safeNumber(campaignTotals?.subscribed),
        unsubscribed: safeNumber(campaignTotals?.unsubscribed),
        sent: safeNumber(campaignTotals?.sent),
        pending: safeNumber(campaignTotals?.pending),
        unsubscribedAfterSend: safeNumber(campaignTotals?.unsubscribed_after_send),
        unsubscribeRate:
          safeNumber(campaignTotals?.sent) > 0
            ? Number(((safeNumber(campaignTotals?.unsubscribed_after_send) / safeNumber(campaignTotals?.sent)) * 100).toFixed(2))
            : 0,
        recentUnsubscribes: (recentUnsubscribes.results || []).map((row) => ({
          email: clean(row.email, 254),
          updatedAt: clean(row.updated_at, 80),
        })),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: 'Nao foi possivel consultar o Resend.',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
};
