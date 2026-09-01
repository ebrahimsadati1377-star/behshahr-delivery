'use client';

import '@neshan-maps-platform/maplibre-sdk/style.css';
import { useEffect, useRef } from 'react';
import styles from './order-tracking-map.module.css';

interface MapPoint {
  latitude?: number;
  longitude?: number;
}

interface CourierTracking {
  latitude: number;
  longitude: number;
  lastSeenAt: string | null;
}

interface OrderTrackingMapProps {
  pickup: MapPoint;
  dropoff: MapPoint;
  courier: CourierTracking | null;
}

interface MapHandle {
  remove: () => void;
}

interface MarkerHandle {
  setLngLat: (coordinates: [number, number]) => MarkerHandle;
  remove: () => void;
}

function isValidPoint(point: MapPoint): point is Required<MapPoint> {
  return (
    typeof point.latitude === 'number' &&
    Number.isFinite(point.latitude) &&
    typeof point.longitude === 'number' &&
    Number.isFinite(point.longitude)
  );
}

export function OrderTrackingMap({ pickup, dropoff, courier }: OrderTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapHandle | null>(null);
  const courierMarkerRef = useRef<MarkerHandle | null>(null);
  const neshanMapKey = process.env.NEXT_PUBLIC_NESHAN_MAP_KEY ?? '';
  const hasEndpoints = isValidPoint(pickup) && isValidPoint(dropoff);
  const hasCourier = Boolean(courier);

  useEffect(() => {
    if (!neshanMapKey || !hasEndpoints || !containerRef.current) return;

    let disposed = false;
    const markers: MarkerHandle[] = [];

    async function initialize() {
      const module = await import('@neshan-maps-platform/maplibre-sdk');
      if (disposed || !containerRef.current || !isValidPoint(pickup) || !isValidPoint(dropoff)) return;

      const maplibregl = module.default;
      const pickupCoordinates: [number, number] = [pickup.longitude, pickup.latitude];
      const dropoffCoordinates: [number, number] = [dropoff.longitude, dropoff.latitude];

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://static.neshan.org/sdk/maplibre/styles/light.json',
        center: pickupCoordinates,
        zoom: 13,
        apiKey: neshanMapKey,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

      markers.push(
        new maplibregl.Marker({ color: '#111827' }).setLngLat(pickupCoordinates).addTo(map),
        new maplibregl.Marker({ color: '#ea580c' }).setLngLat(dropoffCoordinates).addTo(map),
      );

      const bounds = new maplibregl.LngLatBounds();
      bounds.extend(pickupCoordinates);
      bounds.extend(dropoffCoordinates);

      if (courier) {
        const courierCoordinates: [number, number] = [courier.longitude, courier.latitude];
        const courierMarker = new maplibregl.Marker({ color: '#059669' })
          .setLngLat(courierCoordinates)
          .addTo(map);
        courierMarkerRef.current = courierMarker;
        markers.push(courierMarker);
        bounds.extend(courierCoordinates);
      }

      map.fitBounds(bounds, { padding: 52, maxZoom: 16, duration: 0 });
      mapRef.current = map;
    }

    initialize().catch(() => {
      // Tracking details stay usable if map resources are temporarily unavailable.
    });

    return () => {
      disposed = true;
      courierMarkerRef.current = null;
      markers.forEach((marker) => marker.remove());
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [neshanMapKey, hasEndpoints, hasCourier, pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude]);

  useEffect(() => {
    if (!courier || !courierMarkerRef.current) return;
    courierMarkerRef.current.setLngLat([courier.longitude, courier.latitude]);
  }, [courier?.latitude, courier?.longitude]);

  if (!hasEndpoints) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.frame}>
        {neshanMapKey ? (
          <>
            <div ref={containerRef} className={styles.map} aria-label="نقشه سفارش" />
            {courier ? <span className={styles.live}>موقعیت پیک</span> : null}
          </>
        ) : (
          <div className={styles.placeholder}>
            <div>
              <strong>نمای نقشه آماده اتصال است</strong>
              <span>با تنظیم کلید Web Map نشان، مبدا، مقصد و موقعیت پیک در این بخش نمایش داده می‌شوند.</span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}><i className={styles.dot} />مبدا</span>
        <span className={styles.legendItem}><i className={`${styles.dot} ${styles.dropoff}`} />مقصد</span>
        {courier ? <span className={styles.legendItem}><i className={`${styles.dot} ${styles.courier}`} />پیک</span> : null}
      </div>
      {courier?.lastSeenAt ? <p className={styles.note}>آخرین موقعیت پیک: {new Date(courier.lastSeenAt).toLocaleString('fa-IR')}</p> : null}
    </div>
  );
}
