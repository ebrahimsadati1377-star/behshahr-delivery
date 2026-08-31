import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegister } from './pwa-register';

export const metadata: Metadata = {
  title: {
    default: 'ارسال بهشهر',
    template: '%s | ارسال بهشهر',
  },
  description: 'درخواست و پیگیری ارسال شهری در بهشهر',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#111827',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
