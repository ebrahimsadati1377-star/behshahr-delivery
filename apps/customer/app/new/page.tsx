'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RouteMap } from '../components/route-map';

interface Address {
  id: string;
  title: string;
  formattedAddress: string;
  latitude?: number | string;
  longitude?: number | string;
}

interface Quote {
  quoteId: string;
  vehicleType: 'MOTORBIKE' | 'CAR';
  distanceMeters: number;
  estimatedDurationSeconds: number;
  priceToman: number;
  currency: string;
  expiresInSeconds: number;
  routingMode?: 'NESHAN' | 'APPROXIMATE' | 'APPROXIMATE_FALLBACK';
}

function toman(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value);
}

function routingLabel(mode?: Quote['routingMode']) {
  if (mode === 'NESHAN') return 'مسیر واقعی نشان';
  if (mode === 'APPROXIMATE_FALLBACK') return 'تخمین مسیر (جایگزین موقت)';
  return 'تخمین مسیر';
}

export default function NewOrderPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [pickupAddressId, setPickupAddressId] = useState('');
  const [dropoffAddressId, setDropoffAddressId] = useState('');
  const [vehicleType, setVehicleType] = useState<'MOTORBIKE' | 'CAR'>('MOTORBIKE');
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/customer/addresses', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace('/');
          return [];
        }
        const body = await response.json().catch(() => ([]));
        if (!response.ok) throw new Error(body.message ?? 'دریافت آدرس‌ها ناموفق بود');
        return body;
      })
      .then((body: Address[]) => {
        setAddresses(body);
        if (body[0]) setPickupAddressId(body[0].id);
        if (body[1]) setDropoffAddressId(body[1].id);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'خطا در دریافت آدرس‌ها'))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    setQuote(null);
  }, [pickupAddressId, dropoffAddressId, vehicleType]);

  const canQuote = useMemo(
    () => pickupAddressId && dropoffAddressId && pickupAddressId !== dropoffAddressId,
    [pickupAddressId, dropoffAddressId],
  );

  const pickupAddress = useMemo(
    () => addresses.find((address) => address.id === pickupAddressId) ?? null,
    [addresses, pickupAddressId],
  );
  const dropoffAddress = useMemo(
    () => addresses.find((address) => address.id === dropoffAddressId) ?? null,
    [addresses, dropoffAddressId],
  );

  async function getQuote() {
    if (!canQuote) return;
    setQuoting(true);
    setError('');
    try {
      const response = await fetch('/api/customer/quotes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pickupAddressId, dropoffAddressId, vehicleType }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? 'محاسبه هزینه ناموفق بود');
      setQuote(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'خطا در محاسبه هزینه');
    } finally {
      setQuoting(false);
    }
  }

  async function createOrder() {
    if (!quote) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/customer/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.quoteId,
          paymentMethod: 'CASH',
          notes: notes.trim() || undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? 'ثبت سفارش ناموفق بود');
      router.replace(`/orders/${body.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'خطا در ثبت سفارش');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <div className="topbar">
        <Link href="/home" className="text-link">بازگشت</Link>
        <strong>ارسال جدید</strong>
        <span />
      </div>

      {loading ? <p className="muted">در حال دریافت آدرس‌ها…</p> : null}

      {!loading && addresses.length < 2 ? (
        <section className="card">
          <h2 className="section-title">دو آدرس لازم است</h2>
          <p className="muted">برای مبدا و مقصد حداقل دو آدرس ذخیره کن.</p>
          <Link className="primary link-button" href="/addresses">مدیریت آدرس‌ها</Link>
        </section>
      ) : null}

      {!loading && addresses.length >= 2 ? (
        <>
          <section className="card compact-card">
            <div className="field">
              <label htmlFor="pickup">مبدا</label>
              <select id="pickup" className="input" value={pickupAddressId} onChange={(event) => setPickupAddressId(event.target.value)}>
                {addresses.map((address) => <option value={address.id} key={address.id}>{address.title} — {address.formattedAddress}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="dropoff">مقصد</label>
              <select id="dropoff" className="input" value={dropoffAddressId} onChange={(event) => setDropoffAddressId(event.target.value)}>
                {addresses.map((address) => <option value={address.id} key={address.id}>{address.title} — {address.formattedAddress}</option>)}
              </select>
            </div>

            {pickupAddressId !== dropoffAddressId ? <RouteMap pickup={pickupAddress} dropoff={dropoffAddress} /> : null}

            <div className="field">
              <label>وسیله ارسال</label>
              <div className="segmented">
                <button type="button" className={vehicleType === 'MOTORBIKE' ? 'segment active' : 'segment'} onClick={() => setVehicleType('MOTORBIKE')}>موتور</button>
                <button type="button" className={vehicleType === 'CAR' ? 'segment active' : 'segment'} onClick={() => setVehicleType('CAR')}>خودرو</button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="notes">توضیحات اختیاری</label>
              <input id="notes" className="input" placeholder="مثلاً بسته شکستنی است" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
            </div>

            {pickupAddressId === dropoffAddressId ? <p className="error">مبدا و مقصد نمی‌توانند یکسان باشند.</p> : null}
            <button className="primary" type="button" disabled={!canQuote || quoting} onClick={getQuote}>{quoting ? 'در حال محاسبه…' : 'محاسبه هزینه ارسال'}</button>
          </section>

          {quote ? (
            <section className="quote-card">
              <div>
                <span className="eyebrow">هزینه ارسال</span>
                <strong className="price">{toman(quote.priceToman)} تومان</strong>
              </div>
              <div className="quote-meta">
                <span>{routingLabel(quote.routingMode)}</span>
                <span>فاصله {new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(quote.distanceMeters / 1000)} کیلومتر</span>
                <span>زمان {Math.max(1, Math.round(quote.estimatedDurationSeconds / 60)).toLocaleString('fa-IR')} دقیقه</span>
                <span>پرداخت: نقدی هنگام تحویل</span>
              </div>
              <p className="muted">این قیمت حدود {Math.round(quote.expiresInSeconds / 60).toLocaleString('fa-IR')} دقیقه اعتبار دارد.</p>
              <button className="primary" type="button" disabled={submitting} onClick={createOrder}>{submitting ? 'در حال ثبت…' : 'تایید و ثبت درخواست'}</button>
            </section>
          ) : null}
        </>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
