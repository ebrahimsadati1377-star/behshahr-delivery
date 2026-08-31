'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type CourierStatus = 'OFFLINE' | 'AVAILABLE' | 'BUSY' | 'SUSPENDED';

interface CourierProfile {
  id: string;
  userId: string;
  vehicleType: string;
  status: CourierStatus;
  lastLatitude: number | string | null;
  lastLongitude: number | string | null;
  lastSeenAt: string | null;
}

interface AddressSnapshot {
  title?: string;
  formattedAddress?: string;
  details?: string;
  latitude?: number;
  longitude?: number;
}

interface CourierOrder {
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
}

const statusLabel: Record<string, string> = {
  OFFLINE: 'آفلاین',
  AVAILABLE: 'آماده دریافت سفارش',
  BUSY: 'در مأموریت',
  SUSPENDED: 'تعلیق‌شده',
  REQUESTED: 'آماده پذیرش',
  ASSIGNED: 'حرکت به مبدا',
  PICKED_UP: 'حرکت به مقصد',
};

function toman(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value);
}

function mapHref(point?: AddressSnapshot) {
  if (typeof point?.latitude !== 'number' || typeof point?.longitude !== 'number') return null;
  return `geo:${point.latitude},${point.longitude}?q=${point.latitude},${point.longitude}`;
}

