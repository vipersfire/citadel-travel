function apiBase() {
  return process.env.API_BASE_URL || process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
}

async function proxy(request: Request) {
  const source = new URL(request.url);
  const upstream = new URL(source.pathname + source.search, apiBase());
  const headers = new Headers(request.headers);
  for (const name of [
    'connection',
    'content-length',
    'host',
    'keep-alive',
    'transfer-encoding',
    'upgrade',
  ])
    headers.delete(name);

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    redirect: 'manual',
    signal: request.signal,
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }

  return fetch(upstream, init);
}

export function loader({ request }: { request: Request }) {
  return proxy(request);
}

export function action({ request }: { request: Request }) {
  return proxy(request);
}
