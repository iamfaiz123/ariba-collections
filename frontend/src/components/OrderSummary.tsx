import { useState, type ReactNode } from 'react';
import { validateCoupon, computeTotals } from '@/services/api';
import { cartSubtotal, useCart } from '@/store';
import type { PaymentMethod, ShippingMethod } from '@/types';
import { inr } from '@/utils/format';
import { COUPONS } from '@/data/content';
import { Icon } from './Icon';
import { Spinner } from './ui';

export function useTotals(shipping: ShippingMethod = 'standard', payment?: PaymentMethod) {
  const items = useCart((s) => s.items);
  const coupon = useCart((s) => s.coupon);
  return computeTotals(cartSubtotal(items), coupon, shipping, payment);
}

export function CouponBox() {
  const { coupon, setCoupon, items } = useCart();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const subtotal = cartSubtotal(items);

  if (coupon)
    return (
      <div className="flex items-center justify-between rounded-xl border border-dashed border-emerald-600 bg-emerald-50 px-4 py-3 text-sm">
        <span className="flex items-center gap-2 text-emerald-800"><Icon name="tag" size={16} /> <b>{coupon.code}</b> applied</span>
        <button onClick={() => setCoupon(null)} className="text-xs text-ink-600 underline">Remove</button>
      </div>
    );

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!code.trim()) return;
          setBusy(true);
          setError('');
          try {
            setCoupon(await validateCoupon(code, subtotal));
            setCode('');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid code');
          } finally {
            setBusy(false);
          }
        }}
      >
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Coupon code" className="input flex-1 py-2.5" aria-label="Coupon code" />
        <button className="btn-outline px-5 py-2.5" disabled={busy}>{busy ? <Spinner /> : 'Apply'}</button>
      </form>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {COUPONS.map((c) => (
          <button key={c.code} type="button" onClick={() => setCode(c.code)} className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] text-brand" title={c.description}>{c.code}</button>
        ))}
      </div>
    </div>
  );
}

export function TotalsTable({ shipping = 'standard', payment, children }: { shipping?: ShippingMethod; payment?: PaymentMethod; children?: ReactNode }) {
  const t = useTotals(shipping, payment);
  return (
    <dl className="space-y-2.5 text-sm">
      <Row label="Subtotal" value={inr(t.subtotal)} />
      {t.discount > 0 && <Row label="Discount" value={`– ${inr(t.discount)}`} className="text-emerald-700" />}
      <Row label="Shipping" value={t.shippingFee === 0 ? 'Free' : inr(t.shippingFee)} />
      {t.codFee > 0 && <Row label="COD handling" value={inr(t.codFee)} />}
      <div className="border-t border-ink/10 pt-3">
        <Row label={<span className="font-display text-lg uppercase">Total</span>} value={<span className="font-display text-2xl font-semibold text-brand">{inr(t.total)}</span>} />
      </div>
      {children}
    </dl>
  );
}

function Row({ label, value, className = '' }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <dt className="text-ink-600">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
