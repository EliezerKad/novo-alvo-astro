type Env = {
  ADMIN_TOKEN?: string;
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

  if (!url.pathname.startsWith('/admin')) {
    return next();
  }

  const token = env.ADMIN_TOKEN || '';
  const cookies = parseCookies(request.headers.get('cookie'));

  if (token && cookies.admin_session === token) {
    return next();
  }

  const loginUrl = new URL('/redacao/', url.origin);
  loginUrl.searchParams.set('next', `${url.pathname}${url.search}${url.hash}`);
  return Response.redirect(loginUrl.toString(), 302);
};
