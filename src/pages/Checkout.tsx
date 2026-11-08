import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { CouponBox, TotalsTable } from '@/components/OrderSummary';
import { ProductArt } from '@/components/ProductArt';
import { Breadcrumbs, Field, Heading, Spinner } from '@/components/ui';
import { INDIAN_STATES, SHIPPING } from '@/data/content';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { placeOrder } from '@/services/api';
import { storage } from '@/services/storage';
import { useAuth, useCart, useUI } from '@/store';
import type { Address, PaymentMethod, ShippingMethod } from '@/types';
import { cx, deliveryEstimate, inr } from '@/utils/format';

const EMPTY: Address = { fullName: '', phone: '', email: '', line1: '', line2: '', city: '', state: '', pincode: '' };

function validate(a: Address) {
  const e: Partial<Record<keyof Address, string>> = {};
  if (a.fullName.trim().length < 2) e.fullName = 'Enter your full name';
  if (!/^[6-9]\d{9}$/.test(a.phone.replace(/\D/g, '').slice(-10))) e.phone = 'Enter a valid 10-digit mobile number';
  if (!/^\S+@\S+\.\S+$/.test(a.email)) e.email = 'Enter a valid email';
  if (a.line1.trim().length < 5) e.line1 = 'Enter house no. and street';
  if (!a.city.trim()) e.city = 'Enter your city';
  if (!a.state) e.state = 'Select your state';
  if (!/^\d{6}$/.test(a.pincode)) e.pincode = 'Enter a 6-digit PIN code';
  return e;
}

const PAYMENTS: { id: PaymentMethod; label: string; sub: string }[] = [
  { id: 'upi', label: 'UPI', sub: 'Google Pay, PhonePe, Paytm & more' },
  { id: 'card', label: 'Credit / Debit card', sub: 'Visa, Mastercard, RuPay, Amex' },
  { id: 'netbanking', label: 'Netbanking', sub: 'All major Indian banks' },
  { id: 'cod', label: 'Cash on delivery', sub: `₹${SHIPPING.codFee} handling fee` },
];

