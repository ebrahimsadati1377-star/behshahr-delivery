import { NextResponse } from 'next/server';

export const ACCESS_COOKIE = 'bd_courier_access';
export const REFRESH_COOKIE = 'bd_courier_refresh';

export interface SessionPayload {
  user: { id: string; phone: string; role: string };
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresInSeconds: number;
}

export function setSessionCookies(response: NextResponse, session: SessionPayload) {
  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: session.accessTokenExpiresInSeconds,
  });
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: session.refreshTokenExpiresInSeconds,
  });
}

export function clearSessionCookies(response: NextResponse) {
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  };
  response.cookies.set(ACCESS_COOKIE, '', options);
  response.cookies.set(REFRESH_COOKIE, '', options);
}
