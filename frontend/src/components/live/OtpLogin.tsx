import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/Icon';
import { Field, Spinner } from '@/components/ui';
import { auth, BackendError, type LiveUser } from '@/services/backend';
import { useUI } from '@/store';

const COUNTRIES = [
  { code: '91', name: 'India', flag: '🇮🇳' },
  { code: '971', name: 'UAE', flag: '🇦🇪' },
  { code: '966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '974', name: 'Qatar', flag: '🇶🇦' },
  { code: '965', name: 'Kuwait', flag: '🇰🇼' },
  { code: '968', name: 'Oman', flag: '🇴🇲' },
  { code: '973', name: 'Bahrain', flag: '🇧🇭' },
  { code: '44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '1', name: 'USA / Canada', flag: '🇺🇸' },
  { code: '61', name: 'Australia', flag: '🇦🇺' },
  { code: '65', name: 'Singapore', flag: '🇸🇬' },
  { code: '60', name: 'Malaysia', flag: '🇲🇾' },
  { code: '977', name: 'Nepal', flag: '🇳🇵' },
  { code: '880', name: 'Bangladesh', flag: '🇧🇩' },
];

/** Phone number (with country code) → 6-digit code on WhatsApp → logged in. */
export function OtpLogin({ onDone, compact }: { onDone?: (u: LiveUser) => void; compact?: boolean }) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [country, setCountry] = useState('91');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const toast = useUI((s) => s.toast);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const local = () => phone.replace(/\D/g, '').replace(/^0+/, '');
  const fullNumber = () => `+${country}${local()}`;

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    setError('');
    if (country === '91' ? !/^[6-9]\d{9}$/.test(local()) : !/^\d{6,14}$/.test(local())) return setError(country === '91' ? 'Enter your 10-digit WhatsApp number.' : 'Enter your WhatsApp number.');
    setBusy(true);
    try {
      const r = await auth.requestOtp(fullNumber());
      setDevCode(r.devCode);
      setStep('code');
      setWait(r.resendIn);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code.');
    setBusy(true);
    try {
      const s = await auth.verifyOtp(fullNumber(), code, name.trim() || undefined);
      toast(s.isNew ? 'Welcome to Aribas!' : `Welcome back${s.user.name ? `, ${s.user.name.split(' ')[0]}` : ''}`);
      onDone?.(s.user);
    } catch (err) {
      setError(err instanceof BackendError ? err.message : 'Something went wrong. Please try again.');
      if (err instanceof BackendError && /request a new/.test(err.message)) setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? '' : 'rounded-xl bg-white p-8'}>
      {step === 'phone' ? (
        <form onSubmit={send} noValidate className="space-y-4">
          <p className="text-sm text-ink-600">We’ll send a 6-digit login code to your WhatsApp.</p>
          <Field label="Mobile number (WhatsApp)">
            <div className="flex">
              <select aria-label="Country code" className="input w-[7.5rem] shrink-0 rounded-r-none border-r-0 bg-paper pr-2" value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} +{c.code}</option>)}
              </select>
              <input className="input min-w-0 rounded-l-none" inputMode="tel" autoComplete="tel-national" placeholder={country === '91' ? '98765 43210' : 'Mobile number'} value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus={!compact} />
            </div>
          </Field>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : <><Icon name="lock" size={16} /> Send code on WhatsApp</>}</button>
        </form>
      ) : (
        <form onSubmit={verify} noValidate className="space-y-4">
          <p className="text-sm text-ink-600">
            Enter the code sent to <b>+{country} {local()}</b> on WhatsApp{' '}
            <button type="button" className="link text-brand" onClick={() => { setStep('phone'); setCode(''); setError(''); }}>Change</button>
          </p>
          <Field label="6-digit code">
            <input ref={codeRef} className="input text-center text-xl tracking-[.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Your name (optional)" hint="Used on your orders and receipts">
            <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {devCode && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Test mode (WhatsApp not connected): your code is <button type="button" className="font-mono font-semibold underline" onClick={() => setCode(devCode)}>{devCode}</button>
            </p>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Log in'}</button>
          <p className="text-center text-xs text-ink-400">
            Didn’t get it? {wait > 0 ? `Resend in ${wait}s` : <button type="button" className="link text-brand" onClick={() => send()}>Resend code</button>}
          </p>
        </form>
      )}
    </div>
  );
}
