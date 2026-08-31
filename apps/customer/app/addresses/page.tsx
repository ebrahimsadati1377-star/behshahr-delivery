'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Address {
  id: string;
  title: string;
  formattedAddress: string;
  latitude: string | number;
  longitude: string | number;
  details?: string | null;
}

const emptyForm = {
  title: '',
  formattedAddress: '',
  latitude: '',
  longitude: '',
  details: '',
};

export default function AddressesPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/customer/addresses', { cache: 'no-store' });
    if (response.status === 401) {
      router.replace('/');
      return;
    }
    const body = await response.json().catch(() => ([]));
    if (!response.ok) throw new Error(body.message ?? 'دریافت آدرس‌ها ناموفق بود');
    setAddresses(body);
  }, [router]);

  useEffect(() => {
    load()
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'خطا در دریافت آدرس‌ها'))
      .finally(() => setLoading(false));
  }, [load]);

  function useCurrentLocation() {
    setError('');
    if (!navigator.geolocation) {
      setError('موقعیت مکانی روی این دستگاه در دسترس نیست.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
      },
      () => setError('دسترسی به موقعیت مکانی داده نشد.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        formattedAddress: form.formattedAddress.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        details: form.details.trim() || undefined,
      };
      const response = await fetch(
        editId ? `/api/customer/addresses/${editId}` : '/api/customer/addresses',
        {
          method: editId ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? 'ذخیره آدرس ناموفق بود');
      setForm(emptyForm);
      setEditId(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'خطا در ذخیره آدرس');
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(address: Address) {
    setEditId(address.id);
    setForm({
      title: address.title,
      formattedAddress: address.formattedAddress,
      latitude: String(address.latitude),
      longitude: String(address.longitude),
      details: address.details ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(id: string) {
    if (!window.confirm('این آدرس حذف شود؟')) return;
    setError('');
    const response = await fetch(`/api/customer/addresses/${id}`, { method: 'DELETE' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.message ?? 'حذف آدرس ناموفق بود');
      return;
    }
    await load();
  }

  return (
    <main className="shell">
      <div className="topbar">
        <Link href="/home" className="text-link">بازگشت</Link>
        <strong>آدرس‌های من</strong>
        <span />
      </div>

      <section className="card compact-card">
        <h2 className="section-title">{editId ? 'ویرایش آدرس' : 'افزودن آدرس'}</h2>
        <form onSubmit={save}>
          <div className="field">
            <label htmlFor="title">عنوان</label>
            <input id="title" className="input" placeholder="خانه، محل کار…" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          </div>
          <div className="field">
            <label htmlFor="formattedAddress">نشانی</label>
            <input id="formattedAddress" className="input" placeholder="بهشهر، خیابان…" value={form.formattedAddress} onChange={(event) => setForm({ ...form, formattedAddress: event.target.value })} required />
          </div>
          <button type="button" className="secondary" onClick={useCurrentLocation}>استفاده از موقعیت فعلی</button>
          <div className="two-cols" style={{ marginTop: 12 }}>
            <div className="field">
              <label htmlFor="latitude">عرض جغرافیایی</label>
              <input id="latitude" className="input" dir="ltr" inputMode="decimal" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="longitude">طول جغرافیایی</label>
              <input id="longitude" className="input" dir="ltr" inputMode="decimal" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="details">جزئیات اختیاری</label>
            <input id="details" className="input" placeholder="پلاک، طبقه، واحد…" value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} />
          </div>
          <button className="primary" type="submit" disabled={saving}>{saving ? 'در حال ذخیره…' : editId ? 'ذخیره تغییرات' : 'افزودن آدرس'}</button>
          {editId ? <button className="secondary" type="button" style={{ marginTop: 10 }} onClick={() => { setEditId(null); setForm(emptyForm); }}>انصراف از ویرایش</button> : null}
        </form>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section style={{ marginTop: 22 }}>
        <div className="section-head"><h2 className="section-title">آدرس‌های ذخیره‌شده</h2><span className="count-badge">{addresses.length}</span></div>
        {loading ? <p className="muted">در حال دریافت…</p> : null}
        {!loading && addresses.length === 0 ? <div className="empty-state">هنوز آدرسی ذخیره نکردی.</div> : null}
        <div className="grid">
          {addresses.map((address) => (
            <article className="action-card" key={address.id}>
              <strong>{address.title}</strong>
              <span>{address.formattedAddress}</span>
              {address.details ? <span>{address.details}</span> : null}
              <div className="row-actions">
                <button className="small-button" type="button" onClick={() => beginEdit(address)}>ویرایش</button>
                <button className="small-button danger" type="button" onClick={() => remove(address.id)}>حذف</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
