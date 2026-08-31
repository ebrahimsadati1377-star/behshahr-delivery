import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend';
import { SessionPayload, setSessionCookies } from '../../../../lib/session';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const upstream = await backendFetch('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload = (await upstream.json().catch(() => ({}))) as Partial<SessionPayload> & Record<string, unknown>;

  if (!upstream.ok) {
    return NextResponse.json(payload, { status: upstream.status });
  }

  const session = payload as SessionPayload;
  if (session.user?.role !== 'COURIER') {
    return NextResponse.json({ message: 'این شماره حساب پیک فعال ندارد' }, { status: 403 });
  }

  const response = NextResponse.json({ user: session.user });
  setSessionCookies(response, session);
  return response;
}
