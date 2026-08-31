import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegister } from './pwa-register';

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
  return <html lang="fa" dir="rtl"><body><PwaRegister />{children}</body></html>;
}
