'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type CoordinateValue = number | string | null | undefined;

interface Point {
  latitude?: CoordinateValue;
  longitude?: CoordinateValue;
  title?: string;
}

interface MissionMapProps {
  pickup?: Point | null;
  dropoff?: Point | null;
  courier?: Point | null;
}

function numberValue(value: CoordinateValue): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalize(point?: Point | null) {
  const latitude = numberValue(point?.latitude);
  const longitude = numberValue(point?.longitude);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude, title: point?.title };
}

function markerElement(kind: 'pickup' | 'dropoff' | 'courier') {
  const element = document.createElement('div');
  element.className = `mission-map-marker mission-map-marker-${kind}`;
  element.innerHTML = `<span>${kind === 'pickup' ? 'م' : kind === 'dropoff' ? 'پ' : 'من'}</span>`;
  return element;
}

export function MissionMap({ pickup, dropoff, courier }: MissionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const apiKey = process.env.NEXT_PUBLIC_NESHAN_MAP_KEY?.trim() ?? '';
  const pickupPoint = useMemo(() => normalize(pickup), [pickup]);
  const dropoffPoint = useMemo(() => normalize(dropoff), [dropoff]);
  const courierPoint = useMemo(() => normalize(courier), [courier]);

  useEffect(() => {
    if (!apiKey || !containerRef.current || !pickupPoint || !dropoffPoint) return;
    const pickupCoordinate = pickupPoint;
    const dropoffCoordinate = dropoffPoint;
    const courierCoordinate = courierPoint;

    let disposed = false;
    let map: { remove: () => void } | null = null;

    async function initialize() {
      try {
        const sdk = await import('@neshan-maps-platform/maplibre-sdk');
        if (disposed || !containerRef.current) return;
        const maplibregl = sdk.default;
        const bounds = new maplibregl.LngLatBounds();
        const nextMap = new maplibregl.Map({
          container: containerRef.current,
          style: 'https://static.neshan.org/sdk/maplibre/styles/light.json',
          center: [pickupCoordinate.longitude, pickupCoordinate.latitude],
          zoom: 13,
          apiKey,
          logoPosition: 'bottom-left',
          copyRightPosition: 'bottom-right',
        });

        const markers = [
          { kind: 'pickup' as const, point: pickupCoordinate, label: pickupCoordinate.title ?? 'مبدا' },
          { kind: 'dropoff' as const, point: dropoffCoordinate, label: dropoffCoordinate.title ?? 'مقصد' },
          ...(courierCoordinate ? [{ kind: 'courier' as const, point: courierCoordinate, label: 'موقعیت من' }] : []),
        ];

        for (const item of markers) {
          new maplibregl.Marker({ element: markerElement(item.kind) })
            .setLngLat([item.point.longitude, item.point.latitude])
            .setPopup(new maplibregl.Popup({ offset: 24 }).setText(item.label))
            .addTo(nextMap);
          bounds.extend([item.point.longitude, item.point.latitude]);
        }

        nextMap.once('load', () => {
          if (!disposed) nextMap.fitBounds(bounds, { padding: 54, maxZoom: 15, duration: 0 });
        });
        map = nextMap;
      } catch {
        if (!disposed) setError('بارگذاری نقشه مأموریت ناموفق بود.');
      }
    }

    void initialize();
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [apiKey, pickupPoint, dropoffPoint, courierPoint]);

  if (!pickupPoint || !dropoffPoint) return null;

  if (!apiKey) {
    return (
      <div className="mission-map-fallback">
        <span>⌖</span>
        <div><strong>نمای نقشه مأموریت آماده است</strong><small>بعد از ثبت کلید Web Map نشان، مبدا، مقصد و موقعیت زنده پیک اینجا نمایش داده می‌شود.</small></div>
      </div>
    );
  }

  if (error) return <div className="mission-map-fallback">{error}</div>;
  return <div className="mission-map" ref={containerRef} aria-label="نقشه مأموریت پیک" />;
}
