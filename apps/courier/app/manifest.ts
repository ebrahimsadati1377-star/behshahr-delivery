import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'پیک بهشهر',
    short_name: 'پیک بهشهر',
    description: 'پنل موبایلی پیک‌های ارسال بهشهر',
    start_url: '/',
    display: 'standalone',
    background_color: '#f3f7f6',
    theme_color: '#0f766e',
    orientation: 'portrait',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
