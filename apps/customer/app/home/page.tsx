'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  phone: string;
  role: string;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/session/me', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace('/');
          return null;
        }
        if (!response.ok) throw new Error('Session check failed');
        return response.json();
      })
      .then((body) => {
        if (body?.user) setUser(body.user);
      })
      .catch(() => router.replace('/'))
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' });
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="shell">
      <div className="dashboard-head">
        <div>
          <span className="badge">حساب فعال</span>
          <h2 style={{ marginTop: 10 }}>سلام، آماده‌ای ارسال ثبت کنی؟</h2>
          <p className="muted" dir="ltr" style={{ textAlign: 'right' }}>
            {loading ? '…' : user?.phone ?? ''}
          </p>
        </div>
      </div>

      <div className="grid">
        <button className="primary" type="button" disabled>
          ثبت ارسال جدید — مرحله بعد
        </button>

        <div className="action-card">
          <strong>سفارش‌های من</strong>
          <span>تاریخچه و وضعیت ارسال‌ها در مرحله بعد به API سفارش متصل می‌شود.</span>
        </div>
        <div className="action-card">
          <strong>آدرس‌ها</strong>
          <span>مبدا و مقصدهای ذخیره‌شده از API آدرس‌ها قابل مدیریت خواهند بود.</span>
        </div>
        <div className="action-card">
          <strong>امنیت Session</strong>
          <span>توکن‌ها در cookieهای HttpOnly هستند و refresh به‌صورت server-side انجام می‌شود.</span>
        </div>
      </div>

      <button className="secondary" type="button" onClick={logout} style={{ marginTop: 20 }}>
        خروج از حساب
      </button>
    </main>
  );
}
