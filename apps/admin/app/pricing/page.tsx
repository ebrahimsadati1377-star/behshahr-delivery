'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './pricing.module.css';

type VehicleType = 'MOTORBIKE' | 'CAR';

type PricingRule = {
  id: string;
  vehicleType: VehicleType;
  baseFareToman: number;
  includedDistanceMeters: number;
  perKmFareToman: number;
  minimumFareToman: number;
  surgeMultiplier: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  vehicleType: VehicleType;
  baseFare: string;
  includedDistanceMeters: string;
  perKmFare: string;
  minimumFare: string;
  surgeMultiplier: string;
};

const initialForm: FormState = {
  vehicleType: 'MOTORBIKE',
  baseFare: '50000',
  includedDistanceMeters: '1000',
  perKmFare: '15000',
  minimumFare: '50000',
  surgeMultiplier: '1',
};

const toman = (value: number) => new Intl.NumberFormat('fa-IR').format(value);
const vehicleLabel = (vehicle: VehicleType) => vehicle === 'MOTORBIKE' ? 'موتور' : 'خودرو';

export default function PricingPage() {
  const router = useRouter();
  const [rules, setRules] = useState<PricingRule[]>([]);
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
    const next = await api('pricing-rules') as PricingRule[];
    setRules(next);
  }, [api]);

  useEffect(() => {
    load().catch((cause) => setError(cause instanceof Error ? cause.message : 'خطا در دریافت قیمت‌ها')).finally(() => setLoading(false));
  }, [load]);

  const activeRules = useMemo(() => ({
    MOTORBIKE: rules.find((rule) => rule.vehicleType === 'MOTORBIKE' && rule.isActive) ?? null,
    CAR: rules.find((rule) => rule.vehicleType === 'CAR' && rule.isActive) ?? null,
  }), [rules]);

  function useCurrent(vehicleType: VehicleType) {
    const current = activeRules[vehicleType];
    setForm(current ? {
      vehicleType,
      baseFare: String(current.baseFareToman),
      includedDistanceMeters: String(current.includedDistanceMeters),
      perKmFare: String(current.perKmFareToman),
      minimumFare: String(current.minimumFareToman),
      surgeMultiplier: String(current.surgeMultiplier),
    } : { ...initialForm, vehicleType });
    setError('');
    setSuccess('');
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api('pricing-rules', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          vehicleType: form.vehicleType,
          baseFare: Number(form.baseFare),
          includedDistanceMeters: Number(form.includedDistanceMeters),
          perKmFare: Number(form.perKmFare),
          minimumFare: Number(form.minimumFare),
          surgeMultiplier: Number(form.surgeMultiplier),
        }),
      });
      await load();
      setSuccess(`قیمت جدید ${vehicleLabel(form.vehicleType)} فعال شد.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ثبت قیمت ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id: string) {
    if (!window.confirm('این قیمت غیرفعال شود؟ تا ثبت قیمت جدید، Quote برای این وسیله در دسترس نخواهد بود.')) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api(`pricing-rules/${id}/deactivate`, { method: 'POST' });
      await load();
      setSuccess('قیمت غیرفعال شد.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'غیرفعال‌سازی ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  return <main className={styles.page}>
    <header className={styles.head}>
      <div><p>مرکز عملیات</p><h1>مدیریت کرایه</h1><p>هر انتشار، قیمت قبلی همان وسیله را آرشیو و قیمت جدید را فعال می‌کند.</p></div>
      <Link href="/home" className={styles.back}>بازگشت به برد</Link>
    </header>

    {error ? <p className={styles.error}>{error}</p> : null}
    {success ? <p className={styles.success}>{success}</p> : null}

    <section className={styles.activeGrid}>
      {(['MOTORBIKE', 'CAR'] as VehicleType[]).map((vehicle) => {
        const rule = activeRules[vehicle];
        return <div className={styles.activeCard} key={vehicle}>
          <span>قیمت فعال {vehicleLabel(vehicle)}</span>
          {rule ? <><strong className={styles.price}>{toman(rule.baseFareToman)} تومان پایه</strong><div className={styles.meta}><i>{toman(rule.perKmFareToman)} / کیلومتر</i><i>حداقل {toman(rule.minimumFareToman)}</i><i>ضریب ×{rule.surgeMultiplier.toLocaleString('fa-IR')}</i></div></> : <strong>قیمت فعالی وجود ندارد</strong>}
        </div>;
      })}
    </section>

    <div className={styles.layout}>
      <form className={`${styles.card} ${styles.form}`} onSubmit={publish}>
        <h2>انتشار قیمت جدید</h2>
        <p className={styles.hint}>مبالغ به تومان هستند. قیمت قبلی حذف نمی‌شود و برای تاریخچه باقی می‌ماند.</p>

        <label className={styles.field}>نوع وسیله
          <select value={form.vehicleType} onChange={(e) => useCurrent(e.target.value as VehicleType)}>
            <option value="MOTORBIKE">موتور</option><option value="CAR">خودرو</option>
          </select>
        </label>

        <div className={styles.grid}>
          <label className={styles.field}>کرایه پایه<input type="number" min="0" step="1" value={form.baseFare} onChange={(e) => setForm({...form,baseFare:e.target.value})} required /></label>
          <label className={styles.field}>حداقل کرایه<input type="number" min="0" step="1" value={form.minimumFare} onChange={(e) => setForm({...form,minimumFare:e.target.value})} required /></label>
          <label className={styles.field}>مسافت شامل پایه (متر)<input type="number" min="0" step="1" value={form.includedDistanceMeters} onChange={(e) => setForm({...form,includedDistanceMeters:e.target.value})} required /></label>
          <label className={styles.field}>کرایه هر کیلومتر<input type="number" min="0" step="1" value={form.perKmFare} onChange={(e) => setForm({...form,perKmFare:e.target.value})} required /></label>
        </div>
        <label className={styles.field}>ضریب قیمت<input type="number" min="0.1" step="0.01" value={form.surgeMultiplier} onChange={(e) => setForm({...form,surgeMultiplier:e.target.value})} required /></label>
        <button className={styles.publish} disabled={busy}>{busy ? 'در حال ثبت…' : 'انتشار و فعال‌سازی قیمت'}</button>
      </form>

      <section className={`${styles.card} ${styles.history}`}>
        <div className={styles.historyHead}><h2>تاریخچه قیمت‌ها</h2><span>{rules.length.toLocaleString('fa-IR')} مورد</span></div>
        {loading ? <div className={styles.empty}>در حال دریافت…</div> : rules.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>وسیله</th><th>پایه</th><th>هر کیلومتر</th><th>حداقل</th><th>ضریب</th><th>وضعیت</th><th>زمان</th><th /></tr></thead><tbody>
          {rules.map((rule) => <tr key={rule.id}><td>{vehicleLabel(rule.vehicleType)}</td><td>{toman(rule.baseFareToman)}</td><td>{toman(rule.perKmFareToman)}</td><td>{toman(rule.minimumFareToman)}</td><td>×{rule.surgeMultiplier.toLocaleString('fa-IR')}</td><td><span className={`${styles.status} ${rule.isActive ? styles.statusActive : ''}`}>{rule.isActive ? 'فعال' : 'آرشیو'}</span></td><td>{new Date(rule.createdAt).toLocaleString('fa-IR')}</td><td>{rule.isActive ? <button type="button" className={styles.deactivate} disabled={busy} onClick={() => void deactivate(rule.id)}>غیرفعال</button> : null}</td></tr>)}
        </tbody></table></div> : <div className={styles.empty}>هنوز قانون قیمتی ثبت نشده.</div>}
      </section>
    </div>
  </main>;
}
