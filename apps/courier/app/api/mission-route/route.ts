import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '../../../lib/backend';
import { ACCESS_COOKIE } from '../../../lib/session';

export const dynamic = 'force-dynamic';

type Coordinate = { latitude: number; longitude: number };
type Order = {
  id: string;
  status: string;
  pickupSnapshot: Record<string, unknown>;
  dropoffSnapshot: Record<string, unknown>;
};
type CourierProfile = {
  lastLatitude: number | string | null;
  lastLongitude: number | string | null;
  lastSeenAt: string | null;
};

function coordinate(value: unknown, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= max ? number : null;
}

function point(data?: Record<string, unknown> | null): Coordinate | null {
  const latitude = coordinate(data?.latitude, 90);
  const longitude = coordinate(data?.longitude, 180);
  return latitude === null || longitude === null ? null : { latitude, longitude };
}

function unavailable(status: number, message: string) {
  return NextResponse.json({ message }, {
    status,
    headers: { 'cache-control': 'private, no-store' },
  });
}

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('orderId') ?? '';
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(orderId)) {
    return unavailable(400, 'Invalid order ID');
  }

  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) return unavailable(401, 'Courier login required');

  // Both lookups are scoped to the authenticated courier; arbitrary order IDs
  // and other couriers' locations cannot be used for routing.
  const headers = { authorization: `Bearer ${accessToken}` };
  let activeResponse: Response;
  let profileResponse: Response;
  try {
    [activeResponse, profileResponse] = await Promise.all([
      backendFetch('/courier/orders/active', { headers }),
      backendFetch('/courier/profile', { headers }),
    ]);
  } catch {
    return unavailable(503, 'Delivery service unavailable');
  }
  if (activeResponse.status === 401 || profileResponse.status === 401) {
    return unavailable(401, 'Courier session expired');
  }
  if (!activeResponse.ok || !profileResponse.ok) {
    return unavailable(503, 'Cannot verify the courier mission');
  }

  let orders: Order[];
  let profile: CourierProfile;
  try {
    orders = (await activeResponse.json()) as Order[];
    profile = (await profileResponse.json()) as CourierProfile;
  } catch {
    return unavailable(502, 'Invalid mission data');
  }

  if (!Array.isArray(orders)) return unavailable(502, 'Invalid mission list');
  const order = orders.find((item) => item.id === orderId);
  if (!order || !['ASSIGNED', 'PICKED_UP'].includes(order.status)) {
    return unavailable(404, 'This mission is not assigned to you');
  }

  const pickup = point(order.pickupSnapshot);
  const dropoff = point(order.dropoffSnapshot);
  if (!pickup || !dropoff) return unavailable(422, 'Missing pickup or dropoff coordinates');

  const recentGps = profile.lastSeenAt
    && Number.isFinite(Date.parse(profile.lastSeenAt))
    && Date.now() - Date.parse(profile.lastSeenAt) <= 3 * 60 * 1000
    && Date.now() >= Date.parse(profile.lastSeenAt) - 30_000;
  const gps = recentGps ? point({
    latitude: profile.lastLatitude,
    longitude: profile.lastLongitude,
  }) : null;

  // When courier GPS is unavailable, show the *planned* pickup -> dropoff
  // road route. Do not present it as live navigation to the courier.
  const from = gps ?? pickup;
  const to = gps && order.status === 'ASSIGNED' ? pickup : dropoff;
  const mode = gps
    ? (order.status === 'ASSIGNED' ? 'TO_PICKUP' : 'TO_DROPOFF')
    : 'PLANNED_DELIVERY';

  const key = process.env.MAPIR_API_KEY?.trim()
    || process.env.NEXT_PUBLIC_MAPIR_API_KEY?.trim();
  if (!key) return unavailable(503, 'Routing service is not configured');

  const base = (process.env.MAPIR_API_BASE_URL ?? 'https://map.ir').replace(/\/$/, '');
  const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = new URL(`${base}/routes/route/v1/driving/${coordinates}`);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'false');
  url.searchParams.set('alternatives', 'false');

  try {
    const upstream = await fetch(url, {
      headers: { accept: 'application/json', 'x-api-key': key },
      signal: AbortSignal.timeout(9000),
      cache: 'no-store',
    });
    if (!upstream.ok) return unavailable(502, 'Road routing provider unavailable');
    const data = await upstream.json() as {
      routes?: Array<{
        geometry?: { type?: string; coordinates?: unknown };
        distance?: number;
        duration?: number;
      }>;
    };
    const route = data.routes?.[0];
    const line = route?.geometry?.coordinates;
    if (route?.geometry?.type !== 'LineString' || !Array.isArray(line)
      || line.length < 2 || line.length > 12000
      || !line.every((p) => Array.isArray(p) && p.length === 2
        && coordinate(p[0], 180) !== null && coordinate(p[1], 90) !== null)) {
      return unavailable(502, 'Road route geometry unavailable');
    }

    return NextResponse.json({
      geometry: { type: 'LineString', coordinates: line },
      distanceMeters: route.distance ?? null,
      durationSeconds: route.duration ?? null,
      mode,
    }, { headers: { 'cache-control': 'private, no-store' } });
  } catch {
    return unavailable(502, 'Road routing service timed out');
  }
}
