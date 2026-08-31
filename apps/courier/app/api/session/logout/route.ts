import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend';
import { REFRESH_COOKIE, clearSessionCookies } from '../../../../lib/session';

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await backendFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
