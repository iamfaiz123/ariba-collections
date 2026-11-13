import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { MockPayDialog, useMockPay } from '@/components/live/MockPayDialog';
import { OtpLogin } from '@/components/live/OtpLogin';
import { OrderBadge } from '@/components/live/OrderBadge';
import { EmptyState, Field, Heading, Modal, Skeleton, Spinner } from '@/components/ui';
import { orders, type LiveOrder } from '@/services/backend';
import { startPayment } from '@/services/pay';
import { useAuth, useUI } from '@/store';
import { deliveryEstimate, formatDate, inr } from '@/utils/format';

export default function LiveOrderPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const user = useAuth((s) => s.user);
  const toast = useUI((s) => s.toast);
  const [order, setOrder] = useState<LiveOrder | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const mock = useMockPay();
  const justPaid = params.get('paid') === '1';
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGaveUp(true), 90_000);
    return () => clearTimeout(t);
  }, []);

  const load = useCallback(() => orders.get(id).then(setOrder).catch(() => setMissing(true)), [id]);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // After paying, the server confirms within seconds (webhook / verification / poller): keep checking.
  const waiting = !!order && order.status === 'pending_payment' && justPaid && !gaveUp;
  const receiptPending = !!order?.receipt && !order.receipt.ready;
  useEffect(() => {
    if (!waiting && !receiptPending) return;
    const t = setInterval(load, 2500);
    const stop = setTimeout(() => clearInterval(t), 120_000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [waiting, receiptPending, load]);

  if (!user) return <div className="container-x max-w-md py-14"><Heading as="h1" pre="Log in to see" title="Your order" size="md" /><div className="mt-6"><OtpLogin /></div></div>;
  if (missing) return <div className="container-x"><EmptyState icon="package" title="Order not found" body="We couldn’t find that order in your account." action={<Link to="/account" className="btn-primary">My orders</Link>} /></div>;
  if (!order) return <div className="container-x max-w-2xl py-16"><Skeleton className="h-64" /></div>;

  const pay = async () => {
    setBusy(true);
    try {
      const { payment } = await orders.pay(order.id);
      const outcome = await startPayment(payment, mock.ask);
      if (outcome === 'failed') toast('The payment did not go through. You can try again.', 'error');
      if (outcome === 'paid' || outcome === 'processing') window.history.replaceState(null, '', `/order/${order.id}?paid=1`);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start the payment.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirm(order.paidAt ? `Cancel order ${order.number}? You’ll get a full refund to your original payment method.` : `Cancel order ${order.number}?`)) return;
    try {
      setOrder(await orders.cancel(order.id));
      toast(order.paidAt ? 'Order cancelled — refund started' : 'Order cancelled');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not cancel', 'error');
    }
  };

  const confirmed = !['pending_payment', 'cancelled'].includes(order.status);
  const first = (order.address.fullName || user.name || '').split(' ')[0];

  return (
    <div className="container-x max-w-3xl py-14">
      <div className="text-center">
        {waiting ? (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand"><Spinner className="h-7 w-7" /></div>
            <Heading as="h1" pre="Confirming" title="Your payment" className="mt-6 justify-center" />
            <p className="mt-4 text-ink-600">This usually takes a few seconds. You can close this page — we’ll send your receipt on WhatsApp.</p>
          </>
        ) : confirmed ? (
          <>
            <div className="mx-auto grid h-16 w-16 animate-rise place-items-center rounded-full bg-brand text-white"><Icon name="check" size={30} /></div>
            <Heading as="h1" pre="Thank you," title={first || 'for your order'} className="mt-6 justify-center" />
            <p className="mt-4 text-ink-600">Order <b className="text-ink">{order.number}</b> is confirmed. Your receipt has been sent on WhatsApp.</p>
            {order.status !== 'delivered' && <p className="mt-1 text-sm text-ink-400">Estimated delivery: {deliveryEstimate(order.shippingMethod === 'express' ? [1, 3] : [4, 7])}</p>}
          </>
        ) : (
          <>
            <Heading as="h1" pre="Order" title={order.number} className="justify-center" />
            {order.status === 'pending_payment' && <p className="mt-4 text-ink-600">Awaiting payment. We’re holding your items until {formatTime(order.expiresAt)}.</p>}
            {order.status === 'cancelled' && <p className="mt-4 text-ink-600">This order was cancelled{order.paymentStatus !== 'unpaid' ? ' and refunded to your original payment method' : ''}.</p>}
          </>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {order.canPay && !waiting && <button className="btn-primary" onClick={pay} disabled={busy}>{busy ? <Spinner /> : <><Icon name="lock" size={16} /> Pay {inr(order.total)}</>}</button>}
          {order.receipt && (
            <button className="btn-outline" disabled={!order.receipt.ready} onClick={() => orders.receipt(order).catch((e) => toast(e.message, 'error'))}>
              {order.receipt.ready ? <><Icon name="package" size={16} /> Download receipt</> : <><Spinner /> Preparing receipt…</>}
            </button>
          )}
        </div>
      </div>

      <div className="mt-10 rounded-xl bg-white p-6 sm:p-8">
        <div className="flex flex-wrap justify-between gap-4 border-b border-ink/10 pb-5 text-sm">
          <div><p className="text-ink-400">Order date</p><p>{formatDate(order.createdAt)}</p></div>
          <div><p className="text-ink-400">Payment</p><p>{METHOD[order.paymentMethod ?? ''] ?? order.paymentMethod ?? (order.paidAt ? 'Online' : '—')}{order.paymentStatus.includes('refund') ? ` · ${order.paymentStatus.replace('_', ' ')}` : ''}</p></div>
          <div><p className="text-ink-400">Status</p><OrderBadge status={order.status} label={order.statusLabel} /></div>
        </div>
        {order.tracking && (order.tracking.awb || order.tracking.url) && (
          <div className="mt-4 rounded-lg bg-paper p-4 text-sm">
            <p className="font-medium">Tracking</p>
            <p className="text-ink-600">{[order.tracking.courier, order.tracking.awb].filter(Boolean).join(' · ')} {order.tracking.url && <a href={order.tracking.url} target="_blank" rel="noreferrer" className="link text-brand">Track shipment</a>}</p>
          </div>
        )}
        <ul className="divide-y divide-ink/5 py-3">
          {order.items.map((l) => (
            <li key={l.id} className="flex justify-between gap-4 py-3 text-sm">
              <span><Link to={`/product/${l.slug}`} className="font-medium hover:text-brand">{l.name}</Link><span className="block text-xs text-ink-400">{[l.color, l.size, `Qty ${l.qty}`].filter(Boolean).join(' · ')}</span></span>
              <span>{inr(l.price * l.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 border-t border-ink/10 pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd>{inr(order.subtotal)}</dd></div>
          {order.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount ({order.coupon})</dt><dd>– {inr(order.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-ink-600">Shipping</dt><dd>{order.shippingFee ? inr(order.shippingFee) : 'Free'}</dd></div>
          <div className="flex justify-between pt-2"><dt className="font-display text-lg uppercase">Total</dt><dd className="font-display text-2xl font-semibold text-brand">{inr(order.total)}</dd></div>
          {order.refunded > 0 && <div className="flex justify-between text-emerald-700"><dt>Refunded</dt><dd>{inr(order.refunded)}</dd></div>}
        </dl>
        <div className="mt-6 rounded-lg bg-paper p-4 text-sm">
          <p className="mb-1 font-medium">Shipping to</p>
          <p className="text-ink-600">{order.address.fullName}, {order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}, {order.address.city}, {order.address.state} – {order.address.pincode} · {order.address.phone}</p>
        </div>

        {!!order.returns?.length && (
          <div className="mt-6">
            <p className="mb-2 font-medium">Returns</p>
            <ul className="space-y-2 text-sm">
              {order.returns.map((r) => (
                <li key={r.id} className="rounded-lg border border-ink/10 p-3">
                  <p className="flex justify-between"><span>{r.items.map((i) => `${i.name} (${i.size}) × ${i.qty}`).join(', ')}</span><b>{r.statusLabel}</b></p>
                  <p className="text-xs text-ink-400">Refund {inr(r.refund)} · {formatDate(r.createdAt)}{r.adminNote ? ` · ${r.adminNote}` : ''}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          {order.canReturn && <button className="link text-brand" onClick={() => setReturnOpen(true)}>Return items</button>}
          {order.canReturn && order.returnWindowEndsAt && <span className="text-xs text-ink-400">Returns open until {formatDate(order.returnWindowEndsAt)}</span>}
          {order.canCancel && <button className="text-red-600 underline underline-offset-4" onClick={cancel}>Cancel order</button>}
        </div>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/shop" className="btn-primary">Continue shopping</Link>
        <Link to="/account" className="btn-outline">My orders</Link>
      </div>
      <ReturnDialog open={returnOpen} order={order} onClose={() => setReturnOpen(false)} onDone={() => { setReturnOpen(false); load(); }} />
      <MockPayDialog state={mock} />
    </div>
  );
}

const METHOD: Record<string, string> = { upi: 'UPI', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet', emi: 'EMI', paylater: 'Pay later' };

const formatTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : 'soon');

function ReturnDialog({ open, order, onClose, onDone }: { open: boolean; order: LiveOrder; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useUI((s) => s.toast);
  const submit = async () => {
    const items = Object.entries(qty).filter(([, n]) => n > 0).map(([itemId, n]) => ({ itemId, qty: n }));
    if (!items.length) return setError('Choose at least one item.');
    if (reason.trim().length < 3) return setError('Tell us why you’re returning it.');
    setBusy(true);
    try {
      await orders.requestReturn(order.id, items, reason.trim());
      toast('Return requested — we’ll be in touch on WhatsApp');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not request the return.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Return items">
      <div className="space-y-4 text-sm">
        <p className="text-ink-600">Unworn items with tags, within 7 days of delivery. The refund goes back to your original payment method once we receive the item.</p>
        {order.items.map((i) => (
          <label key={i.id} className="flex items-center justify-between gap-3">
            <span>{i.name} <span className="text-ink-400">({i.size})</span></span>
            <select className="input w-20" value={qty[i.id] ?? 0} onChange={(e) => setQty({ ...qty, [i.id]: Number(e.target.value) })}>
              {Array.from({ length: i.qty + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        ))}
        <Field label="Reason"><textarea className="input min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Too big, colour different from photos" /></Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
        <button className="btn-primary w-full" onClick={submit} disabled={busy}>{busy ? <Spinner /> : 'Request return'}</button>
      </div>
    </Modal>
  );
}
