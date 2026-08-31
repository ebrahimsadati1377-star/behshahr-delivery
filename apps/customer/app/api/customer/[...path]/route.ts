import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SessionPayload,
  clearSessionCookies,
  setSessionCookies,
} from '../../../../lib/session';

const allowedRoots = new Set(['addresses', 'quotes', 'orders']);
const allowedMethods = new Set(['GET', 'POST', 'PATCH', 'DELETE']);

function upstreamPath(parts: string[]): string | null {
  if (parts.length === 0 || !allowedRoots.has(parts[0])) return null;
  if (parts.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) return null;
  return `/${parts.join('/')}`;
}

async function callBackend(path: string, request: NextRequest, accessToken: string) {
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
  return backendFetch(path, {
    method: request.method,
    body: body || undefined,
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

async function toResponse(upstream: Response) {
  const text = await upstream.text();
  const contentType = upstream.headers.get('content-type') ?? 'application/json';
  return new NextResponse(text || null, {
    status: upstream.status,
    headers: { 'content-type': contentType },
  });
}

async function handler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  if (!allowedMethods.has(request.method)) {
    return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
  }

  const { path: parts } = await context.params;
  const path = upstreamPath(parts);
  if (!path) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  let refreshedSession: SessionPayload | null = null;

  if (!accessToken && refreshToken) {
    const refreshed = await backendFetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    if (!refreshed.ok) {
      const response = NextResponse.json({ message: 'Session expired' }, { status: 401 });
      clearSessionCookies(response);
      return response;
    }
    refreshedSession = (await refreshed.json()) as SessionPayload;
    accessToken = refreshedSession.accessToken;
  }

  let upstream = await callBackend(path, request.clone(), accessToken!);

  if (upstream.status === 401 && refreshToken && !refreshedSession) {
    const refreshed = await backendFetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (!refreshed.ok) {
      const response = NextResponse.json({ message: 'Session expired' }, { status: 401 });
      clearSessionCookies(response);
      return response;
    }

    refreshedSession = (await refreshed.json()) as SessionPayload;
    upstream = await callBackend(path, request.clone(), refreshedSession.accessToken);
  }

  const response = await toResponse(upstream);
  if (refreshedSession) setSessionCookies(response, refreshedSession);
  return response;
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
