type R2ObjectBody = {
  body: ReadableStream;
  writeHttpMetadata?: (headers: Headers) => void;
};

type R2Bucket = {
  get: (key: string) => Promise<R2ObjectBody | null>;
};

type Env = {
  MEDIA_BUCKET?: R2Bucket;
};

const cleanKey = (value: unknown) =>
  String(value || '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/')
    .trim();

const getKey = (path: unknown) => {
  const key = Array.isArray(path) ? path.map(cleanKey).join('/') : cleanKey(path);
  if (!key || key.includes('..') || key.startsWith('/')) return '';
  return key;
};

const serveMedia = async ({ params, env }: { params: { path?: string | string[] }; env: Env }) => {
  if (!env.MEDIA_BUCKET) return new Response('Media bucket not configured', { status: 503 });

  const key = getKey(params.path);
  if (!key) return new Response('Not found', { status: 404 });

  const object = await env.MEDIA_BUCKET.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata?.(headers);
  if (!headers.has('content-type')) headers.set('content-type', 'image/jpeg');
  if (!headers.has('cache-control')) headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
};

export const onRequestGet = serveMedia;
export const onRequestHead = async (context: { params: { path?: string | string[] }; env: Env }) => {
  const response = await serveMedia(context);
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
