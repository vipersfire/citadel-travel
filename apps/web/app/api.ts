import { errorText } from '@citadel/i18n';

export async function api(path: string, options: RequestInit = {}) {
  if (options.method && options.method !== 'GET' && options.body === undefined) options.body = '{}';
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.method && options.method !== 'GET')
    headers.set('Idempotency-Key', crypto.randomUUID());
  const r = await fetch(path, { ...options, headers });
  const data = await r.json();
  if (!r.ok) {
    const error = new Error(
      errorText(
        data.error?.code,
        data.error?.message,
        document.documentElement.lang === 'id' ? 'id' : 'en',
      ),
    ) as Error & { code?: string; details?: unknown };
    error.code = data.error?.code;
    error.details = data.error?.details;
    throw error;
  }
  return data;
}
export async function serverApi(request: Request, path: string, responseHeaders?: Headers) {
  const base = process.env.API_BASE_URL || process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  const r = await fetch(base + path, {
    headers: {
      Cookie: request.headers.get('cookie') || '',
      ...(request.headers.get('x-forwarded-for')
        ? { 'X-Forwarded-For': request.headers.get('x-forwarded-for')! }
        : {}),
    },
  });
  for (const cookie of r.headers.getSetCookie()) responseHeaders?.append('Set-Cookie', cookie);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Response(
      errorText(
        body.error?.code,
        body.error?.message,
        new URL(request.url).pathname.startsWith('/id') ? 'id' : 'en',
      ),
      { status: r.status },
    );
  }
  return r.json();
}
