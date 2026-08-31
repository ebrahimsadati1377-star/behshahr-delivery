'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'phone' | 'code';

export default function LoginPage() {
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
    <main className="shell">
      <div className="brand">
        <div className="brand-mark">ب</div>
        <div>
          <h1>ارسال بهشهر</h1>
          <p>ارسال شهری سریع و قابل پیگیری</p>
        </div>
      </div>

      <section className="hero">
        <h2>{step === 'phone' ? 'شماره موبایلت رو وارد کن' : 'کد تایید رو وارد کن'}</h2>
        <p>
          {step === 'phone'
            ? 'برای ثبت درخواست ارسال، ابتدا با شماره موبایل وارد شو.'
            : `کد ۶ رقمی ارسال‌شده برای ${phone} را وارد کن.`}
        </p>
      </section>

      <section className="card">
        {step === 'phone' ? (
          <form onSubmit={submitPhone}>
            <div className="field">
              <label htmlFor="phone">شماره موبایل</label>
              <input
                id="phone"
                className="input"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="09111234567"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </div>
            <button className="primary" type="submit" disabled={loading}>
              {loading ? 'در حال ارسال…' : 'دریافت کد تایید'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode}>
            <div className="field">
              <label htmlFor="code">کد تایید</label>
              <input
                id="code"
                className="input"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                required
              />
            </div>
            <button className="primary" type="submit" disabled={loading || code.length !== 6}>
              {loading ? 'در حال بررسی…' : 'ورود'}
            </button>
            <button
              className="secondary"
              type="button"
              style={{ marginTop: 10 }}
              onClick={() => {
                setStep('phone');
                setCode('');
                setError('');
              }}
            >
              تغییر شماره موبایل
            </button>
          </form>
        )}

        {error ? <p className="error">{error}</p> : null}
        <p className="muted" style={{ marginBottom: 0 }}>
          ورود به معنی پذیرش قوانین استفاده از سرویس است.
        </p>
      </section>
    </main>
  );
}
