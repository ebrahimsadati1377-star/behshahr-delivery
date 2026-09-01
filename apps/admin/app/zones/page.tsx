'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './zones.module.css';

type ServiceZone = {
  id: string;
  name: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  name: string;
  centerLatitude: string;
  centerLongitude: string;
  radiusMeters: string;
};

const initialForm: FormState = {
  name: 'بهشهر',
  centerLatitude: '36.700000',
  centerLongitude: '53.550000',
  radiusMeters: '20000',
};

function meters(value: number) {
  if (value >= 1000) return `${(value / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} کیلومتر`;
  return `${value.toLocaleString('fa-IR')} متر`;
}

export default function ServiceZonesPage() {
  const router = useRouter();
  const [zones, setZones] = useState<ServiceZone[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(`/api/admin/${path}`, { ...init, cache: 'no-store' });
    if (response.status === 401 || response.status === 403) {
      router.replace('/');
      throw new Error('نشست مدیریت پایان یافته');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message ?? 'درخواست ناموفق بود');
    return body;
  }, [router]);

  const load = useCallback(async () => {
    setZones(await api('service-zones') as ServiceZone[]);
  }, [api]);

  useEffect(() => {
    load().catch((cause) => setError(cause instanceof Error ? cause.message : 'خطا در دریافت محدوده‌ها')).finally(() => setLoading(false));
  }, [load]);

  const activeCount = useMemo(() => zones.filter((zone) => zone.isActive).length, [zones]);

  async function createZone(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const zone = await api('service-zones', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          centerLatitude: Number(form.centerLatitude),
          centerLongitude: Number(form.centerLongitude),
          radiusMeters: Number(form.radiusMeters),
        }),
      }) as ServiceZone;
      await load();
      setSuccess(`محدوده «${zone.name}» فعال شد.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ساخت محدوده ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(zone: ServiceZone) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api(`service-zones/${zone.id}/${zone.isActive ? 'deactivate' : 'activate'}`, { method: 'POST' });
      await load();
      setSuccess(zone.isActive ? 'محدوده غیرفعال شد.' : 'محدوده فعال شد.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تغییر وضعیت محدوده ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  function useMyLocation() {
    setError('');
    if (!('geolocation' in navigator)) {
      setError('GPS در این دستگاه در دسترس نیست.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setForm((current) => ({
        ...current,
        centerLatitude: position.coords.latitude.toFixed(6),
        centerLongitude: position.coords.longitude.toFixed(6),
      })),
      () => setError('دسترسی به موقعیت ممکن نیست.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  return <main className={styles.page}>
    <header className={styles.head}>
      <div><p>مرکز عملیات</p><h1>محدوده سرویس</h1><p>Quote فقط وقتی صادر می‌شود که مبدا و مقصد داخل حداقل یک محدوده فعال باشند.</p></div>
      <Link href="/home" className={styles.back}>بازگشت به برد</Link>
    </header>

    {error ? <p className={styles.error}>{error}</p> : null}
    {success ? <p className={styles.success}>{success}</p> : null}

    <section className={styles.summary}>
      <div><span>کل محدوده‌ها</span><strong>{zones.length.toLocaleString('fa-IR')}</strong></div>
      <div><span>محدوده فعال</span><strong>{activeCount.toLocaleString('fa-IR')}</strong></div>
      <div><span>موتور اعتبارسنجی</span><strong>PostGIS</strong></div>
    </section>

    <div className={styles.layout}>
      <form className={styles.card} onSubmit={createZone}>
        <h2>ساخت محدوده جدید</h2>
        <p className={styles.hint}>در نسخه فعلی مرکز و شعاع وارد می‌شود و سرور آن را به Polygon واقعی PostGIS تبدیل می‌کند.</p>
        <label className={styles.field}>نام محدوده<input value={form.name} onChange={(event) => setForm({...form,name:event.target.value})} maxLength={120} required /></label>
        <div className={styles.grid}>
          <label className={styles.field}>عرض جغرافیایی<input dir="ltr" type="number" step="0.000001" min="-90" max="90" value={form.centerLatitude} onChange={(event) => setForm({...form,centerLatitude:event.target.value})} required /></label>
          <label className={styles.field}>طول جغرافیایی<input dir="ltr" type="number" step="0.000001" min="-180" max="180" value={form.centerLongitude} onChange={(event) => setForm({...form,centerLongitude:event.target.value})} required /></label>
        </div>
        <button className={styles.location} type="button" onClick={useMyLocation}>استفاده از موقعیت فعلی</button>
        <label className={styles.field}>شعاع پوشش (متر)<input type="number" min="100" max="100000" step="100" value={form.radiusMeters} onChange={(event) => setForm({...form,radiusMeters:event.target.value})} required /></label>
        <div className={styles.preview}><span>پوشش تقریبی</span><strong>{meters(Number(form.radiusMeters) || 0)}</strong><small>مرکز: {form.centerLatitude || '—'} ، {form.centerLongitude || '—'}</small></div>
        <button className={styles.primary} disabled={busy}>{busy ? 'در حال ثبت…' : 'ساخت و فعال‌سازی محدوده'}</button>
      </form>

      <section className={styles.card}>
        <div className={styles.listHead}><div><h2>محدوده‌های ثبت‌شده</h2><p>فعال بودن چند Zone همزمان مجاز است؛ پوشش آنها به‌صورت OR محاسبه می‌شود.</p></div><button type="button" className={styles.refresh} onClick={() => void load()}>بروزرسانی</button></div>
        {loading ? <div className={styles.empty}>در حال دریافت…</div> : zones.length ? <div className={styles.zoneList}>{zones.map((zone) => <article className={styles.zone} key={zone.id}>
          <div className={styles.zoneMain}><div className={styles.zoneTitle}><strong>{zone.name}</strong><span className={zone.isActive ? styles.active : styles.inactive}>{zone.isActive ? 'فعال' : 'غیرفعال'}</span></div><p>{meters(zone.radiusMeters)} از مرکز ثبت‌شده</p><small dir="ltr">{zone.centerLatitude.toFixed(6)}, {zone.centerLongitude.toFixed(6)}</small></div>
          <div className={styles.zoneActions}><a href={`geo:${zone.centerLatitude},${zone.centerLongitude}?q=${zone.centerLatitude},${zone.centerLongitude}`}>مرکز روی نقشه</a><button type="button" disabled={busy} className={zone.isActive ? styles.disable : styles.enable} onClick={() => void toggle(zone)}>{zone.isActive ? 'غیرفعال' : 'فعال کن'}</button></div>
        </article>)}</div> : <div className={styles.empty}><strong>هنوز Zone دیتابیسی ساخته نشده</strong><span>تا قبل از ساخت اولین Zone، سیستم از محدوده قدیمی ENV استفاده می‌کند.</span></div>}
      </section>
    </div>
  </main>;
}
