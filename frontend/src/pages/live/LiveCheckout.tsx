import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { OtpLogin } from '@/components/live/OtpLogin';
import { MockPayDialog, useMockPay } from '@/components/live/MockPayDialog';
import { ProductArt } from '@/components/ProductArt';
import { Breadcrumbs, Field, Heading, Skeleton, Spinner } from '@/components/ui';
import { INDIAN_STATES, SHIPPING } from '@/data/content';
import { addresses as addressApi, BackendError, cart as cartApi, orders, type SavedAddress, type ServerCart } from '@/services/backend';
import { startPayment } from '@/services/pay';
import { useAuth, useCart, useUI } from '@/store';
import { cx, deliveryEstimate, inr } from '@/utils/format';

const EMPTY = { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

/** Checkout against the backend: login → address → server-priced totals → Razorpay. */
export default function LiveCheckout() {
  const user = useAuth((s) => s.user);
  const { items, coupon, setCoupon, clear } = useCart();
  const toast = useUI((s) => s.toast);
  const navigate = useNavigate();
  const [saved, setSaved] = useState<SavedAddress[] | null>(null);
  const [addressId, setAddressId] = useState<string | 'new'>('new');
  const [form, setForm] = useState({ ...EMPTY });
  const [formErr, setFormErr] = useState('');
  const [shipping, setShipping] = useState<'standard' | 'express'>('standard');
  const [priced, setPriced] = useState<ServerCart | null>(null);
  const [pricingError, setPricingError] = useState('');
  const [busy, setBusy] = useState(false);
  const mock = useMockPay();
  const placed = useRef(false);
  // One key per bag + options: a double click or a retry never creates a second order.
  const bagSignature = useMemo(() => JSON.stringify([items.map((i) => [i.productId, i.size, i.color.name, i.qty]), coupon?.code, shipping, addressId]), [items, coupon, shipping, addressId]);
  const idemKey = useMemo(() => crypto.randomUUID(), [bagSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    addressApi.list().then((list) => {
      setSaved(list);
      if (list.length) setAddressId((list.find((a) => a.isDefault) ?? list[0]).id);
      else setForm((f) => ({ ...f, fullName: user.name, phone: user.phone?.replace(/^\+91/, '') ?? '' }));
    }).catch(() => setSaved([]));
  }, [user]);

  // Server is the source of truth for prices, stock and coupons.
  useEffect(() => {
    if (!user || !items.length) return;
    let alive = true;
    setPricingError('');
    cartApi
      .replace(items.map((i) => ({ productId: i.productId, size: i.size, color: i.color.name, qty: i.qty })), coupon?.code ?? null, shipping)
      .then((c) => {
        if (!alive) return;
        setPriced(c);
        if (c.couponError && coupon) {
          toast(c.couponError, 'error');
          setCoupon(null);
        }
      })
      .catch((e) => alive && setPricingError(e instanceof Error ? e.message : 'Could not price your bag.'));
    return () => {
      alive = false;
    };
  }, [user, items, coupon, shipping]); // eslint-disable-line react-hooks/exhaustive-deps

  if (items.length === 0 && !placed.current) return <Navigate to="/cart" replace />;

  if (!user)
    return (
      <div className="container-x max-w-md py-14">
        <Heading as="h1" pre="Log in to" title="Check out" size="md" />
        <p className="mb-6 mt-3 text-sm text-ink-600">Your orders, receipts and returns stay in your account.</p>
        <OtpLogin />
      </div>
    );

  const problems = priced?.items.filter((i) => i.problem) ?? [];

  const saveAddress = async (): Promise<string | null> => {
    const digits = form.phone.replace(/\D/g, '').slice(-10);
    if (form.fullName.trim().length < 2) return setFormErr('Enter the full name for delivery.'), null;
    if (!/^[6-9]\d{9}$/.test(digits)) return setFormErr('Enter a valid 10-digit mobile number.'), null;
    if (form.line1.trim().length < 5) return setFormErr('Enter house no. and street.'), null;
    if (!form.city.trim() || !form.state) return setFormErr('Enter city and state.'), null;
    if (!/^[1-9]\d{5}$/.test(form.pincode)) return setFormErr('Enter a 6-digit PIN code.'), null;
    setFormErr('');
    const a = await addressApi.create({ ...form, phone: digits });
    setSaved((s) => [...(s ?? []), a]);
    setAddressId(a.id);
    return a.id;
  };

  const placeOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (problems.length) return toast('Please fix the items marked in your bag first.', 'error');
    setBusy(true);
    try {
      const id = addressId === 'new' ? await saveAddress() : addressId;
      if (!id) return;
      const { order, payment, paymentError } = await orders.checkout(id, shipping, idemKey);
      placed.current = true;
      if (!payment) {
        toast(paymentError ?? 'Payments are temporarily unavailable. Your order is saved — pay from the order page.', 'error');
        navigate(`/order/${order.id}`);
        return;
      }
      const outcome = await startPayment(payment, mock.ask);
      if (outcome === 'paid' || outcome === 'processing') clear();
      if (outcome === 'failed') toast('The payment did not go through. You can try again.', 'error');
      navigate(`/order/${order.id}${outcome === 'paid' || outcome === 'processing' ? '?paid=1' : ''}`);
    } catch (err) {
      placed.current = false;
      const msg = err instanceof BackendError && err.code === 'cart_changed' ? 'Some items in your bag changed. Please review it.' : err instanceof Error ? err.message : 'Could not place the order.';
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: 'Bag', to: '/cart' }, { label: 'Checkout' }]} />
      <Heading as="h1" pre="Secure" title="Checkout" className="mt-4" />

      <form onSubmit={placeOrder} noValidate className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]">
        <div className="space-y-10">
          <section>
            <h2 className="mb-5 flex items-center gap-3 text-2xl text-brand"><Step n={1} /> Delivery address</h2>
            {saved === null ? <Skeleton className="h-28" /> : (
              <div className="grid gap-3">
                {saved.map((a) => (
                  <Option key={a.id} checked={addressId === a.id} onSelect={() => setAddressId(a.id)} title={a.fullName} sub={`${a.line1}${a.line2 ? `, ${a.line2}` : ''}, ${a.city}, ${a.state} – ${a.pincode} · ${a.phone}`} />
                ))}
                {saved.length > 0 && <Option checked={addressId === 'new'} onSelect={() => setAddressId('new')} title="Deliver to a new address" sub="Saved to your account for next time" />}
                {addressId === 'new' && (
                  <div className="grid gap-4 rounded-xl bg-white p-4 sm:grid-cols-2">
                    <Field label="Full name"><input className="input" autoComplete="name" value={form.fullName} onChange={set('fullName')} /></Field>
                    <Field label="Mobile number"><input className="input" inputMode="tel" autoComplete="tel-national" placeholder="10-digit mobile" value={form.phone} onChange={set('phone')} /></Field>
                    <div className="sm:col-span-2"><Field label="Address line 1"><input className="input" autoComplete="address-line1" placeholder="House no., building, street" value={form.line1} onChange={set('line1')} /></Field></div>
                    <div className="sm:col-span-2"><Field label="Address line 2 (optional)"><input className="input" autoComplete="address-line2" placeholder="Area, landmark" value={form.line2} onChange={set('line2')} /></Field></div>
                    <Field label="City"><input className="input" autoComplete="address-level2" value={form.city} onChange={set('city')} /></Field>
                    <Field label="PIN code"><input className="input" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={form.pincode} onChange={set('pincode')} /></Field>
                    <div className="sm:col-span-2">
                      <Field label="State">
                        <select className="input" value={form.state} onChange={set('state')}>
                          <option value="">Select state</option>
                          {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </Field>
                    </div>
                    {formErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{formErr}</p>}
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-5 flex items-center gap-3 text-2xl text-brand"><Step n={2} /> Delivery speed</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Option checked={shipping === 'standard'} onSelect={() => setShipping('standard')} title="Standard" sub={deliveryEstimate([4, 7])} right={`Free over ${inr(SHIPPING.freeAbove)}`} />
              <Option checked={shipping === 'express'} onSelect={() => setShipping('express')} title="Express" sub={deliveryEstimate([1, 3])} right={inr(SHIPPING.expressFee)} />
            </div>
          </section>

          <section>
            <h2 className="mb-5 flex items-center gap-3 text-2xl text-brand"><Step n={3} /> Payment</h2>
            <div className="rounded-xl bg-white p-5 text-sm text-ink-600">
              <p className="flex items-center gap-2 font-medium text-ink"><Icon name="lock" size={16} /> Pay securely with Razorpay</p>
              <p className="mt-1">UPI, cards, net banking and wallets. Your receipt is sent on WhatsApp as soon as the payment is confirmed.</p>
            </div>
          </section>
        </div>

        <aside className="h-fit space-y-5 rounded-xl bg-white p-6 lg:sticky lg:top-24">
          <h2 className="text-2xl text-brand">Your order</h2>
          <ul className="max-h-72 space-y-4 overflow-y-auto pr-1">
            {items.map((i) => {
              const server = priced?.items.find((s) => s.productId === i.productId && s.size === i.size && (s.color ?? '') === i.color.name);
              return (
                <li key={i.key} className="flex gap-3">
                  <div className="tile relative h-20 w-16 shrink-0 overflow-hidden rounded-lg">
                    <ProductArt art={i.art} color={i.color.hex} accent={i.color.accent} src={i.image} />
                    <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] text-white">{i.qty}</span>
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{i.name}</p>
                    <p className="text-xs text-ink-400">{i.color.name} · {i.size}</p>
                    {server?.problem && <p className="text-xs text-red-600">{server.problem}</p>}
                  </div>
                  <p className="text-sm">{inr((server?.price ?? i.price) * i.qty)}</p>
                </li>
              );
            })}
          </ul>
          {pricingError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{pricingError}</p>}
          {!priced ? <Skeleton className="h-32" /> : (
            <dl className="space-y-2 border-t border-ink/10 pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd>{inr(priced.subtotal)}</dd></div>
              {priced.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount ({priced.coupon})</dt><dd>– {inr(priced.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-600">Shipping</dt><dd>{priced.shippingFee ? inr(priced.shippingFee) : 'Free'}</dd></div>
              <div className="flex justify-between pt-2"><dt className="font-display text-lg uppercase">Total</dt><dd className="font-display text-2xl font-semibold text-brand">{inr(priced.total)}</dd></div>
            </dl>
          )}
          <button className="btn-primary w-full" disabled={busy || !priced || problems.length > 0}>
            {busy ? <><Spinner /> Opening payment…</> : <><Icon name="lock" size={16} /> Pay {priced ? inr(priced.total) : ''}</>}
          </button>
          {problems.length > 0 && <p className="text-center text-xs text-red-600">Update your <Link to="/cart" className="underline">bag</Link> to continue.</p>}
          <p className="text-center text-xs text-ink-400">By paying you agree to our terms & 7-day return policy.</p>
        </aside>
      </form>
      <MockPayDialog state={mock} />
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="grid h-8 w-8 place-items-center rounded-full bg-brand font-sans text-sm text-white">{n}</span>;
}

export function Option({ checked, onSelect, title, sub, right }: { checked: boolean; onSelect: () => void; title: string; sub: string; right?: string }) {
  return (
    <label className={cx('flex cursor-pointer items-center gap-4 rounded-xl border bg-white p-4 transition', checked ? 'border-brand ring-1 ring-brand' : 'border-ink-200 hover:border-ink/40')}>
      <input type="radio" checked={checked} onChange={onSelect} className="peer sr-only" />
      <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full border-2', checked ? 'border-brand' : 'border-ink-200')}>{checked && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}</span>
      <span className="flex-1"><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-ink-400">{sub}</span></span>
      {right && <span className="text-sm text-ink-600">{right}</span>}
    </label>
  );
}
