import { useState } from 'react';
import { analyticsEnabled, getConsent, setConsent } from '@/services/analytics';

/** Asks once whether we may use Google Analytics. Hidden when analytics isn't configured. */
export function ConsentBanner() {
  const [open, setOpen] = useState(() => analyticsEnabled() && getConsent() === null);
  if (!open) return null;
  const choose = (v: 'granted' | 'denied') => { setConsent(v); setOpen(false); };
  return (
    <div role="dialog" aria-label="Analytics cookies" className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl rounded-2xl bg-ink p-5 text-sm text-white shadow-2xl sm:inset-x-6 sm:bottom-6">
      <p className="leading-relaxed text-white/85">We use Google Analytics cookies to understand how people find and use our site, so we can improve it. They’re not used for ads, and nothing is shared with anyone else.</p>
      <div className="mt-4 flex gap-2">
        <button onClick={() => choose('granted')} className="btn rounded-full bg-white px-5 py-2.5 text-brand hover:bg-blush-100">Accept</button>
        <button onClick={() => choose('denied')} className="btn rounded-full border border-white/40 px-5 py-2.5 text-white hover:bg-white/10">No thanks</button>
      </div>
    </div>
  );
}
