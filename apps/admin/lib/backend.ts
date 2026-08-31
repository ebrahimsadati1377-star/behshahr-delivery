const fallbackApiUrl = 'http://127.0.0.1:4000/api';

export function backendUrl(path: string): string {
  const base = (process.env.API_INTERNAL_URL ?? fallbackApiUrl).replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function backendFetch(path: string, init: RequestInit = {}) {
  return fetch(backendUrl(path), {
    ...init,
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}
