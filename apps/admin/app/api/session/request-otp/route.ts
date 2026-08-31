import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const upstream = await backendFetch('/auth/request-otp', { method: 'POST', body });
  const text = await upstream.text();
  return new NextResponse(text || null, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' } });
}