function OrderCard({ order, action, busy }: { order: CourierOrder; action: (path: string) => Promise<void>; busy: boolean }) {
  const pickupMap = mapHref(order.pickupSnapshot);
  const dropoffMap = mapHref(order.dropoffSnapshot);
  return (
    <article className="order-card">
      <div className="order-head">
        <div><span className="eyebrow">کد سفارش</span><strong className="code">{order.publicCode}</strong></div>
        <span className={`status status-${order.status.toLowerCase()}`}>{statusLabel[order.status] ?? order.status}</span>
      </div>
      <div className="route">
        <div className="route-item"><span className="dot pickup" /><div><b>{order.pickupSnapshot?.title ?? 'مبدا'}</b><span>{order.pickupSnapshot?.formattedAddress ?? '—'}</span>{pickupMap ? <a href={pickupMap}>مسیریابی مبدا</a> : null}</div></div>
        <div className="route-item"><span className="dot dropoff" /><div><b>{order.dropoffSnapshot?.title ?? 'مقصد'}</b><span>{order.dropoffSnapshot?.formattedAddress ?? '—'}</span>{dropoffMap ? <a href={dropoffMap}>مسیریابی مقصد</a> : null}</div></div>
      </div>
      <div className="stats">
        <div><span>کرایه</span><strong>{toman(order.finalPriceToman ?? order.quotedPriceToman)} تومان</strong></div>
        <div><span>فاصله</span><strong>{(order.distanceMeters / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} کیلومتر</strong></div>
        <div><span>زمان</span><strong>{order.estimatedDurationSeconds ? `${Math.max(1, Math.round(order.estimatedDurationSeconds / 60)).toLocaleString('fa-IR')} دقیقه` : '—'}</strong></div>
      </div>
      {order.notes ? <p className="note">یادداشت: {order.notes}</p> : null}
      {order.status === 'REQUESTED' ? <button className="primary" disabled={busy} onClick={() => action(`orders/${order.id}/accept`)}>قبول سفارش</button> : null}
      {order.status === 'ASSIGNED' ? <div className="action-grid"><button className="primary" disabled={busy} onClick={() => action(`orders/${order.id}/picked-up`)}>بسته را تحویل گرفتم</button><button className="danger" disabled={busy} onClick={() => action(`orders/${order.id}/reject`)}>رد مأموریت</button></div> : null}
      {order.status === 'PICKED_UP' ? <button className="success" disabled={busy} onClick={() => action(`orders/${order.id}/delivered`)}>بسته تحویل داده شد</button> : null}
    </article>
  );
}

export default function CourierHomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CourierProfile | null>(null);
  const [current, setCurrent] = useState<CourierOrder | null>(null);
  const [queue, setQueue] = useState<CourierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');
  const [locationStatus, setLocationStatus] = useState('در انتظار دسترسی موقعیت…');
  const lastLocationSentAt = useRef(0);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(`/api/courier/${path}`, { ...init, cache: 'no-store' });
    if (response.status === 401 || response.status === 403) {
      router.replace('/');
      throw new Error('نشست ورود پایان یافته');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message ?? 'درخواست ناموفق بود');
    return body;
  }, [router]);

  const load = useCallback(async () => {
    const nextProfile = await api('profile') as CourierProfile;
    setProfile(nextProfile);
    const nextCurrent = await api('orders/current') as CourierOrder | null;
    setCurrent(nextCurrent);
    if (nextProfile.status === 'AVAILABLE' && !nextCurrent) {
      const nextQueue = await api('orders/available') as CourierOrder[];
      setQueue(nextQueue);
    } else {
      setQueue([]);
    }
  }, [api]);

  useEffect(() => {
    load().catch((cause) => setError(cause instanceof Error ? cause.message : 'خطا در دریافت اطلاعات')).finally(() => setLoading(false));
    const timer = window.setInterval(() => void load().catch(() => undefined), 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const sendLocation = useCallback(async (latitude: number, longitude: number) => {
    await api('location', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ latitude, longitude }),
    });
    lastLocationSentAt.current = Date.now();
    setLocationStatus(`موقعیت بروزرسانی شد • ${new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`);
  }, [api]);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocationStatus('GPS در این دستگاه در دسترس نیست');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (Date.now() - lastLocationSentAt.current < 15000) return;
        void sendLocation(position.coords.latitude, position.coords.longitude).catch(() => setLocationStatus('ارسال موقعیت ناموفق بود'));
      },
      (geoError) => setLocationStatus(geoError.code === 1 ? 'دسترسی موقعیت را برای اپ فعال کن' : 'دریافت موقعیت ناموفق بود'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 12000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [sendLocation]);

  async function setAvailability(status: 'AVAILABLE' | 'OFFLINE') {
    setActionBusy(true); setError('');
    try {
      await api('availability', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تغییر وضعیت ناموفق بود'); }
    finally { setActionBusy(false); }
  }

  async function orderAction(path: string) {
    setActionBusy(true); setError('');
    try { await api(path, { method: 'POST' }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'عملیات ناموفق بود'); }
    finally { setActionBusy(false); }
  }

  function locateNow() {
    if (!('geolocation' in navigator)) return;
    setLocationStatus('در حال دریافت موقعیت…');
    navigator.geolocation.getCurrentPosition(
      (position) => void sendLocation(position.coords.latitude, position.coords.longitude).catch(() => setLocationStatus('ارسال موقعیت ناموفق بود')),
      () => setLocationStatus('دسترسی به موقعیت ممکن نیست'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/');
  }

  return (
    <main className="shell dashboard-shell">
      <header className="topbar">
        <div><span className="eyebrow">پنل پیک</span><strong>ارسال بهشهر</strong></div>
        <button className="text-button" type="button" onClick={() => void logout()}>خروج</button>
      </header>

      {loading ? <section className="card"><p className="muted">در حال دریافت وضعیت…</p></section> : null}
      {error ? <p className="error banner">{error}</p> : null}

      {profile ? <section className="status-card">
        <div><span className="eyebrow">وضعیت کاری</span><h1>{statusLabel[profile.status] ?? profile.status}</h1><p>{profile.vehicleType === 'MOTORBIKE' ? 'موتورسیکلت' : 'خودرو'} • بروزرسانی سفارش‌ها هر ۱۰ ثانیه</p></div>
        <span className={`presence presence-${profile.status.toLowerCase()}`} />
        <div className="availability-actions">
          <button className="success" disabled={actionBusy || profile.status === 'AVAILABLE' || profile.status === 'BUSY' || profile.status === 'SUSPENDED'} onClick={() => void setAvailability('AVAILABLE')}>آنلاین شو</button>
          <button className="secondary" disabled={actionBusy || profile.status === 'OFFLINE' || profile.status === 'BUSY' || profile.status === 'SUSPENDED'} onClick={() => void setAvailability('OFFLINE')}>آفلاین شو</button>
        </div>
      </section> : null}

      <section className="location-card">
        <div><strong>GPS پیک</strong><span>{locationStatus}</span></div>
        <button className="small-button" type="button" onClick={locateNow}>ارسال الان</button>
      </section>

      {current ? <section className="section"><div className="section-head"><div><span className="eyebrow">مأموریت جاری</span><h2>سفارش فعال</h2></div><button className="small-button" onClick={() => void load()}>بروزرسانی</button></div><OrderCard order={current} action={orderAction} busy={actionBusy} /></section> : null}

      {!current && profile?.status === 'AVAILABLE' ? <section className="section"><div className="section-head"><div><span className="eyebrow">صف نزدیک</span><h2>سفارش‌های آماده</h2></div><span className="queue-count">{queue.length.toLocaleString('fa-IR')}</span></div>{queue.length ? <div className="order-list">{queue.map((order) => <OrderCard key={order.id} order={order} action={orderAction} busy={actionBusy} />)}</div> : <div className="empty"><strong>فعلاً سفارشی نیست</strong><span>به محض ثبت سفارش جدید، این لیست بروزرسانی می‌شود.</span></div>}</section> : null}

      {!current && profile?.status === 'OFFLINE' ? <div className="empty"><strong>برای دیدن سفارش‌ها آنلاین شو</strong><span>بعد از آنلاین شدن، صف سفارش‌های قابل قبول نمایش داده می‌شود.</span></div> : null}
      <p className="footer-note">ردیابی موقعیت در نسخه فعلی فقط زمانی فعال است که این PWA باز باشد.</p>
    </main>
  );
}
