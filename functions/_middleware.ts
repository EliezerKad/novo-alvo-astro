type Env = {
  ADMIN_TOKEN?: string;
};

const CANONICAL_HOST = 'portalnovoalvo.com.br';
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
const ROBOTS_HEADER = 'noindex, nofollow, noarchive';

const withRobotsHeader = (response: Response) => {
  const nextResponse = new Response(response.body, response);
  nextResponse.headers.set('X-Robots-Tag', ROBOTS_HEADER);
  return nextResponse;
};

const parseCookies = (header: string | null) =>
  Object.fromEntries(
    String(header || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );

export const onRequest = async ({
  request,
  env,
  next,
}: {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}) => {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.toLowerCase() || url.protocol.replace(':', '');

  if ((host === CANONICAL_HOST || host === `www.${CANONICAL_HOST}`) && (host !== CANONICAL_HOST || forwardedProto !== 'https')) {
    return Response.redirect(`${CANONICAL_ORIGIN}${url.pathname}${url.search}`, 301);
  }

  if (url.pathname.startsWith('/redacao') || url.pathname.startsWith('/api/admin')) {
    const response = await next();
    return withRobotsHeader(response);
  }

  if (!url.pathname.startsWith('/admin')) {
    return next();
  }

  const token = env.ADMIN_TOKEN || '';
  const cookies = parseCookies(request.headers.get('cookie'));

  if (token && cookies.admin_session === token) {
    const response = await next();
    return withRobotsHeader(response);
  }

  const loginUrl = new URL('/redacao/', url.origin);
  loginUrl.searchParams.set('next', `${url.pathname}${url.search}${url.hash}`);
  return new Response(null, {
    status: 302,
    headers: {
      Location: loginUrl.toString(),
      'X-Robots-Tag': ROBOTS_HEADER,
    },
  });
};
