type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      all: <T = unknown>() => Promise<{ results?: T[] }>;
    };
  };
};

type Env = {
  EDITORIAL_DB?: D1Database;
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

const clean = (value: unknown, max = 2000) =>
  String(value || '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);

const requireAdmin = (request: Request, env: Env) => {
  if (!env.ADMIN_TOKEN) return json({ error: 'ADMIN_TOKEN nao configurado.' }, { status: 503 });
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || request.headers.get('x-admin-token') || '';
  if (token !== env.ADMIN_TOKEN) return json({ error: 'Token editorial invalido.' }, { status: 401 });
  return null;
};

const safeNumber = (value: unknown) => Number(value || 0) || 0;

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const db = env.EDITORIAL_DB;
  if (!db) return json({ error: 'Binding EDITORIAL_DB nao configurado.' }, { status: 503 });

  const url = new URL(request.url);
  const minSources = Math.max(1, Math.min(20, Number(url.searchParams.get('minSources') || 5)));
  const now = new Date().toISOString();

  try {
    const [sourceTotals, sourceCategories, pitchTotals, pitchStatuses, pitchCategories, visibleNew, visibleCurrent] =
      await Promise.all([
        db
          .prepare(
            `SELECT COUNT(*) AS total,
                    SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active
               FROM editorial_sources`,
          )
          .bind()
          .first<{ total?: number; active?: number }>(),
        db
          .prepare(
            `SELECT category,
                    COUNT(*) AS total,
                    SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active
               FROM editorial_sources
              GROUP BY category
              ORDER BY active DESC, total DESC, category ASC
              LIMIT 24`,
          )
          .bind()
          .all<{ category?: string; total?: number; active?: number }>(),
        db.prepare(`SELECT COUNT(*) AS total FROM editorial_pitches`).bind().first<{ total?: number }>(),
        db
          .prepare(
            `SELECT status, COUNT(*) AS total
               FROM editorial_pitches
              GROUP BY status
              ORDER BY total DESC`,
          )
          .bind()
          .all<{ status?: string; total?: number }>(),
        db
          .prepare(
            `SELECT category, status, COUNT(*) AS total
               FROM editorial_pitches
              WHERE status != 'dismissed'
              GROUP BY category, status
              ORDER BY total DESC
              LIMIT 60`,
          )
          .bind()
          .all<{ category?: string; status?: string; total?: number }>(),
        db
          .prepare(
            `SELECT COUNT(*) AS total
               FROM editorial_pitches
              WHERE status = 'new'
                AND source_count >= ?
                AND (expires_at IS NULL OR expires_at = '' OR expires_at >= ?)`,
          )
          .bind(minSources, now)
          .first<{ total?: number }>(),
        db
          .prepare(
            `SELECT status, COUNT(*) AS total
               FROM editorial_pitches
              WHERE source_count >= ?
                AND (expires_at IS NULL OR expires_at = '' OR expires_at >= ? OR status IN ('queued', 'converted'))
              GROUP BY status`,
          )
          .bind(minSources, now)
          .all<{ status?: string; total?: number }>(),
      ]);

    const statusCounts = Object.fromEntries(
      (pitchStatuses.results || []).map((row) => [clean(row.status, 40) || 'sem_status', safeNumber(row.total)]),
    );
    const visibleStatusCounts = Object.fromEntries(
      (visibleCurrent.results || []).map((row) => [clean(row.status, 40) || 'sem_status', safeNumber(row.total)]),
    );

    return json({
      minSources,
      sources: {
        total: safeNumber(sourceTotals?.total),
        active: safeNumber(sourceTotals?.active),
        categories: sourceCategories.results || [],
      },
      pitches: {
        total: safeNumber(pitchTotals?.total),
        visibleNew: safeNumber(visibleNew?.total),
        statuses: statusCounts,
        visibleStatuses: visibleStatusCounts,
        categories: pitchCategories.results || [],
      },
    });
  } catch (error) {
    return json(
      {
        error: 'Nao foi possivel consolidar estatisticas editoriais.',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
};
