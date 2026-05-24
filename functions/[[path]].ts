type Env = {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
};

const CANONICAL_HOST = 'portalnovoalvo.com.br';
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;

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

  if (env.ASSETS) return env.ASSETS.fetch(request);
  return next();
};
