import type { Metadata, Viewport } from 'next';
import { Vazirmatn } from 'next/font/google';
import '@neshan-maps-platform/maplibre-sdk/style.css';
import './globals.css';
import './map.css';
import { PwaRegister } from './pwa-register';

const vazirmatn = Vazirmatn({
  subsets: ['arabic'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'پیک بهشهر',
  description: 'پنل موبایلی پیک‌های ارسال بهشهر',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f766e',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body className={vazirmatn.className} style={{ fontFamily: vazirmatn.style.fontFamily }}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
