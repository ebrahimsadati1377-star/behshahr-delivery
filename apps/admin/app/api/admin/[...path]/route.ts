import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend';
import { ACCESS_COOKIE, REFRESH_COOKIE, SessionPayload, clearSessionCookies, setSessionCookies } from '../../../../lib/session';

const allowedRoots = new Set(['orders', 'couriers', 'pricing-rules']);
const allowedMethods = new Set(['GET', 'POST']);

function upstreamPath(parts: string[]) {
  if (!parts.length || !allowedRoots.has(parts[0]) || parts.some(part => !/^[a-zA-Z0-9_-]+$/.test(part))) return null;
  return `/admin/${parts.join('/')}`;
}

async function callBackend(path: string, request: Request, accessToken: string) {
  const body = ['GET','HEAD'].includes(request.method) ? undefined : await request.text();
  return backendFetch(path, { method: request.method, body: body || undefined, headers: { authorization: `Bearer ${accessToken}` } });
}

async function handler(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!allowedMethods.has(request.method)) return NextResponse.json({ message:'Method not allowed' }, { status:405 });
  const { path: parts } = await context.params;
  const path = upstreamPath(parts);
  if (!path) return NextResponse.json({ message:'Not found' }, { status:404 });
  const store = await cookies();
  let accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!accessToken && !refreshToken) return NextResponse.json({ message:'Unauthenticated' }, { status:401 });
  let session: SessionPayload | null = null;
  async function refresh() {
    if (!refreshToken) return false;
    const upstream = await backendFetch('/auth/refresh', { method:'POST', body:JSON.stringify({ refreshToken }) });
    if (!upstream.ok) return false;
    session = await upstream.json() as SessionPayload;
    if (session.user.role !== 'ADMIN') return false;
    accessToken = session.accessToken;
    return true;
  }
  if (!accessToken && !(await refresh())) {
    const response = NextResponse.json({ message:'Session expired' }, { status:401 }); clearSessionCookies(response); return response;
  }
  let upstream = await callBackend(path, request.clone(), accessToken!);
  if (upstream.status === 401 && !session && await refresh()) upstream = await callBackend(path, request.clone(), accessToken!);
  if (upstream.status === 401) { const response = NextResponse.json({ message:'Session expired' }, { status:401 }); clearSessionCookies(response); return response; }
  const text = await upstream.text();
  const response = new NextResponse(text || null, { status:upstream.status, headers:{'content-type':upstream.headers.get('content-type') ?? 'application/json'} });
  if (session) setSessionCookies(response, session);
  return response;
}

export const GET = handler;
export const POST = handler;
