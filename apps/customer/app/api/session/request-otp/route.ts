import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../../lib/backend';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const upstream = await backendFetch('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload = await upstream.json().catch(() => ({}));
  return NextResponse.json(payload, { status: upstream.status });
}
