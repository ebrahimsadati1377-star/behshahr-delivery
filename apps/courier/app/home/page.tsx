'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MissionMap } from '../components/mission-map';

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
  latitude?: number | string;
  longitude?: number | string;
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
  const latitude = Number(point?.latitude);
  const longitude = Number(point?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return `geo:${latitude},${longitude}?q=${latitude},${longitude}`;
}

function missionStep(status: string) {
  if (status === 'PICKED_UP') return 2;
  if (status === 'ASSIGNED') return 1;
  return 0;
}

function MissionProgress({ status }: { status: string }) {
  const active = missionStep(status);
  const steps = ['حرکت به مبدا', 'دریافت بسته', 'تحویل مقصد'];
  return (
    <div className="mission-progress" aria-label="مراحل مأموریت">
      <div className="mission-track" aria-hidden="true"><span style={{ width: `${active * 50}%` }} /></div>
      <div className="mission-steps">
        {steps.map((label, index) => (
          <div className={index <= active ? 'mission-step active' : 'mission-step'} key={label}>
            <i>{index + 1}</i>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoutePoint({ kind, point }: { kind: 'pickup' | 'dropoff'; point: AddressSnapshot }) {
  const href = mapHref(point);
  return (
    <div className="route-point">
      <div className={`route-pin ${kind}`}><span /></div>
      <div className="route-copy">
        <span className="route-kicker">{kind === 'pickup' ? 'مبدا' : 'مقصد'}</span>
        <strong>{point?.title ?? (kind === 'pickup' ? 'مبدا' : 'مقصد')}</strong>
        <p>{point?.formattedAddress ?? 'آدرس ثبت نشده'}</p>
        {point?.details ? <small>{point.details}</small> : null}
      </div>
      {href ? <a className="route-nav" href={href} aria-label={`مسیریابی ${kind === 'pickup' ? 'مبدا' : 'مقصد'}`}>مسیریابی</a> : null}
    </div>
  );
}

function OrderCard({
  order,
  action,
  busy,
  current = false,
  courierLocation,
}: {
  order: CourierOrder;
  action: (path: string) => Promise<void>;
  busy: boolean;
  current?: boolean;
  courierLocation?: { latitude: number | string | null; longitude: number | string | null } | null;
}) {
  return (
    <article className={current ? 'order-card current-order-card' : 'order-card'}>
      <div className="order-head">
        <div>
          <span className="eyebrow">کد سفارش</span>
          <strong className="code">{order.publicCode}</strong>
        </div>
        <span className={`status status-${order.status.toLowerCase()}`}>{statusLabel[order.status] ?? order.status}</span>
      </div>

      {current && ['ASSIGNED', 'PICKED_UP'].includes(order.status) ? <MissionProgress status={order.status} /> : null}

      {current ? (
        <MissionMap
          pickup={order.pickupSnapshot}
          dropoff={order.dropoffSnapshot}
          courier={courierLocation ? { ...courierLocation, title: 'موقعیت من' } : null}
        />
      ) : null}

      <div className="route-panel">
        <RoutePoint kind="pickup" point={order.pickupSnapshot} />
        <div className="route-connector" aria-hidden="true" />
        <RoutePoint kind="dropoff" point={order.dropoffSnapshot} />
      </div>

      <div className="order-metrics">
        <div><span>کرایه</span><strong>{toman(order.finalPriceToman ?? order.quotedPriceToman)}</strong><small>تومان</small></div>
        <div><span>مسافت</span><strong>{(order.distanceMeters / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}</strong><small>کیلومتر</small></div>
        <div><span>زمان تقریبی</span><strong>{order.estimatedDurationSeconds ? Math.max(1, Math.round(order.estimatedDurationSeconds / 60)).toLocaleString('fa-IR') : '—'}</strong><small>دقیقه</small></div>
      </div>

      {order.notes ? <div className="order-note"><span>یادداشت مشتری</span><p>{order.notes}</p></div> : null}

      <div className="mission-actions">
        {order.status === 'REQUESTED' ? <button className="primary large-action" disabled={busy} onClick={() => action(`orders/${order.id}/accept`)}>قبول این سفارش</button> : null}
        {order.status === 'ASSIGNED' ? <>
          <button className="primary large-action" disabled={busy} onClick={() => action(`orders/${order.id}/picked-up`)}>بسته را تحویل گرفتم</button>
          <button className="danger subtle-action" disabled={busy} onClick={() => action(`orders/${order.id}/reject`)}>رد مأموریت</button>
        </> : null}
        {order.status === 'PICKED_UP' ? <button className="success large-action" disabled={busy} onClick={() => action(`orders/${order.id}/delivered`)}>تحویل به مشتری انجام شد</button> : null}
      </div>
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
    setProfile((existing) => existing ? { ...existing, lastLatitude: latitude, lastLongitude: longitude, lastSeenAt: new Date().toISOString() } : existing);
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
    setActionBusy(true);
    setError('');
    try {
      await api('availability', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تغییر وضعیت ناموفق بود');
    } finally {
      setActionBusy(false);
    }
  }

  async function orderAction(path: string) {
    setActionBusy(true);
    setError('');
    try {
      await api(path, { method: 'POST' });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'عملیات ناموفق بود');
    } finally {
      setActionBusy(false);
    }
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

  const lastSeen = profile?.lastSeenAt
    ? new Date(profile.lastSeenAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const courierLocation = profile ? {
    latitude: profile.lastLatitude,
    longitude: profile.lastLongitude,
  } : null;

  return (
    <main className="shell dashboard-shell">
      <header className="app-header">
        <div className="app-identity">
          <div className="mini-mark">پ</div>
          <div><span>ارسال بهشهر</span><strong>پنل پیک</strong></div>
        </div>
        <button className="icon-text-button" type="button" onClick={() => void logout()}>خروج</button>
      </header>

      {loading ? <section className="skeleton-card"><div /><div /><div /></section> : null}
      {error ? <p className="error banner" role="alert">{error}</p> : null}

      {profile ? <section className={`shift-card shift-${profile.status.toLowerCase()}`}>
        <div className="shift-topline">
          <span className="shift-badge"><i />{statusLabel[profile.status] ?? profile.status}</span>
          <span className="vehicle-chip">{profile.vehicleType === 'MOTORBIKE' ? 'موتورسیکلت' : 'خودرو'}</span>
        </div>
        <div className="shift-copy">
          <span className="eyebrow">وضعیت شیفت</span>
          <h1>{profile.status === 'AVAILABLE' ? 'آماده‌ای سفارش بگیری' : profile.status === 'BUSY' ? 'مأموریت در حال انجام است' : profile.status === 'SUSPENDED' ? 'حساب پیک تعلیق شده' : 'برای شروع شیفت آنلاین شو'}</h1>
          <p>{profile.status === 'AVAILABLE' ? 'سفارش‌های جدید به‌صورت خودکار هر ۱۰ ثانیه نمایش داده می‌شوند.' : profile.status === 'BUSY' ? 'مراحل مأموریت را از کارت پایین مدیریت کن.' : 'تا وقتی آفلاین هستی سفارشی به صف تو اضافه نمی‌شود.'}</p>
        </div>
        <div className="shift-actions">
          <button className="online-button" disabled={actionBusy || profile.status === 'AVAILABLE' || profile.status === 'BUSY' || profile.status === 'SUSPENDED'} onClick={() => void setAvailability('AVAILABLE')}><span className="button-dot" />آنلاین شو</button>
          <button className="offline-button" disabled={actionBusy || profile.status === 'OFFLINE' || profile.status === 'BUSY' || profile.status === 'SUSPENDED'} onClick={() => void setAvailability('OFFLINE')}>پایان شیفت</button>
        </div>
      </section> : null}

      <section className="tool-strip">
        <button className="tool-card" type="button" onClick={locateNow}>
          <span className="tool-icon">⌖</span>
          <span><strong>GPS پیک</strong><small>{locationStatus}</small></span>
        </button>
        <button className="tool-card compact-tool" type="button" onClick={() => void load()}>
          <span className="tool-icon">↻</span>
          <span><strong>بروزرسانی</strong><small>{lastSeen ? `آخرین GPS ${lastSeen}` : 'دریافت وضعیت جدید'}</small></span>
        </button>
      </section>

      {current ? <section className="section current-section">
        <div className="section-head">
          <div><span className="eyebrow">مأموریت جاری</span><h2>سفارش فعال</h2></div>
          <span className="live-chip"><i />زنده</span>
        </div>
        <OrderCard order={current} action={orderAction} busy={actionBusy} current courierLocation={courierLocation} />
      </section> : null}

      {!current && profile?.status === 'AVAILABLE' ? <section className="section queue-section">
        <div className="section-head">
          <div><span className="eyebrow">صف سفارش‌ها</span><h2>آماده دریافت</h2></div>
          <span className="queue-count">{queue.length.toLocaleString('fa-IR')}</span>
        </div>
        {queue.length ? <div className="order-list">{queue.map((order) => <OrderCard key={order.id} order={order} action={orderAction} busy={actionBusy} />)}</div> : <div className="empty-state"><div className="empty-radar"><i /><i /><i /></div><strong>فعلاً سفارشی در صف نیست</strong><span>آنلاین بمان؛ با ثبت سفارش جدید این صفحه خودکار بروزرسانی می‌شود.</span></div>}
      </section> : null}

      {!current && profile?.status === 'OFFLINE' ? <div className="empty-state offline-empty"><div className="empty-power">◉</div><strong>شیفتت هنوز شروع نشده</strong><span>برای مشاهده و قبول سفارش‌های اطراف، از کارت بالا آنلاین شو.</span></div> : null}
      {profile?.status === 'SUSPENDED' ? <div className="empty-state suspended-empty"><strong>دسترسی به دریافت سفارش متوقف است</strong><span>برای بررسی وضعیت حساب با مدیریت ناوگان تماس بگیر.</span></div> : null}

      <p className="footer-note">ارسال موقعیت در نسخه فعلی فقط هنگام باز بودن PWA انجام می‌شود.</p>
    </main>
  );
}