export default function Checkout() {
  useDocumentTitle('Checkout');
  const user = useAuth((s) => s.user);
  const { items, coupon, clear } = useCart();
  const toast = useUI((s) => s.toast);
  const navigate = useNavigate();
  const [addr, setAddr] = useState<Address>(() => ({ ...EMPTY, ...storage.get<Partial<Address>>('ariba.address', {}), ...(user ? { fullName: user.name, email: user.email } : {}) }));
  const [errors, setErrors] = useState<Partial<Record<keyof Address, string>>>({});
  const [shipping, setShipping] = useState<ShippingMethod>('standard');
  const [payment, setPayment] = useState<PaymentMethod>('upi');
  const [upiId, setUpiId] = useState('');
  const [busy, setBusy] = useState(false);
  // A ref (not state) so the guard below sees it synchronously when the cart store empties.
  const placed = useRef(false);

  if (items.length === 0 && !placed.current) return <Navigate to="/cart" replace />;

  const set = (k: keyof Address) => (e: { target: { value: string } }) => {
    setAddr({ ...addr, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(addr);
    if (payment === 'upi' && !/^[\w.-]+@[\w]+$/.test(upiId)) {
      toast('Enter a valid UPI ID (e.g. name@okaxis)', 'error');
      return;
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.querySelector('[data-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(true);
    try {
      storage.set('ariba.address', addr);
      const order = await placeOrder({
        lines: items.map((i) => ({ productId: i.productId, name: i.name, slug: i.slug, size: i.size, color: i.color.name, qty: i.qty, price: i.price })),
        address: addr, shipping, payment, coupon, userEmail: user?.email,
      });
      placed.current = true;
      navigate(`/order/${order.id}`, { replace: true });
      clear();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not place order', 'error');
    } finally {
      setBusy(false);
    }
  };

  const input = (k: keyof Address, props: Record<string, unknown> = {}) => (
    <input value={addr[k] ?? ''} onChange={set(k)} data-invalid={!!errors[k]} className={cx('input', errors[k] && 'input-error')} {...props} />
  );

  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: 'Bag', to: '/cart' }, { label: 'Checkout' }]} />
      <Heading as="h1" pre="Secure" title="Checkout" className="mt-4" />
      {!user && <p className="mt-3 text-sm text-ink-600">Have an account? <Link to="/account?next=/checkout" className="link text-brand">Sign in</Link> for faster checkout and order tracking.</p>}

      <form onSubmit={submit} noValidate className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]">
        <div className="space-y-10">
          <section>
            <h2 className="mb-5 flex items-center gap-3 text-2xl text-brand"><Step n={1} /> Delivery address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errors.fullName}>{input('fullName', { autoComplete: 'name' })}</Field>
              <Field label="Mobile number" error={errors.phone}>{input('phone', { inputMode: 'tel', autoComplete: 'tel', placeholder: '10-digit mobile' })}</Field>
              <div className="sm:col-span-2"><Field label="Email" error={errors.email} hint="Order updates are sent here">{input('email', { type: 'email', autoComplete: 'email' })}</Field></div>
              <div className="sm:col-span-2"><Field label="Address line 1" error={errors.line1}>{input('line1', { autoComplete: 'address-line1', placeholder: 'House no., building, street' })}</Field></div>
              <div className="sm:col-span-2"><Field label="Address line 2 (optional)">{input('line2', { autoComplete: 'address-line2', placeholder: 'Area, landmark' })}</Field></div>
              <Field label="City" error={errors.city}>{input('city', { autoComplete: 'address-level2' })}</Field>
              <Field label="PIN code" error={errors.pincode}>{input('pincode', { inputMode: 'numeric', maxLength: 6, autoComplete: 'postal-code' })}</Field>
              <div className="sm:col-span-2">
                <Field label="State" error={errors.state}>
                  <select value={addr.state} onChange={set('state')} data-invalid={!!errors.state} className={cx('input', errors.state && 'input-error')}>
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-5 flex items-center gap-3 text-2xl text-brand"><Step n={2} /> Delivery speed</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Option checked={shipping === 'standard'} onSelect={() => setShipping('standard')} title="Standard" sub={`${deliveryEstimate([4, 7])}`} right={'Free over ₹1,999'} />
              <Option checked={shipping === 'express'} onSelect={() => setShipping('express')} title="Express" sub={`${deliveryEstimate([1, 3])}`} right={inr(SHIPPING.expressFee)} />
            </div>
          </section>

          <section>
            <h2 className="mb-5 flex items-center gap-3 text-2xl text-brand"><Step n={3} /> Payment</h2>
            <div className="grid gap-3">
              {PAYMENTS.map((p) => (
                <div key={p.id}>
                  <Option checked={payment === p.id} onSelect={() => setPayment(p.id)} title={p.label} sub={p.sub} />
                  {payment === p.id && p.id === 'upi' && (
                    <div className="mt-2 rounded-xl bg-white p-4"><Field label="UPI ID"><input value={upiId} onChange={(e) => setUpiId(e.target.value.trim())} placeholder="yourname@okaxis" className="input" /></Field></div>
                  )}
                  {payment === p.id && p.id === 'card' && (
                    <div className="mt-2 grid gap-3 rounded-xl bg-white p-4 sm:grid-cols-3">
                      <div className="sm:col-span-3"><input className="input" placeholder="Card number" inputMode="numeric" autoComplete="cc-number" /></div>
                      <input className="input" placeholder="MM / YY" autoComplete="cc-exp" />
                      <input className="input" placeholder="CVV" inputMode="numeric" autoComplete="cc-csc" />
                      <input className="input" placeholder="Name on card" autoComplete="cc-name" />
                      <p className="text-xs text-ink-400 sm:col-span-3">Demo only — card details are not stored or sent anywhere. Payment gateway is wired in the backend phase.</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="h-fit space-y-5 rounded-xl bg-white p-6 lg:sticky lg:top-24">
          <h2 className="text-2xl text-brand">Your order</h2>
          <ul className="max-h-72 space-y-4 overflow-y-auto pr-1">
            {items.map((i) => (
              <li key={i.key} className="flex gap-3">
                <div className="tile relative h-20 w-16 shrink-0 overflow-hidden rounded-lg">
                  <ProductArt art={i.art} color={i.color.hex} accent={i.color.accent} src={i.image} />
                  <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] text-white">{i.qty}</span>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{i.name}</p>
                  <p className="text-xs text-ink-400">{i.color.name} · {i.size}</p>
                </div>
                <p className="text-sm">{inr(i.price * i.qty)}</p>
              </li>
            ))}
          </ul>
          <CouponBox />
          <TotalsTable shipping={shipping} payment={payment} />
          <button className="btn-primary w-full" disabled={busy}>{busy ? <><Spinner /> Placing order…</> : <><Icon name="lock" size={16} /> Place order</>}</button>
          <p className="text-center text-xs text-ink-400">By placing your order you agree to our terms & return policy.</p>
          {coupon && <p className="sr-only">Coupon {coupon.code} applied</p>}
        </aside>
      </form>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="grid h-8 w-8 place-items-center rounded-full bg-brand font-sans text-sm text-white">{n}</span>;
}

function Option({ checked, onSelect, title, sub, right }: { checked: boolean; onSelect: () => void; title: string; sub: string; right?: string }) {
  return (
    <label className={cx('flex cursor-pointer items-center gap-4 rounded-xl border bg-white p-4 transition', checked ? 'border-brand ring-1 ring-brand' : 'border-ink-200 hover:border-ink/40')}>
      <input type="radio" checked={checked} onChange={onSelect} className="peer sr-only" />
      <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-brand', checked ? 'border-brand' : 'border-ink-200')}>
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-ink-400">{sub}</span>
      </span>
      {right && <span className="text-sm text-ink-600">{right}</span>}
    </label>
  );
}
