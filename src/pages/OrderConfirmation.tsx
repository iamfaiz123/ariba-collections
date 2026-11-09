import { Link, useParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { EmptyState, Heading, Skeleton } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { getOrder } from '@/services/api';
import { deliveryEstimate, formatDate, inr } from '@/utils/format';

export default function OrderConfirmation() {
  const { id = '' } = useParams();
  const { data: order, loading } = useAsync(() => getOrder(id), [id]);

  if (loading) return <div className="container-x max-w-2xl py-16"><Skeleton className="h-64" /></div>;
  if (!order) return <div className="container-x"><EmptyState icon="package" title="Order not found" body="We couldn’t find that order." action={<Link to="/account" className="btn-primary">My orders</Link>} /></div>;

  return (
    <div className="container-x max-w-3xl py-14">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 animate-rise place-items-center rounded-full bg-brand text-white"><Icon name="check" size={30} /></div>
        <Heading as="h1" pre="Thank you," title={order.address.fullName.split(' ')[0]} className="mt-6 justify-center" />
        <p className="mt-4 text-ink-600">Your order <b className="text-ink">#{order.id}</b> has been placed. A confirmation has been sent to {order.address.email}.</p>
        <p className="mt-1 text-sm text-ink-400">Estimated delivery: {deliveryEstimate(order.shipping === 'express' ? [1, 3] : [4, 7])}</p>
      </div>

      <div className="mt-10 rounded-xl bg-white p-6 sm:p-8">
        <div className="flex flex-wrap justify-between gap-4 border-b border-ink/10 pb-5 text-sm">
          <div><p className="text-ink-400">Order date</p><p>{formatDate(order.createdAt)}</p></div>
          <div><p className="text-ink-400">Payment</p><p className="uppercase">{order.payment}</p></div>
          <div><p className="text-ink-400">Status</p><p className="text-emerald-700">{order.status}</p></div>
        </div>
        <ul className="divide-y divide-ink/5 py-3">
          {order.lines.map((l) => (
            <li key={`${l.productId}-${l.size}-${l.color}`} className="flex justify-between gap-4 py-3 text-sm">
              <span><Link to={`/product/${l.slug}`} className="font-medium hover:text-brand">{l.name}</Link><span className="block text-xs text-ink-400">{l.color} · {l.size} · Qty {l.qty}</span></span>
              <span>{inr(l.price * l.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 border-t border-ink/10 pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd>{inr(order.subtotal)}</dd></div>
          {order.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount ({order.coupon})</dt><dd>– {inr(order.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-ink-600">Shipping</dt><dd>{order.shippingFee ? inr(order.shippingFee) : 'Free'}</dd></div>
          {order.codFee > 0 && <div className="flex justify-between"><dt className="text-ink-600">COD handling</dt><dd>{inr(order.codFee)}</dd></div>}
          <div className="flex justify-between pt-2"><dt className="font-display text-lg uppercase">Total</dt><dd className="font-display text-2xl font-semibold text-brand">{inr(order.total)}</dd></div>
        </dl>
        <div className="mt-6 rounded-lg bg-paper p-4 text-sm">
          <p className="mb-1 font-medium">Shipping to</p>
          <p className="text-ink-600">{order.address.fullName}, {order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}, {order.address.city}, {order.address.state} – {order.address.pincode} · {order.address.phone}</p>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/shop" className="btn-primary">Continue shopping</Link>
        <Link to="/account" className="btn-outline">View my orders</Link>
      </div>
    </div>
  );
}
