'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Order {
  id: string;
  publicCode: string;
  status: string;
  vehicleType: string;
  pickupSnapshot: { title?: string; formattedAddress?: string };
  dropoffSnapshot: { title?: string; formattedAddress?: string };
  quotedPriceToman: number;
  finalPriceToman: number | null;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  REQUESTED: 'در انتظار پیک',
  ASSIGNED: 'پیک اختصاص یافت',
  PICKED_UP: 'بسته دریافت شد',
  DELIVERED: 'تحویل شد',
  CANCELLED: 'لغو شد',
  FAILED: 'ناموفق',
};

function toman(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value);
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/customer/orders', { cache: 'no-store' });
    if (response.status === 401) {
      router.replace('/');
      return;
    }
    const body = await response.json().catch(() => ([]));
    if (!response.ok) throw new Error(body.message ?? 'دریافت سفارش‌ها ناموفق بود');
    setOrders(body);
  }, [router]);

  useEffect(() => {
    load()
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'خطا در دریافت سفارش‌ها'))
      .finally(() => setLoading(false));
  }, [load]);

  return (
    <main className="shell">
      <div className="topbar">
        <Link href="/home" className="text-link">بازگشت</Link>
        <strong>سفارش‌های من</strong>
        <Link href="/new" className="text-link">ارسال جدید</Link>
      </div>

      {loading ? <p className="muted">در حال دریافت سفارش‌ها…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && orders.length === 0 ? (
        <div className="empty-state">
          <p>هنوز سفارشی ثبت نکردی.</p>
          <Link href="/new" className="primary link-button">ثبت اولین ارسال</Link>
        </div>
      ) : null}

      <div className="grid">
        {orders.map((order) => (
          <Link href={`/orders/${order.id}`} className="order-card" key={order.id}>
            <div className="order-card-head">
              <div>
                <strong>{order.publicCode}</strong>
                <span className={`status status-${order.status.toLowerCase()}`}>{statusLabels[order.status] ?? order.status}</span>
              </div>
              <strong>{toman(order.finalPriceToman ?? order.quotedPriceToman)} تومان</strong>
            </div>
            <div className="route-line">
              <span className="route-dot pickup" />
              <div><b>مبدا</b><span>{order.pickupSnapshot?.title ?? order.pickupSnapshot?.formattedAddress ?? '—'}</span></div>
            </div>
            <div className="route-line">
              <span className="route-dot dropoff" />
              <div><b>مقصد</b><span>{order.dropoffSnapshot?.title ?? order.dropoffSnapshot?.formattedAddress ?? '—'}</span></div>
            </div>
            <div className="order-footer">
              <span>{order.vehicleType === 'MOTORBIKE' ? 'موتور' : 'خودرو'}</span>
              <span>{new Date(order.createdAt).toLocaleString('fa-IR')}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
