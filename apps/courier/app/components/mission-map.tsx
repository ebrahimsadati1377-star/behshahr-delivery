'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type CoordinateValue = number | string | null | undefined;
type MarkerKind = 'pickup' | 'dropoff' | 'courier';

interface Point {
  latitude?: CoordinateValue;
  longitude?: CoordinateValue;
  title?: string;
}

interface MissionMapProps {
  orderId?: string;
  status?: string;
  pickup?: Point | null;
  dropoff?: Point | null;
  courier?: Point | null;
}

type RoadGeometry = { type: 'LineString'; coordinates: [number, number][] };
type RoutePayload = {
  geometry: RoadGeometry;
  distanceMeters: number | null;
  durationSeconds: number | null;
  mode: 'TO_PICKUP' | 'TO_DROPOFF' | 'PLANNED_DELIVERY';
};

function numberValue(value: CoordinateValue, limit: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

function normalize(point?: Point | null) {
  const latitude = numberValue(point?.latitude, 90);
  const longitude = numberValue(point?.longitude, 180);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude, title: point?.title };
}

function markerElement(kind: MarkerKind) {
  const node = document.createElement('div');
  node.className = `mission-map-marker mission-map-marker-${kind}`;
  node.textContent = kind === 'pickup' ? 'م' : kind === 'dropoff' ? 'پ' : 'من';
  node.setAttribute('aria-label', kind === 'pickup' ? 'مبدا' : kind === 'dropoff' ? 'مقصد' : 'پیک');
  return node;
}

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const lat = (a.latitude - b.latitude) * 111_000;
  const lng = (a.longitude - b.longitude) * 111_000 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(lat, lng);
}

const routeId = 'mission-street-route';
const emptyGeometry = { type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: [] }, properties: {} };

