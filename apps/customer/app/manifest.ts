import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ارسال بهشهر',
    short_name: 'ارسال',
    description: 'درخواست و پیگیری ارسال شهری در بهشهر',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f7f8',
    theme_color: '#111827',
    lang: 'fa',
    dir: 'rtl',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
  };
}
