'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './couriers.module.css';

type VehicleType = 'MOTORBIKE' | 'CAR';
type CourierStatus = 'OFFLINE' | 'AVAILABLE' | 'BUSY' | 'SUSPENDED';
type Courier = {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  vehicleType: VehicleType;
  status: CourierStatus;
  activeOrders: number;
  maxActiveOrders: number;
  userStatus: 'ACTIVE' | 'SUSPENDED';
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastSeenAt: string | null;
  totalDeliveries: number;
  todayDeliveries: number;
  totalGrossFareToman: number;
  todayGrossFareToman: number;
  createdAt: string;
};
type FormValues = { fullName: string; phone: string; vehicleType: VehicleType };
const emptyForm: FormValues = { fullName: '', phone: '', vehicleType: 'MOTORBIKE' };
const statusLabels: Record<CourierStatus, string> = {
  OFFLINE: 'آفلاین', AVAILABLE: 'آماده', BUSY: 'در مأموریت', SUSPENDED: 'تعلیق',
};
const toman = (n: number) => n.toLocaleString('fa-IR');
const formatDate = (value: string) => new Date(value).toLocaleString('fa-IR', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit',
});

function mapUrl(latitude: number, longitude: number) {
  const b = 0.01;
  const bbox = [longitude - b, latitude - b, longitude + b, latitude + b].join(',');
  return 'https://www.openstreetmap.org/export/embed.html?bbox='
    + encodeURIComponent(bbox) + '&layer=mapnik&marker='
    + encodeURIComponent(latitude + ',' + longitude);
}

