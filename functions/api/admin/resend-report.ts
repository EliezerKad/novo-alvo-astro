type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      all: <T = unknown>() => Promise<{ results?: T[] }>;
      run: () => Promise<unknown>;
    };
    run: () => Promise<unknown>;
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

type EventCountRow = {
  event?: string;
  total?: number;
};

type EventRow = {
  email?: string;
  event?: string;
  link_url?: string;
  created_at?: string;
};

type EngagementTotals = {
  sent?: number;
  delivered?: number;
  opened?: number;
  clicked?: number;
  bounced?: number;
  complained?: number;
  delivery_delayed?: number;
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

type ResendListResponse = { data?: unknown[]; has_more?: boolean };

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
  return data as ResendListResponse;
};

const resendFetchPages = async (apiKey: string, path: string, maxItems = 700) => {
  const all: unknown[] = [];
  let after = '';
  let hasMore = false;

  for (let page = 0; page < Math.ceil(maxItems / 100); page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const response = await resendFetch(apiKey, `${path}${separator}limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`);
    const data = Array.isArray(response.data) ? response.data : [];
    all.push(...data);
    hasMore = Boolean(response.has_more);
    const last = data[data.length - 1] as { id?: string } | undefined;
    after = clean(last?.id, 120);
    if (!hasMore || !after || all.length >= maxItems) break;
  }

  return { data: all.slice(0, maxItems), has_more: hasMore && all.length >= maxItems };
};

const ensureTables = async (db: D1Database) => {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS newsletter_events (
        id TEXT PRIMARY KEY,
        resend_email_id TEXT,
        broadcast_id TEXT,
        campaign TEXT,
        email TEXT,
        event TEXT NOT NULL,
        subject TEXT,
        link_url TEXT,
        raw_payload TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS newsletter_sends (
        id TEXT PRIMARY KEY,
        resend_email_id TEXT UNIQUE,
        email TEXT NOT NULL,
        subject TEXT,
        campaign TEXT,
        provider_status TEXT NOT NULL DEFAULT 'sent',
        last_event TEXT,
        sent_at TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const apiKey = clean(env.RESEND_API_KEY, 500);
  if (!apiKey) return json({ ok: false, error: 'RESEND_API_KEY nao configurada no Cloudflare.' }, { status: 503 });

  const url = new URL(request.url);
  const subjectFilter = clean(url.searchParams.get('subject'), 120).toLowerCase();
  if (env.EDITORIAL_DB) await ensureTables(env.EDITORIAL_DB).catch(() => null);

  try {
    const [
      emailsResponse,
      broadcastsResponse,
      subscriberTotals,
      campaignTotals,
      recentUnsubscribes,
      localEventCounts,
      localEngagementTotals,
      recentEngagement,
    ] = await Promise.all([
      resendFetchPages(apiKey, '/emails', 700),
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
      env.EDITORIAL_DB
        ? env.EDITORIAL_DB.prepare(
            `SELECT event, COUNT(*) AS total
               FROM newsletter_events
              GROUP BY event`,
          )
            .bind()
            .all<EventCountRow>()
            .catch(() => ({ results: [] }))
        : Promise.resolve({ results: [] }),
      env.EDITORIAL_DB
        ? env.EDITORIAL_DB.prepare(
            `SELECT
                COUNT(*) AS sent,
                SUM(CASE WHEN last_event = 'delivered' THEN 1 ELSE 0 END) AS delivered,
                SUM(CASE WHEN last_event = 'opened' THEN 1 ELSE 0 END) AS opened,
                SUM(CASE WHEN last_event = 'clicked' THEN 1 ELSE 0 END) AS clicked,
                SUM(CASE WHEN last_event = 'bounced' THEN 1 ELSE 0 END) AS bounced,
                SUM(CASE WHEN last_event = 'complained' THEN 1 ELSE 0 END) AS complained,
                SUM(CASE WHEN last_event = 'delivery_delayed' THEN 1 ELSE 0 END) AS delivery_delayed
               FROM newsletter_sends`,
          )
            .bind()
            .first<EngagementTotals>()
            .catch(() => null)
        : Promise.resolve(null),
      env.EDITORIAL_DB
        ? env.EDITORIAL_DB.prepare(
            `SELECT email, event, link_url, created_at
               FROM newsletter_events
              WHERE event IN ('opened', 'clicked')
              ORDER BY created_at DESC
              LIMIT 30`,
          )
            .bind()
            .all<EventRow>()
            .catch(() => ({ results: [] }))
        : Promise.resolve({ results: [] }),
    ]);

    const rawEmails = Array.isArray(emailsResponse.data) ? (emailsResponse.data as ResendEmail[]) : [];
    const normalizedEmails = rawEmails
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
      .filter((email) => !subjectFilter || email.subject.toLowerCase().includes(subjectFilter));

    const eventCounts = normalizedEmails.reduce<Record<string, number>>((counts, email) => {
      counts[email.lastEvent] = (counts[email.lastEvent] || 0) + 1;
      return counts;
    }, {});
    const emails = normalizedEmails.slice(0, 100);
    const localEvents = Object.fromEntries(
      (localEventCounts.results || []).map((row) => [clean(row.event, 60) || 'unknown', safeNumber(row.total)]),
    );
    const localEngagement = {
      sent: safeNumber(localEngagementTotals?.sent),
      delivered: safeNumber(localEngagementTotals?.delivered),
      opened: safeNumber(localEngagementTotals?.opened),
      clicked: safeNumber(localEngagementTotals?.clicked),
      bounced: safeNumber(localEngagementTotals?.bounced),
      complained: safeNumber(localEngagementTotals?.complained),
      deliveryDelayed: safeNumber(localEngagementTotals?.delivery_delayed),
      openRate:
        safeNumber(localEngagementTotals?.sent) > 0
          ? Number(((safeNumber(localEngagementTotals?.opened) / safeNumber(localEngagementTotals?.sent)) * 100).toFixed(2))
          : 0,
      clickRate:
        safeNumber(localEngagementTotals?.sent) > 0
          ? Number(((safeNumber(localEngagementTotals?.clicked) / safeNumber(localEngagementTotals?.sent)) * 100).toFixed(2))
          : 0,
    };

    const subscribers = Object.fromEntries(
      (subscriberTotals.results || []).map((row) => [clean(row.status, 40) || 'unknown', safeNumber(row.total)]),
    );

    return json({
      ok: true,
      emails: {
        total: normalizedEmails.length,
        hasMore: Boolean(emailsResponse.has_more),
        eventCounts,
        localEvents,
        localEngagement,
        recentEngagement: (recentEngagement.results || []).map((row) => ({
          email: clean(row.email, 254),
          event: clean(row.event, 60),
          linkUrl: clean(row.link_url, 1000),
          createdAt: clean(row.created_at, 80),
        })),
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
