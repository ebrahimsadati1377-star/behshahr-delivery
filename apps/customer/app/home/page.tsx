'use client';

import Link from 'next/link';
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
        <Link className="primary link-button" href="/new">ثبت ارسال جدید</Link>

        <Link className="action-card linked-card" href="/orders">
          <strong>سفارش‌های من</strong>
          <span>وضعیت ارسال‌های فعال و تاریخچه سفارش‌ها را ببین.</span>
        </Link>
        <Link className="action-card linked-card" href="/addresses">
          <strong>آدرس‌ها</strong>
          <span>مبدا و مقصدهای ذخیره‌شده را اضافه یا ویرایش کن.</span>
        </Link>
        <div className="action-card">
          <strong>ورود امن</strong>
          <span>نشست ورود با cookieهای HttpOnly نگهداری و خودکار تمدید می‌شود.</span>
        </div>
      </div>

      <button className="secondary" type="button" onClick={logout} style={{ marginTop: 20 }}>
        خروج از حساب
      </button>
    </main>
  );
}