export function MissionMap({ orderId, status, pickup, dropoff, courier }: MissionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const courierMarkerRef = useRef<{ setLngLat: (lngLat: [number, number]) => unknown; remove: () => void } | null>(null);
  const lastRequestRef = useRef<{ orderId: string; status: string; location: { latitude: number; longitude: number } | null; at: number } | null>(null);
  const requestSeqRef = useRef(0);
  const lastFitRef = useRef('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [routeStatus, setRouteStatus] = useState('در حال دریافت مسیر خیابانی…');

  const apiKey = process.env.NEXT_PUBLIC_MAPIR_API_KEY?.trim() ?? '';
  const pickupPoint = useMemo(() => normalize(pickup), [pickup?.latitude, pickup?.longitude, pickup?.title]);
  const dropoffPoint = useMemo(() => normalize(dropoff), [dropoff?.latitude, dropoff?.longitude, dropoff?.title]);
  const courierPoint = useMemo(() => normalize(courier), [courier?.latitude, courier?.longitude]);

  useEffect(() => {
    if (!apiKey || !containerRef.current || !pickupPoint || !dropoffPoint) return;
    let disposed = false;
    let map: { remove: () => void } | null = null;
    setReady(false);
    setError('');
    setRouteStatus('در حال دریافت مسیر خیابانی…');
    lastRequestRef.current = null;
    lastFitRef.current = '';

    async function initialize() {
      try {
        const sdk = await import('@neshan-maps-platform/maplibre-sdk');
        if (disposed || !containerRef.current || !pickupPoint || !dropoffPoint) return;
        const gl = sdk.default;
        const bounds = new gl.LngLatBounds();
        const nextMap = new gl.Map({
          container: containerRef.current,
          style: 'https://map.ir/vector/styles/main/mapir-xyz-style.json',
          center: [pickupPoint.longitude, pickupPoint.latitude],
          zoom: 13,
          transformRequest: (url: string) => ({
            url,
            headers: { 'x-api-key': apiKey, 'Mapir-SDK': 'behshahr-delivery-web' },
          }),
        });
        map = nextMap;
        mapRef.current = nextMap;

        for (const item of [
          { kind: 'pickup' as const, point: pickupPoint, label: pickupPoint.title ?? 'مبدا' },
          { kind: 'dropoff' as const, point: dropoffPoint, label: dropoffPoint.title ?? 'مقصد' },
        ]) {
          new gl.Marker({ element: markerElement(item.kind) })
            .setLngLat([item.point.longitude, item.point.latitude])
            .setPopup(new gl.Popup({ offset: 24 }).setText(item.label))
            .addTo(nextMap);
          bounds.extend([item.point.longitude, item.point.latitude]);
        }
        nextMap.once('load', () => {
          if (disposed) return;
          nextMap.addSource(routeId, { type: 'geojson', data: emptyGeometry });
          nextMap.addLayer({ id: 'mission-route-halo', type: 'line', source: routeId,
            paint: { 'line-color': '#fff', 'line-width': 9, 'line-opacity': 0.92 },
            layout: { 'line-join': 'round', 'line-cap': 'round' } });
          nextMap.addLayer({ id: 'mission-route-line', type: 'line', source: routeId,
            paint: { 'line-color': '#2865da', 'line-width': 5, 'line-opacity': 0.95 },
            layout: { 'line-join': 'round', 'line-cap': 'round' } });
          nextMap.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 0 });
          setReady(true);
        });
      } catch {
        if (!disposed) setError('بارگذاری نقشه مأموریت ناموفق بود.');
      }
    }
    void initialize();
    return () => {
      disposed = true;
      requestSeqRef.current += 1;
      courierMarkerRef.current?.remove();
      courierMarkerRef.current = null;
      map?.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [apiKey, orderId, pickupPoint?.latitude, pickupPoint?.longitude, dropoffPoint?.latitude, dropoffPoint?.longitude]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let disposed = false;
    async function moveCourierMarker() {
      const sdk = await import('@neshan-maps-platform/maplibre-sdk');
      if (disposed || !mapRef.current) return;
      if (!courierPoint) {
        courierMarkerRef.current?.remove();
        courierMarkerRef.current = null;
        return;
      }
      const location: [number, number] = [courierPoint.longitude, courierPoint.latitude];
      if (!courierMarkerRef.current) {
        courierMarkerRef.current = new sdk.default.Marker({ element: markerElement('courier') })
          .setLngLat(location).addTo(mapRef.current);
      } else {
        courierMarkerRef.current.setLngLat(location);
      }
    }
    void moveCourierMarker();
    return () => { disposed = true; };
  }, [ready, courierPoint?.latitude, courierPoint?.longitude]);

  useEffect(() => {
    if (!ready || !orderId || !['ASSIGNED', 'PICKED_UP'].includes(status ?? '')) return;
    const now = Date.now();
    const location = courierPoint ? { latitude: courierPoint.latitude, longitude: courierPoint.longitude } : null;
    const prev = lastRequestRef.current;
    if (prev && prev.orderId === orderId && prev.status === status) {
      const moved = prev.location && location ? distanceMeters(prev.location, location) : prev.location === location ? 0 : Infinity;
      if ((now - prev.at < 60_000 && moved < 110) || now - prev.at < 20_000) return;
    }

    lastRequestRef.current = { orderId, status: status ?? '', location, at: now };
    const seq = ++requestSeqRef.current;
    const currentMap = mapRef.current;
    setRouteStatus('در حال دریافت مسیر خیابانی…');
    void (async () => {
      try {
        const response = await fetch('/api/mission-route?orderId=' + encodeURIComponent(orderId), { cache: 'no-store' });
        if (!response.ok) throw new Error('Route unavailable');
        const data = await response.json() as RoutePayload;
        const coords = data.geometry?.coordinates;
        if (data.geometry?.type !== 'LineString' || !Array.isArray(coords) || coords.length < 2) {
          throw new Error('Invalid route geometry');
        }
        if (seq !== requestSeqRef.current || mapRef.current !== currentMap) return;
        const source = currentMap?.getSource(routeId) as { setData: (data: unknown) => void } | undefined;
        if (!source) throw new Error('Route layer missing');
        source.setData({ type: 'Feature', geometry: data.geometry, properties: {} });
        const minutes = data.durationSeconds && Number.isFinite(data.durationSeconds)
          ? ' • ' + Math.max(1, Math.round(data.durationSeconds / 60)).toLocaleString('fa-IR') + ' دقیقه'
          : '';
        setRouteStatus((data.mode === 'TO_PICKUP' ? 'مسیر خیابانی تا مبدأ'
          : data.mode === 'TO_DROPOFF' ? 'مسیر خیابانی تا مقصد'
          : 'مسیر پیشنهادی مبدأ تا مقصد (موقعیت تازه پیک موجود نیست)') + minutes);

        const key = orderId + ':' + status;
        if (lastFitRef.current !== key) {
          const sdk = await import('@neshan-maps-platform/maplibre-sdk');
          if (seq !== requestSeqRef.current || mapRef.current !== currentMap) return;
          const bounds = new sdk.default.LngLatBounds();
          for (const [lng, lat] of coords) bounds.extend([lng, lat]);
          if (pickupPoint) bounds.extend([pickupPoint.longitude, pickupPoint.latitude]);
          if (dropoffPoint) bounds.extend([dropoffPoint.longitude, dropoffPoint.latitude]);
          currentMap.fitBounds(bounds, { padding: 44, maxZoom: 15, duration: 350 });
          lastFitRef.current = key;
        }
      } catch {
        if (seq !== requestSeqRef.current || mapRef.current !== currentMap) return;
        setRouteStatus('مسیر خیابانی موقتاً در دسترس نیست؛ از دکمه مسیریابی استفاده کن.');
      }
    })();
  }, [ready, orderId, status, courierPoint?.latitude, courierPoint?.longitude, pickupPoint?.latitude, pickupPoint?.longitude, dropoffPoint?.latitude, dropoffPoint?.longitude]);

  if (!pickupPoint || !dropoffPoint) return null;
  if (!apiKey) return <div className="mission-map-fallback">کلید نقشه Map.ir ثبت نشده است.</div>;
  if (error) return <div className="mission-map-fallback">{error}</div>;
  return (
    <div className="mission-map-wrapper">
      <div className="mission-map" ref={containerRef} aria-label="نقشه و مسیر خیابانی مأموریت پیک" />
      <p className="mission-route-status" role="status">{routeStatus}</p>
    </div>
  );
}
