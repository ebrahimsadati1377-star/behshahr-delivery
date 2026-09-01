import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { backendFetch } from '../../../../../../lib/backend';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SessionPayload,
  clearSessionCookies,
  setSessionCookies,
} from '../../../../../../lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function refreshSession(refreshToken: string): Promise<SessionPayload | null> {
  const refreshed = await backendFetch('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  if (!refreshed.ok) return null;
  return refreshed.json() as Promise<SessionPayload>;
}

function connect(id: string, accessToken: string) {
  return backendFetch(`/orders/${id}/stream`, {
    method: 'GET',
    headers: {
      accept: 'text/event-stream',
      authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  let refreshedSession: SessionPayload | null = null;

  if (!accessToken && refreshToken) {
    refreshedSession = await refreshSession(refreshToken);
    if (refreshedSession) accessToken = refreshedSession.accessToken;
  }

  if (!accessToken) {
    const response = NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  let upstream = await connect(id, accessToken);

  if (upstream.status === 401 && refreshToken && !refreshedSession) {
    refreshedSession = await refreshSession(refreshToken);
    if (!refreshedSession) {
      const response = NextResponse.json({ message: 'Session expired' }, { status: 401 });
      clearSessionCookies(response);
      return response;
    }
    upstream = await connect(id, refreshedSession.accessToken);
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    const response = new NextResponse(text || null, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
    if (refreshedSession) setSessionCookies(response, refreshedSession);
    return response;
  }

  const response = new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
  if (refreshedSession) setSessionCookies(response, refreshedSession);
  return response;
}