export default function CouriersPage() {
  const router = useRouter();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | CourierStatus>('ALL');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch('/api/admin/' + path, { ...init, cache: 'no-store' });
    if (response.status === 401 || response.status === 403) {
      router.replace('/');
      throw new Error('نشست مدیریت پایان یافته');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = Array.isArray(body.message) ? body.message.join('، ') : body.message;
      throw new Error(message || 'درخواست ناموفق بود');
    }
    return body;
  }, [router]);

  const load = useCallback(async () => {
    const result = await api('couriers') as Courier[];
    setCouriers(result);
  }, [api]);

  useEffect(() => {
    void load().catch((cause) => setError(cause instanceof Error ? cause.message : 'خطا در بارگذاری رانندگان'))
      .finally(() => setLoading(false));
    const timer = window.setInterval(() => { void load().catch(() => undefined); }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const selected = couriers.find((courier) => courier.id === selectedId) ?? null;
  const stats = useMemo(() => ({
    available: couriers.filter((courier) => courier.status === 'AVAILABLE').length,
    busy: couriers.filter((courier) => courier.status === 'BUSY').length,
    todayDeliveries: couriers.reduce((sum, courier) => sum + courier.todayDeliveries, 0),
    todayFare: couriers.reduce((sum, courier) => sum + courier.todayGrossFareToman, 0),
  }), [couriers]);
  const visible = useMemo(() => couriers.filter((courier) => {
    const term = query.trim().toLowerCase();
    return (filter === 'ALL' || courier.status === filter)
      && (!term || courier.fullName.toLowerCase().includes(term) || courier.phone.includes(term));
  }), [couriers, filter, query]);

  function clearForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  function edit(courier: Courier) {
    setEditingId(courier.id);
    setSelectedId(courier.id);
    setForm({ fullName: courier.fullName, phone: courier.phone, vehicleType: courier.vehicleType });
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    const wasEditing = Boolean(editingId);
    try {
      const saved = await api(editingId ? 'couriers/' + editingId : 'couriers', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, fullName: form.fullName.trim(), phone: form.phone.trim() }),
      }) as { id: string };
      await load();
      setSelectedId(saved.id);
      clearForm();
      setSuccess(wasEditing ? 'اطلاعات راننده ذخیره شد.' : 'حساب راننده ساخته شد؛ با شماره ثبت‌شده می‌تواند کد ورود بگیرد.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ذخیره راننده ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(courier: Courier) {
    const suspend = courier.status !== 'SUSPENDED';
    if (suspend && !window.confirm('حساب این راننده تعلیق شود؟ امکان ورود و دریافت سفارش را از دست می‌دهد.')) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api('couriers/' + courier.id + '/' + (suspend ? 'suspend' : 'activate'), { method: 'POST' });
      await load();
      setSuccess(suspend ? 'حساب راننده تعلیق شد.' : 'حساب راننده فعال شد؛ راننده باید شیفت را آنلاین کند.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تغییر وضعیت ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  const hasLocation = selected && selected.lastLatitude !== null && selected.lastLongitude !== null;
  const freshGPS = selected?.lastSeenAt
    ? Date.now() - new Date(selected.lastSeenAt).getTime() < 120000
    : false;

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.overline}>مرکز عملیات ارسال بهشهر</span>
        <h1>مدیریت رانندگان</h1>
        <p>ثبت حساب، کنترل دسترسی، بررسی مأموریت‌ها و آخرین موقعیت GPS</p></div>
      <Link className={styles.back} href="/home">بازگشت به برد سفارش‌ها</Link>
    </header>

    {error ? <div role="alert" className={styles.error}>{error}</div> : null}
    {success ? <div role="status" className={styles.success}>{success}</div> : null}

    <section className={styles.stats}>
      <div><span>کل رانندگان</span><strong>{toman(couriers.length)}</strong></div>
      <div><span>آماده دریافت</span><strong>{toman(stats.available)}</strong></div>
      <div><span>در مأموریت</span><strong>{toman(stats.busy)}</strong></div>
      <div><span>تحویل امروز</span><strong>{toman(stats.todayDeliveries)}</strong></div>
      <div><span>کرایه ناخالص امروز</span><strong>{toman(stats.todayFare)} <small>تومان</small></strong></div>
    </section>

    <div className={styles.layout}>
      <section className={styles.card}>
        <div className={styles.cardHead}><div>
          <h2>{editingId ? 'ویرایش راننده' : 'افزودن راننده جدید'}</h2>
          <p>حساب فقط توسط مدیر ساخته می‌شود؛ راننده با کد پیامکی وارد اپ پیک می‌شود.</p>
        </div>{editingId ? <button className={styles.textButton} onClick={clearForm} type="button">لغو ویرایش</button> : null}</div>
        <form onSubmit={save} className={styles.form}>
          <label>نام و نام خانوادگی
            <input autoComplete="name" maxLength={100} minLength={2} required
              placeholder="نام کامل راننده" value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
          </label>
          <label>شماره موبایل
            <input autoComplete="tel" dir="ltr" type="tel" required inputMode="tel"
              placeholder="09111234567" value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>
          <label>نوع وسیله نقلیه
            <select value={form.vehicleType} onChange={(event) => setForm({ ...form, vehicleType: event.target.value as VehicleType })}>
              <option value="MOTORBIKE">موتورسیکلت</option><option value="CAR">خودرو</option>
            </select>
          </label>
          <button className={styles.primary} disabled={busy} type="submit">
            {busy ? 'در حال ثبت…' : editingId ? 'ذخیره تغییرات' : 'ساخت حساب راننده'}
          </button>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><div><h2>فهرست رانندگان</h2>
          <p>وضعیت‌ها هر ۱۵ ثانیه بروزرسانی می‌شوند.</p></div>
          <button className={styles.textButton} disabled={busy} type="button" onClick={() => void load().catch((cause) => setError(String(cause)))}>بروزرسانی</button>
        </div>
        <div className={styles.filters}>
          <input aria-label="جستجوی راننده" placeholder="جستجو با نام یا موبایل…" value={query}
            onChange={(event) => setQuery(event.target.value)} />
          <select aria-label="فیلتر وضعیت" value={filter}
            onChange={(event) => setFilter(event.target.value as 'ALL' | CourierStatus)}>
            <option value="ALL">همه وضعیت‌ها</option>
            <option value="AVAILABLE">آماده</option><option value="BUSY">در مأموریت</option>
            <option value="OFFLINE">آفلاین</option><option value="SUSPENDED">تعلیق</option>
          </select>
        </div>
        {loading ? <p className={styles.empty}>در حال دریافت اطلاعات…</p>
          : visible.length ? <div className={styles.list}>{visible.map((courier) =>
          <article key={courier.id} className={styles.row}>
            <div className={styles.driverIcon}>{courier.vehicleType === 'MOTORBIKE' ? 'م' : 'خ'}</div>
            <div className={styles.driverInfo}>
              <strong>{courier.fullName || 'نام ثبت‌نشده'}</strong>
              <span dir="ltr">{courier.phone}</span>
              <small>{courier.vehicleType === 'MOTORBIKE' ? 'موتورسیکلت' : 'خودرو'} • {courier.activeOrders}/{courier.maxActiveOrders} مأموریت باز • {toman(courier.todayDeliveries)} تحویل امروز</small>
            </div>
            <span className={styles.badge} data-status={courier.status}>{statusLabels[courier.status]}</span>
            <div className={styles.rowButtons}>
              <button type="button" onClick={() => setSelectedId(courier.id)}>جزئیات</button>
              <button type="button" onClick={() => edit(courier)}>ویرایش</button>
              <button className={courier.status === 'SUSPENDED' ? styles.activate : styles.suspend}
                type="button" disabled={busy || courier.status === 'BUSY'}
                title={courier.status === 'BUSY' ? 'راننده ابتدا باید مأموریت را تمام کند' : ''}
                onClick={() => void changeStatus(courier)}>
                {courier.status === 'SUSPENDED' ? 'فعال‌سازی' : 'تعلیق'}
              </button>
            </div>
          </article>)}</div> : <p className={styles.empty}>راننده‌ای با این فیلتر پیدا نشد.</p>}
      </section>
    </div>

    {selected ? <section className={styles.card + ' ' + styles.details}>
      <div className={styles.cardHead}><div><span className={styles.overline}>جزئیات راننده</span>
        <h2>{selected.fullName || selected.phone}</h2>
        <p>{selected.phone} • {statusLabels[selected.status]} • ثبت‌شده در {formatDate(selected.createdAt)}</p>
      </div><button type="button" className={styles.textButton} onClick={() => setSelectedId(null)}>بستن</button></div>
      <div className={styles.detailColumns}>
        <div>
          <div className={styles.tripStats}>
            <div><span>تحویل امروز</span><strong>{toman(selected.todayDeliveries)}</strong></div>
            <div><span>کل تحویل‌ها</span><strong>{toman(selected.totalDeliveries)}</strong></div>
            <div><span>کرایه ناخالص امروز</span><strong>{toman(selected.todayGrossFareToman)} <small>تومان</small></strong></div>
            <div><span>کرایه ناخالص کل</span><strong>{toman(selected.totalGrossFareToman)} <small>تومان</small></strong></div>
          </div>
          <p className={styles.note}>مبالغ، مجموع کرایه سفارش‌های تحویل‌شده هستند؛ درآمد خالص، کمیسیون و تسویه راننده هنوز محاسبه نمی‌شوند.</p>
          <p className={styles.gpsStatus}>آخرین GPS: {selected.lastSeenAt ? formatDate(selected.lastSeenAt) : 'ثبت نشده'}
            {freshGPS ? ' • دریافت اخیر' : ' • موقعیت ممکن است قدیمی باشد'}</p>
          <button type="button" className={styles.primary} onClick={() => edit(selected)}>ویرایش مشخصات</button>
        </div>
        <div className={styles.mapPanel}>
          {hasLocation ? <>
            <iframe title={'آخرین موقعیت ' + (selected.fullName || selected.phone)}
              loading="lazy" referrerPolicy="no-referrer"
              src={mapUrl(selected.lastLatitude!, selected.lastLongitude!)} />
            <a target="_blank" rel="noopener noreferrer"
              href={'https://www.openstreetmap.org/?mlat=' + selected.lastLatitude + '&mlon=' + selected.lastLongitude + '#map=15/' + selected.lastLatitude + '/' + selected.lastLongitude}>
              باز کردن موقعیت روی نقشه
            </a>
          </> : <div className={styles.noGps}>موقعیتی دریافت نشده؛ راننده باید اپ پیک را باز کند و اجازه GPS بدهد.</div>}
        </div>
      </div>
    </section> : null}
  </main>;
}
