'use client';

import '@neshan-maps-platform/maplibre-sdk/style.css';
import { useEffect, useRef } from 'react';
import styles from './address-map-picker.module.css';

interface AddressMapPickerProps {
  latitude: string;
  longitude: string;
  onChange: (latitude: string, longitude: string) => void;
}

interface MapHandle {
  remove: () => void;
  flyTo: (options: { center: [number, number]; zoom?: number }) => void;
}

interface MarkerHandle {
  setLngLat: (coordinates: [number, number]) => MarkerHandle;
  remove: () => void;
}

const DEFAULT_CENTER: [number, number] = [53.55, 36.7];
const DEFAULT_ZOOM = 13;
const SELECTED_ZOOM = 16;

function validCoordinate(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function AddressMapPicker({ latitude, longitude, onChange }: AddressMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapHandle | null>(null);
  const markerRef = useRef<MarkerHandle | null>(null);
  const neshanMapKey = process.env.NEXT_PUBLIC_NESHAN_MAP_KEY ?? '';

  useEffect(() => {
    if (!neshanMapKey || !containerRef.current || mapRef.current) return;

    let disposed = false;
    let cleanupClick: (() => void) | undefined;

    async function initialize() {
      const module = await import('@neshan-maps-platform/maplibre-sdk');
      if (disposed || !containerRef.current) return;

      const maplibregl = module.default;
      const lat = validCoordinate(latitude);
      const lng = validCoordinate(longitude);
      const hasSelection = lat !== null && lng !== null;
      const center: [number, number] = hasSelection ? [lng, lat] : DEFAULT_CENTER;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://static.neshan.org/sdk/maplibre/styles/light.json',
        center,
        zoom: hasSelection ? SELECTED_ZOOM : DEFAULT_ZOOM,
        apiKey: neshanMapKey,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

      let marker = hasSelection
        ? new maplibregl.Marker({ color: '#111827' }).setLngLat(center).addTo(map)
        : null;

      const handleClick = (event: { lngLat: { lng: number; lat: number } }) => {
        const nextLat = event.lngLat.lat.toFixed(6);
        const nextLng = event.lngLat.lng.toFixed(6);
        const coordinates: [number, number] = [event.lngLat.lng, event.lngLat.lat];

        if (!marker) {
          marker = new maplibregl.Marker({ color: '#111827' }).setLngLat(coordinates).addTo(map);
          markerRef.current = marker;
        } else {
          marker.setLngLat(coordinates);
        }

        onChange(nextLat, nextLng);
      };

      map.on('click', handleClick);
      cleanupClick = () => map.off('click', handleClick);
      mapRef.current = map;
      markerRef.current = marker;
    }

    initialize().catch(() => {
      // The surrounding form remains usable when map resources are unavailable.
    });

    return () => {
      disposed = true;
      cleanupClick?.();
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [neshanMapKey, onChange]);

  useEffect(() => {
    const lat = validCoordinate(latitude);
    const lng = validCoordinate(longitude);
    if (lat === null || lng === null || !mapRef.current) return;

    const coordinates: [number, number] = [lng, lat];
    markerRef.current?.setLngLat(coordinates);
    mapRef.current.flyTo({ center: coordinates, zoom: SELECTED_ZOOM });
  }, [latitude, longitude]);

  const hasCoordinates = validCoordinate(latitude) !== null && validCoordinate(longitude) !== null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.mapFrame}>
        {neshanMapKey ? (
          <>
            <div ref={containerRef} className={styles.map} aria-label="انتخاب موقعیت روی نقشه" />
            <div className={styles.hint}>برای جابه‌جایی پین، روی نقطه موردنظر در نقشه بزن</div>
          </>
        ) : (
          <div className={styles.placeholder}>
            <div>
              <strong>نقشه آماده اتصال است</strong>
              <span>با افزودن کلید Web Map نشان، انتخاب نقطه روی نقشه همین‌جا فعال می‌شود. فعلاً می‌توانی از موقعیت فعلی گوشی استفاده کنی.</span>
            </div>
          </div>
        )}
      </div>
      <div className={styles.meta}>
        <span>{hasCoordinates ? 'موقعیت انتخاب شده' : 'هنوز موقعیتی انتخاب نشده'}</span>
        {hasCoordinates ? <span className={styles.coords}>{latitude}, {longitude}</span> : null}
      </div>
    </div>
  );
}
