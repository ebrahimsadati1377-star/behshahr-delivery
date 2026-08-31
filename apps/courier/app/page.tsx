'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'phone' | 'code';

export default function CourierLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submitPhone(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/session/request-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? 'ارسال کد ناموفق بود');
      setStep('code');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'خطای غیرمنتظره');
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/session/verify-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? 'کد تایید صحیح نیست');
      router.replace('/home');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'خطای غیرمنتظره');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell login-shell">
      <div className="brand">
        <div className="brand-mark">پ</div>
        <div>
          <h1>پیک بهشهر</h1>
          <p>پنل موبایلی پیک‌های ارسال</p>
        </div>
      </div>
      <section className="hero">
        <span className="eyebrow">ورود پیک</span>
        <h2>{step === 'phone' ? 'شماره موبایل پیک' : 'کد تایید'}</h2>
        <p>{step === 'phone' ? 'با شماره ثبت‌شده در ناوگان وارد شو.' : `کد ۶ رقمی ارسال‌شده برای ${phone} را وارد کن.`}</p>
      </section>
      <section className="card">
        {step === 'phone' ? (
          <form onSubmit={submitPhone}>
            <label className="field" htmlFor="phone">
              <span>شماره موبایل</span>
              <input id="phone" className="input" dir="ltr" inputMode="tel" autoComplete="tel" placeholder="09111234567" value={phone} onChange={(event) => setPhone(event.target.value)} required />
            </label>
            <button className="primary" type="submit" disabled={loading}>{loading ? 'در حال ارسال…' : 'دریافت کد'}</button>
          </form>
        ) : (
          <form onSubmit={submitCode}>
            <label className="field" htmlFor="code">
              <span>کد تایید</span>
              <input id="code" className="input otp" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
            </label>
            <button className="primary" type="submit" disabled={loading || code.length !== 6}>{loading ? 'در حال بررسی…' : 'ورود به پنل پیک'}</button>
            <button className="secondary" type="button" onClick={() => { setStep('phone'); setCode(''); setError(''); }}>تغییر شماره</button>
          </form>
        )}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
