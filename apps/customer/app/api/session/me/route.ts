import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SessionPayload,
  clearSessionCookies,
  setSessionCookies,
} from '../../../../lib/session';

async function readMe(accessToken: string) {
  return backendFetch('/auth/me', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (accessToken) {
    const upstream = await readMe(accessToken);
    if (upstream.ok) {
      return NextResponse.json(await upstream.json());
    }
    if (upstream.status !== 401) {
      return NextResponse.json(await upstream.json().catch(() => ({})), {
        status: upstream.status,
      });
    }
  }

  if (!refreshToken) {
    const response = NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  const refreshed = await backendFetch('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });

  if (!refreshed.ok) {
    const response = NextResponse.json({ message: 'Session expired' }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  const session = (await refreshed.json()) as SessionPayload;
  const me = await readMe(session.accessToken);
  if (!me.ok) {
    const response = NextResponse.json({ message: 'Session refresh failed' }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  const response = NextResponse.json(await me.json());
  setSessionCookies(response, session);
  return response;
}
