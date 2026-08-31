import type { Metadata, Viewport } from 'next';
import { Vazirmatn } from 'next/font/google';
import './globals.css';
import { PwaRegister } from './pwa-register';

const vazirmatn = Vazirmatn({
  subsets: ['arabic'],
  display: 'swap',
});

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
      <body className={vazirmatn.className} style={{ fontFamily: vazirmatn.style.fontFamily }}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
