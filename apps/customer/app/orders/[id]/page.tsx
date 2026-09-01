'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { OrderTrackingMap } from './order-tracking-map';

interface OrderEvent {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: string;
}

interface AddressSnapshot {
  title?: string;
  formattedAddress?: string;
  details?: string;
  latitude?: number;
  longitude?: number;
}

interface CourierTracking {
  vehicleType: string;
  status: string;
  latitude: number;
  longitude: number;
  lastSeenAt: string | null;
}

interface OrderDetail {
  id: string;
  publicCode: string;
  status: string;
  vehicleType: string;
  pickupSnapshot: AddressSnapshot;
  dropoffSnapshot: AddressSnapshot;
  distanceMeters: number;
  estimatedDurationSeconds: number | null;
  quotedPriceToman: number;
  finalPriceToman: number | null;
  notes: string | null;
  createdAt: string;
  courierTracking: CourierTracking | null;
  events: OrderEvent[];
}

type StreamState = 'idle' | 'connecting' | 'live' | 'reconnecting';

const statusLabels: Record<string, string> = {
  REQUESTED: 'در انتظار پیک',
  ASSIGNED: 'پیک اختصاص یافت',
  PICKED_UP: 'بسته دریافت شد',
  DELIVERED: 'تحویل شد',
  CANCELLED: 'لغو شد',
  FAILED: 'ناموفق',
};

const eventLabels: Record<string, string> = {
  ORDER_REQUESTED: 'درخواست ارسال ثبت شد',
  ORDER_ACCEPTED_BY_COURIER: 'پیک سفارش را پذیرفت',
  ORDER_REJECTED_BY_COURIER: 'سفارش دوباره در صف پیک‌ها قرار گرفت',
  ORDER_ASSIGNED_BY_ADMIN: 'مدیر یک پیک به سفارش اختصاص داد',
  ORDER_REASSIGNED_BY_ADMIN: 'پیک سفارش توسط مدیر تغییر کرد',
  ORDER_PICKED_UP: 'بسته توسط پیک دریافت شد',
  ORDER_DELIVERED: 'بسته تحویل داده شد',
  ORDER_CANCELLED_BY_CUSTOMER: 'سفارش توسط مشتری لغو شد',
};

const terminalStatuses = new Set(['DELIVERED', 'CANCELLED', 'FAILED']);

function toman(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value);
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await fetch(`/api/customer/orders/${params.id}`, { cache: 'no-store' });
    if (response.status === 401) {
      router.replace('/');
      return;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message ?? 'دریافت سفارش ناموفق بود');
    setOrder(body);
  }, [params.id, router]);

  useEffect(() => {
    load()
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'خطا در دریافت سفارش'))
      .finally(() => setLoading(false));
  }, [load]);

  const isTerminal = order ? terminalStatuses.has(order.status) : false;

  useEffect(() => {
    if (!order || isTerminal) {
      setStreamState('idle');
      return;
    }

    setStreamState('connecting');
    const source = new EventSource(`/api/customer/orders/${params.id}/stream`);

    source.onopen = () => setStreamState('live');
    source.onerror = () => setStreamState('reconnecting');

    const onOrder = (event: MessageEvent<string>) => {
      try {
        const nextOrder = JSON.parse(event.data) as OrderDetail;
        setOrder(nextOrder);
        setError('');
        setStreamState('live');
      } catch {
        // Keep the previous valid snapshot if an unexpected event is received.
      }
    };

    source.addEventListener('order', onOrder as EventListener);

    const safetyRefresh = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 60_000);

    return () => {
      source.removeEventListener('order', onOrder as EventListener);
      source.close();
      window.clearInterval(safetyRefresh);
    };
  }, [isTerminal, load, order?.id, params.id]);

  async function cancelOrder() {
    if (!order || !window.confirm('این درخواست ارسال لغو شود؟')) return;
    setCancelling(true);
    setError('');
    try {
      const response = await fetch(`/api/customer/orders/${order.id}/cancel`, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? 'لغو سفارش ناموفق بود');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'خطا در لغو سفارش');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <main className="shell">
      <div className="topbar">
        <Link href="/orders" className="text-link">بازگشت</Link>
        <strong>جزئیات ارسال</strong>
        <button className="text-link button-link" type="button" onClick={() => void load()}>بروزرسانی</button>
      </div>

      {loading ? <p className="muted">در حال دریافت…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {order ? (
        <>
          <section className="card compact-card">
            <div className="order-detail-head">
              <div>
                <span className="eyebrow">کد سفارش</span>
                <strong className="code">{order.publicCode}</strong>
              </div>
              <span className={`status status-${order.status.toLowerCase()}`}>{statusLabels[order.status] ?? order.status}</span>
            </div>

            <div className="detail-route">
              <div className="route-line">
                <span className="route-dot pickup" />
                <div><b>{order.pickupSnapshot?.title ?? 'مبدا'}</b><span>{order.pickupSnapshot?.formattedAddress ?? '—'}</span></div>
              </div>
              <div className="route-line">
                <span className="route-dot dropoff" />
                <div><b>{order.dropoffSnapshot?.title ?? 'مقصد'}</b><span>{order.dropoffSnapshot?.formattedAddress ?? '—'}</span></div>
              </div>
            </div>

            {['REQUESTED', 'ASSIGNED', 'PICKED_UP'].includes(order.status) ? (
              <OrderTrackingMap
                pickup={order.pickupSnapshot}
                dropoff={order.dropoffSnapshot}
                courier={order.courierTracking}
              />
            ) : null}

            <div className="stat-grid">
              <div><span>هزینه</span><strong>{toman(order.finalPriceToman ?? order.quotedPriceToman)} تومان</strong></div>
              <div><span>وسیله</span><strong>{order.vehicleType === 'MOTORBIKE' ? 'موتور' : 'خودرو'}</strong></div>
              <div><span>فاصله</span><strong>{(order.distanceMeters / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} کیلومتر</strong></div>
              <div><span>زمان تخمینی</span><strong>{order.estimatedDurationSeconds ? `${Math.max(1, Math.round(order.estimatedDurationSeconds / 60)).toLocaleString('fa-IR')} دقیقه` : '—'}</strong></div>
            </div>
            {order.notes ? <p className="note-box">{order.notes}</p> : null}
          </section>

          <section style={{ marginTop: 22 }}>
            <h2 className="section-title">روند سفارش</h2>
            <div className="timeline">
              {order.events.map((event) => (
                <div className="timeline-item" key={event.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{eventLabels[event.eventType] ?? event.eventType}</strong>
                    <span>{new Date(event.createdAt).toLocaleString('fa-IR')}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {order.status === 'REQUESTED' ? (
            <button className="danger-button" type="button" disabled={cancelling} onClick={cancelOrder}>{cancelling ? 'در حال لغو…' : 'لغو درخواست ارسال'}</button>
          ) : null}
          {!isTerminal ? (
            <p className="muted center-text">
              {streamState === 'live'
                ? 'بروزرسانی زنده وضعیت و موقعیت پیک فعال است.'
                : streamState === 'reconnecting'
                  ? 'اتصال زنده در حال بازیابی است؛ بروزرسانی پشتیبان فعال می‌ماند.'
                  : 'در حال اتصال به بروزرسانی زنده…'}
            </p>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
