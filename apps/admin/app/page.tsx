'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'phone' | 'code';

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submitPhone(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const response = await fetch('/api/session/request-otp', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ phone }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? 'ارسال کد ناموفق بود');
      setStep('code');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'خطای غیرمنتظره'); }
    finally { setLoading(false); }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const response = await fetch('/api/session/verify-otp', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ phone, code }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? 'ورود ناموفق بود');
      router.replace('/home'); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'خطای غیرمنتظره'); }
    finally { setLoading(false); }
  }

  return <main className="login">
    <div className="brand"><div className="mark">م</div><div><h1>مدیریت ارسال بهشهر</h1><p>عملیات و دیسپچ ناوگان</p></div></div>
    <section className="card login-card">
      <h2>{step === 'phone' ? 'ورود مدیر' : 'کد تایید'}</h2>
      <p className="muted">{step === 'phone' ? 'فقط شماره‌های دارای نقش ADMIN امکان ورود دارند.' : `کد ۶ رقمی ارسال‌شده برای ${phone} را وارد کن.`}</p>
      {step === 'phone' ? <form onSubmit={submitPhone}><label className="field">شماره موبایل<input className="input" dir="ltr" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09111234567" required /></label><button className="primary wide" disabled={loading}>{loading ? 'در حال ارسال…' : 'دریافت کد تایید'}</button></form> : <form onSubmit={submitCode}><label className="field">کد تایید<input className="input otp" dir="ltr" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))} required /></label><button className="primary wide" disabled={loading || code.length !== 6}>{loading ? 'در حال بررسی…' : 'ورود به پنل'}</button><button className="secondary wide" type="button" onClick={() => { setStep('phone'); setCode(''); setError(''); }}>تغییر شماره</button></form>}
      {error ? <p className="error">{error}</p> : null}
    </section>
  </main>;
}
