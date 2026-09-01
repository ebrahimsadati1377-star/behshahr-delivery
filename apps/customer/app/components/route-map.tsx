'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type CoordinateValue = number | string | null | undefined;

export interface RouteMapPoint {
  latitude?: CoordinateValue;
  longitude?: CoordinateValue;
  title?: string;
}

interface RouteMapProps {
  pickup?: RouteMapPoint | null;
  dropoff?: RouteMapPoint | null;
  className?: string;
}

function coordinate(value: CoordinateValue): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalized(point?: RouteMapPoint | null) {
  const latitude = coordinate(point?.latitude);
  const longitude = coordinate(point?.longitude);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude, title: point?.title };
}

function markerElement(kind: 'pickup' | 'dropoff') {
  const element = document.createElement('div');
  element.className = `neshan-route-marker neshan-route-marker-${kind}`;
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = `<span>${kind === 'pickup' ? 'م' : 'پ'}</span>`;
  return element;
}

export function RouteMap({ pickup, dropoff, className = '' }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState('');
  const apiKey = process.env.NEXT_PUBLIC_NESHAN_MAP_KEY?.trim() ?? '';
  const pickupPoint = useMemo(() => normalized(pickup), [pickup]);
  const dropoffPoint = useMemo(() => normalized(dropoff), [dropoff]);

  useEffect(() => {
    if (!apiKey || !containerRef.current || !pickupPoint || !dropoffPoint) return;

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
          center: [pickupPoint.longitude, pickupPoint.latitude],
          zoom: 13,
          apiKey,
          logoPosition: 'bottom-left',
          copyRightPosition: 'bottom-right',
        });

        new maplibregl.Marker({ element: markerElement('pickup') })
          .setLngLat([pickupPoint.longitude, pickupPoint.latitude])
          .setPopup(new maplibregl.Popup({ offset: 24 }).setText(pickupPoint.title ?? 'مبدا'))
          .addTo(nextMap);
        new maplibregl.Marker({ element: markerElement('dropoff') })
          .setLngLat([dropoffPoint.longitude, dropoffPoint.latitude])
          .setPopup(new maplibregl.Popup({ offset: 24 }).setText(dropoffPoint.title ?? 'مقصد'))
          .addTo(nextMap);

        bounds.extend([pickupPoint.longitude, pickupPoint.latitude]);
        bounds.extend([dropoffPoint.longitude, dropoffPoint.latitude]);
        nextMap.once('load', () => {
          if (!disposed) nextMap.fitBounds(bounds, { padding: 54, maxZoom: 15, duration: 0 });
        });
        map = nextMap;
      } catch {
        if (!disposed) setMapError('بارگذاری نقشه نشان ناموفق بود.');
      }
    }

    void initialize();
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [apiKey, pickupPoint, dropoffPoint]);

  if (!pickupPoint || !dropoffPoint) {
    return <div className={`route-map-fallback ${className}`}>مختصات مبدا و مقصد برای نمایش نقشه کامل نیست.</div>;
  }

  if (!apiKey) {
    return (
      <div className={`route-map-fallback route-map-key-missing ${className}`}>
        <span className="route-map-fallback-icon">⌖</span>
        <div><strong>نمای مسیر آماده است</strong><small>با ثبت کلید Web Map نشان، نقشه واقعی همین‌جا نمایش داده می‌شود.</small></div>
      </div>
    );
  }

  if (mapError) return <div className={`route-map-fallback ${className}`}>{mapError}</div>;

  return <div className={`neshan-route-map ${className}`} ref={containerRef} aria-label="نقشه مبدا و مقصد" />;
}
