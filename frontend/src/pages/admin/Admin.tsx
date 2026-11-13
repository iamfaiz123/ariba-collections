import { useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { OrderBadge } from '@/components/live/OrderBadge';
import { OtpLogin } from '@/components/live/OtpLogin';
import { Field, Heading, Modal, Skeleton, Spinner } from '@/components/ui';
import { CATEGORIES } from '@/data/categories';
import { useAsync } from '@/hooks/useAsync';
import { admin, LIVE, type AdminOrder, type AdminProduct } from '@/services/backend';
import { useAuth, useUI } from '@/store';
import { cx, formatDate, inr } from '@/utils/format';

/** Admin panel (live mode only): orders, customers & their receipts, returns, products. */
export default function Admin() {
  const user = useAuth((s) => s.user);
  if (!LIVE) return <Shell><p className="py-10 text-ink-600">The admin panel needs the backend. Set VITE_API_URL and reload.</p></Shell>;
  if (!user) return <div className="container-x max-w-md py-14"><Heading as="h1" pre="Admin" title="Log in" size="md" /><div className="mt-6"><OtpLogin /></div></div>;
  if (user.role !== 'admin') return <Shell><p className="py-10 text-ink-600">This account is not an admin. Add its number to ADMIN_PHONES on the server, then log in again.</p></Shell>;
  return (
    <Shell nav>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="returns" element={<Returns />} />
        <Route path="products" element={<Products />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Shell>
  );
}

function Shell({ children, nav }: { children: ReactNode; nav?: boolean }) {
  const tabs = [['', 'Overview'], ['orders', 'Orders'], ['customers', 'Customers'], ['returns', 'Returns'], ['products', 'Products']];
  return (
    <div className="container-x py-8">
      <Heading as="h1" pre="Aribas" title="Admin" size="md" />
      {nav && (
        <nav className="no-scrollbar mt-6 flex gap-6 overflow-x-auto border-b border-ink/10">
          {tabs.map(([to, label]) => (
            <NavLink key={to} end={to === ''} to={`/admin${to ? `/${to}` : ''}`} className={({ isActive }) => cx('-mb-px whitespace-nowrap border-b-2 pb-3 font-display uppercase tracking-wider', isActive ? 'border-brand text-brand' : 'border-transparent text-ink-400')}>{label}</NavLink>
          ))}
        </nav>
      )}
      <div className="mt-6">{children}</div>
    </div>
  );
}

const Box = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cx('rounded-xl bg-white p-5', className)}>{children}</div>;

function Overview() {
  const o = useAsync(() => admin.overview(), []);
  const attention = useAsync(() => admin.orders({ attention: true }), []);
  const refunds = useAsync(() => admin.failedRefunds(), []);
  if (!o.data) return <Skeleton className="h-40" />;
  const tiles: [string, string | number, string?][] = [
    ['Paid orders (24h)', o.data.orders_today],
    ['Revenue (30 days)', inr(o.data.revenue30d)],
    ['To pack & ship', o.data.to_ship, '/admin/orders?status=confirmed'],
    ['Open returns', o.data.open_returns, '/admin/returns'],
    ['Needs attention', o.data.needs_attention],
    ['Failed WhatsApp messages', o.data.failed_messages],
    ['Customers', o.data.customers, '/admin/customers'],
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(([label, value, to]) => {
          const body = <><p className="text-xs uppercase tracking-wider text-ink-400">{label}</p><p className="mt-1 font-display text-3xl font-semibold text-brand">{value}</p></>;
          return to ? <Link key={label} to={to} className="rounded-xl bg-white p-5 hover:ring-1 hover:ring-brand">{body}</Link> : <Box key={label}>{body}</Box>;
        })}
      </div>
      {!!attention.data?.length && (
        <Box>
          <p className="mb-3 font-medium text-red-700">Needs attention</p>
          <OrderTable orders={attention.data} showReason />
        </Box>
      )}
      {!!refunds.data?.length && (
        <Box>
          <p className="mb-3 font-medium text-red-700">Refunds that failed at Razorpay</p>
          <ul className="space-y-2 text-sm">
            {refunds.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{inr(r.amount)} · {r.key} · <span className="text-ink-400">{r.lastError}</span></span>
                <span className="flex gap-3"><Link to={`/admin/orders/${r.orderId}`} className="link">Order</Link><button className="link text-brand" onClick={() => admin.retryRefund(r.id).then(() => location.reload())}>Retry</button></span>
              </li>
            ))}
          </ul>
        </Box>
      )}
    </div>
  );
}

function OrderTable({ orders, showReason }: { orders: AdminOrder[]; showReason?: boolean }) {
  if (!orders.length) return <p className="py-6 text-sm text-ink-400">No orders.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-ink-400"><tr><th className="py-2">Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
        <tbody className="divide-y divide-ink/5">
          {orders.map((o) => (
            <tr key={o.id} className="align-top">
              <td className="py-3"><Link to={`/admin/orders/${o.id}`} className="font-medium text-brand hover:underline">{o.number}</Link>{showReason && o.needsAttention && <p className="max-w-xs text-xs text-red-700">{o.needsAttention}</p>}</td>
              <td className="py-3 text-ink-600">{formatDate(o.createdAt)}</td>
              <td className="py-3">{o.customer.name || o.address.fullName}<br /><span className="text-xs text-ink-400">{o.customer.phone}</span></td>
              <td className="py-3 text-ink-600">{o.items.reduce((n, i) => n + i.qty, 0)}</td>
              <td className="py-3">{inr(o.total)}{o.refunded > 0 && <span className="block text-xs text-emerald-700">−{inr(o.refunded)} refunded</span>}</td>
              <td className="py-3"><OrderBadge status={o.status} label={o.statusLabel} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Orders() {
  const initial = new URLSearchParams(location.search).get('status') ?? '';
  const [status, setStatus] = useState(initial);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const list = useAsync(() => admin.orders({ status: status || undefined, q: search || undefined }), [status, search]);
  return (
    <Box>
      <form className="mb-4 flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['pending_payment', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <input className="input max-w-xs" placeholder="Order no., phone or name" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-outline">Search</button>
      </form>
      {list.loading && !list.data ? <Skeleton className="h-40" /> : <OrderTable orders={list.data ?? []} />}
    </Box>
  );
}

function OrderDetail() {
  const { id = '' } = useParams();
  const toast = useUI((s) => s.toast);
  const [n, setN] = useState(0);
  const d = useAsync(() => admin.order(id), [id, n]);
  const [ship, setShip] = useState<{ open: boolean; courier: string; awb: string; url: string }>({ open: false, courier: '', awb: '', url: '' });
  const reload = () => setN((x) => x + 1);
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    }
  };
  if (!d.data) return d.error ? <p className="text-red-600">{d.error}</p> : <Skeleton className="h-64" />;
  const o = d.data;
  const next = ({ confirmed: ['packed', 'shipped', 'delivered'], packed: ['shipped', 'delivered'], shipped: ['delivered'] } as Record<string, ('packed' | 'shipped' | 'delivered')[]>)[o.status] ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Box>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-2xl text-brand">{o.number}</p>
              <p className="text-xs text-ink-400">Placed {formatDate(o.createdAt)}{o.paidAt && ` · paid ${formatDate(o.paidAt)}`}</p>
            </div>
            <OrderBadge status={o.status} label={o.statusLabel} />
          </div>
          {o.needsAttention && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <span>{o.needsAttention}</span><button className="underline" onClick={() => act(() => admin.resolve(o.id), 'Marked as handled')}>Mark handled</button>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {next.map((s) => (
              <button key={s} className="btn-primary" onClick={() => (s === 'shipped' ? setShip({ ...ship, open: true }) : act(() => admin.setStatus(o.id, s), `Marked ${s}`))}>Mark {s}</button>
            ))}
            {o.receipt?.ready && <button className="btn-outline" onClick={() => admin.receipt(o).catch((e) => toast(e.message, 'error'))}>Receipt {o.receipt.number}</button>}
            {o.receipt && <button className="btn-outline" onClick={() => act(() => admin.resendReceipt(o.id), 'Receipt queued on WhatsApp')}>Resend on WhatsApp</button>}
            {o.canCancel && (
              <button className="btn-ghost text-red-600" onClick={() => { const reason = prompt(o.paidAt ? 'Reason for cancelling? The customer gets a full refund.' : 'Reason for cancelling?'); if (reason && reason.trim().length >= 3) act(() => admin.cancel(o.id, reason.trim()), 'Order cancelled'); }}>Cancel order</button>
            )}
          </div>
        </Box>
        <Box>
          <ul className="divide-y divide-ink/5 text-sm">
            {o.items.map((i) => <li key={i.id} className="flex justify-between py-2"><span>{i.name}<span className="block text-xs text-ink-400">{[i.color, i.size, `Qty ${i.qty}`].filter(Boolean).join(' · ')}</span></span><span>{inr(i.price * i.qty)}</span></li>)}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-ink/10 pt-3 text-sm">
            <Row k="Subtotal" v={inr(o.subtotal)} />
            {o.discount > 0 && <Row k={`Discount (${o.coupon})`} v={`− ${inr(o.discount)}`} />}
            <Row k={`Shipping (${o.shippingMethod})`} v={o.shippingFee ? inr(o.shippingFee) : 'Free'} />
            <Row k="Total" v={<b>{inr(o.total)}</b>} />
            {o.refunded > 0 && <Row k="Refunded" v={inr(o.refunded)} />}
          </dl>
        </Box>
        <Box>
          <p className="mb-2 font-medium">Payments</p>
          {o.payments === null ? <p className="text-sm text-red-600">Payment service unreachable.</p> : !o.payments.length ? <p className="text-sm text-ink-400">No payment started.</p> : o.payments.map((p) => (
            <div key={p.id} className="text-sm">
              <p className="flex flex-wrap justify-between gap-2"><span>{p.providerOrderId} · <b>{p.status}</b> {p.method && `· ${p.method}`}</span>{p.status !== 'captured' && <button className="link text-brand" onClick={() => act(() => admin.checkPayment(p.id), 'Checked with Razorpay')}>Check with Razorpay</button>}</p>
              {p.lastError && <p className="text-xs text-red-600">{p.lastError}</p>}
              <ul className="mt-2 space-y-1 text-xs text-ink-600">
                {p.attempts.map((a) => <li key={a.providerPaymentId}>{formatDate(a.at)} · {a.providerPaymentId} · {inr(a.amount)} · {a.status}{a.duplicate && ' (duplicate — refunded)'}{a.error && ` · ${a.error}`}</li>)}
              </ul>
            </div>
          ))}
          {!!o.refunds?.length && (
            <>
              <p className="mb-1 mt-4 font-medium">Refunds</p>
              <ul className="space-y-1 text-xs text-ink-600">
                {o.refunds.map((r) => <li key={r.id}>{formatDate(r.createdAt)} · {inr(r.amount)} · {r.reason} · <b>{r.status}</b>{r.lastError && <span className="text-red-600"> · {r.lastError}</span>}</li>)}
              </ul>
            </>
          )}
        </Box>
      </div>
      <div className="space-y-6">
        <Box>
          <p className="mb-2 font-medium">Customer</p>
          <Link to={`/admin/customers/${o.customer.id}`} className="link text-brand">{o.customer.name || o.address.fullName}</Link>
          <p className="text-sm text-ink-600">{o.customer.phone}</p>
          <p className="mt-3 text-sm text-ink-600">{o.address.fullName}, {o.address.line1}{o.address.line2 ? `, ${o.address.line2}` : ''}, {o.address.city}, {o.address.state} – {o.address.pincode} · {o.address.phone}</p>
          {o.tracking && <p className="mt-3 text-sm">Tracking: {[o.tracking.courier, o.tracking.awb].filter(Boolean).join(' ')}</p>}
        </Box>
        <Box>
          <p className="mb-2 font-medium">WhatsApp messages</p>
          {!o.notifications.length ? <p className="text-sm text-ink-400">None yet.</p> : (
            <ul className="space-y-1 text-xs">{o.notifications.map((m, i) => <li key={i}><b>{m.kind}</b> · {m.status} · {formatDate(m.sentAt ?? m.createdAt)}{m.error && <span className="text-red-600"> · {m.error}</span>}</li>)}</ul>
          )}
        </Box>
        {!!o.returns.length && (
          <Box>
            <p className="mb-2 font-medium">Returns</p>
            {o.returns.map((r) => <p key={r.id} className="text-sm">{r.statusLabel} · {inr(r.refund)} · <Link to="/admin/returns" className="link">manage</Link></p>)}
          </Box>
        )}
      </div>
      <Modal open={ship.open} onClose={() => setShip({ ...ship, open: false })} title="Mark shipped">
        <div className="space-y-3">
          <Field label="Courier"><input className="input" value={ship.courier} onChange={(e) => setShip({ ...ship, courier: e.target.value })} placeholder="Delhivery, Blue Dart…" /></Field>
          <Field label="AWB / tracking number"><input className="input" value={ship.awb} onChange={(e) => setShip({ ...ship, awb: e.target.value })} /></Field>
          <Field label="Tracking link (optional)"><input className="input" value={ship.url} onChange={(e) => setShip({ ...ship, url: e.target.value })} placeholder="https://" /></Field>
          <button className="btn-primary w-full" onClick={() => { setShip({ ...ship, open: false }); act(() => admin.setStatus(o.id, 'shipped', { courier: ship.courier || undefined, awb: ship.awb || undefined, url: ship.url || undefined }), 'Marked shipped'); }}>Save</button>
        </div>
      </Modal>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: ReactNode }) => <div className="flex justify-between"><dt className="text-ink-600">{k}</dt><dd>{v}</dd></div>;

function Customers() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const list = useAsync(() => admin.users(search || undefined), [search]);
  return (
    <Box>
      <form className="mb-4 flex gap-3" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
        <input className="input max-w-xs" placeholder="Phone, name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-outline">Search</button>
      </form>
      {list.loading && !list.data ? <Skeleton className="h-40" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-400"><tr><th className="py-2">Customer</th><th>Phone</th><th>Orders</th><th>Spent</th><th>Joined</th></tr></thead>
            <tbody className="divide-y divide-ink/5">
              {(list.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td className="py-3"><Link to={`/admin/customers/${u.id}`} className="font-medium text-brand hover:underline">{u.name || '—'}</Link>{u.role === 'admin' && <span className="ml-2 text-xs text-ink-400">admin</span>}</td>
                  <td className="py-3">{u.phone}</td>
                  <td className="py-3">{u.orders}</td>
                  <td className="py-3">{inr(u.spent)}</td>
                  <td className="py-3 text-ink-600">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Box>
  );
}

function CustomerDetail() {
  const { id = '' } = useParams();
  const toast = useUI((s) => s.toast);
  const d = useAsync(() => admin.user(id), [id]);
  if (!d.data) return d.error ? <p className="text-red-600">{d.error}</p> : <Skeleton className="h-64" />;
  const { user, addresses, orders, returns } = d.data;
  return (
    <div className="space-y-6">
      <Box>
        <p className="font-display text-2xl text-brand">{user.name || 'Customer'}</p>
        <p className="text-sm text-ink-600">{user.phone}{user.email && ` · ${user.email}`} · joined {formatDate(user.createdAt)}{user.lastLoginAt && ` · last login ${formatDate(user.lastLoginAt)}`}</p>
        {!!addresses.length && <p className="mt-3 text-sm text-ink-600">{addresses.map((a) => `${a.line1}, ${a.city} ${a.pincode}`).join(' · ')}</p>}
      </Box>
      <Box>
        <p className="mb-3 font-medium">Order history & receipts</p>
        {!orders.length ? <p className="text-sm text-ink-400">No orders yet.</p> : (
          <ul className="divide-y divide-ink/5 text-sm">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span><Link to={`/admin/orders/${o.id}`} className="font-medium text-brand hover:underline">{o.number}</Link> <span className="text-ink-400">· {formatDate(o.createdAt)} · {o.items.map((i) => `${i.name} (${i.size})×${i.qty}`).join(', ')}</span></span>
                <span className="flex items-center gap-3">
                  {inr(o.total)} <OrderBadge status={o.status} label={o.statusLabel} />
                  {o.receipt?.ready && <button className="link text-brand" onClick={() => admin.receipt(o).catch((e) => toast(e.message, 'error'))}>{o.receipt.number}</button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Box>
      {!!returns.length && (
        <Box>
          <p className="mb-3 font-medium">Returns</p>
          <ul className="space-y-1 text-sm">{returns.map((r) => <li key={r.id}>{r.orderNumber} · {r.statusLabel} · {inr(r.refund)} · {r.reason}</li>)}</ul>
        </Box>
      )}
    </div>
  );
}

function Returns() {
  const [status, setStatus] = useState('requested');
  const [n, setN] = useState(0);
  const toast = useUI((s) => s.toast);
  const list = useAsync(() => admin.returns(status || undefined), [status, n]);
  const act = async (id: string, action: 'approve' | 'reject' | 'received') => {
    const note = action === 'reject' ? prompt('Why are you rejecting this return? (the customer sees this)') : undefined;
    if (action === 'reject' && !note) return;
    if (action === 'received' && !confirm('Item received and checked? This refunds the customer to their original payment method.')) return;
    try {
      await admin.returnAction(id, action, note ?? undefined);
      toast(action === 'received' ? 'Refund started' : `Return ${action === 'approve' ? 'approved' : 'rejected'}`);
      setN((x) => x + 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    }
  };
  return (
    <Box>
      <select className="input mb-4 w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All</option>
        {['requested', 'approved', 'refund_pending', 'refunded', 'rejected'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </select>
      {list.loading && !list.data ? <Skeleton className="h-32" /> : !list.data?.length ? <p className="py-6 text-sm text-ink-400">No returns.</p> : (
        <ul className="divide-y divide-ink/5 text-sm">
          {list.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div>
                <p><Link to={`/admin/orders/${r.orderId}`} className="font-medium text-brand hover:underline">{r.orderNumber}</Link> · {r.customer.name || r.customer.phone} · <b>{r.statusLabel}</b></p>
                <p className="text-ink-600">{r.items.map((i) => `${i.name} (${i.size}) × ${i.qty}`).join(', ')} · refund {inr(r.refund)}</p>
                <p className="text-xs text-ink-400">“{r.reason}” · {formatDate(r.createdAt)}{r.adminNote && ` · note: ${r.adminNote}`}</p>
              </div>
              <div className="flex gap-2">
                {r.status === 'requested' && <button className="btn-outline" onClick={() => act(r.id, 'approve')}>Approve</button>}
                {(r.status === 'requested' || r.status === 'approved') && <button className="btn-primary" onClick={() => act(r.id, 'received')}>Received → refund</button>}
                {(r.status === 'requested' || r.status === 'approved') && <button className="btn-ghost text-red-600" onClick={() => act(r.id, 'reject')}>Reject</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Box>
  );
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free'];

function Products() {
  const [n, setN] = useState(0);
  const list = useAsync(() => admin.products(), [n]);
  const [editing, setEditing] = useState<AdminProduct | 'new' | null>(null);
  return (
    <Box>
      <div className="mb-4 flex justify-between"><p className="text-sm text-ink-600">Prices in rupees. Stock is per size.</p><button className="btn-primary" onClick={() => setEditing('new')}>Add product</button></div>
      {list.loading && !list.data ? <Skeleton className="h-32" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-400"><tr><th className="py-2">Product</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
            <tbody className="divide-y divide-ink/5">
              {(list.data ?? []).map((p) => (
                <tr key={p.id} className={cx(!p.active && 'opacity-50')}>
                  <td className="py-3"><b>{p.name}</b><br /><span className="text-xs text-ink-400">/{p.slug}{!p.active && ' · hidden'}</span></td>
                  <td className="py-3">{p.category}</td>
                  <td className="py-3">{inr(p.price)} <span className="text-xs text-ink-400 line-through">{inr(p.mrp)}</span></td>
                  <td className="py-3 text-xs">{p.variants.map((v) => `${v.size}:${v.stock}`).join(' ')}</td>
                  <td className="py-3 text-right"><button className="link text-brand" onClick={() => setEditing(p)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <ProductForm product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setN((x) => x + 1); }} />}
    </Box>
  );
}

function ProductForm({ product, onClose, onSaved }: { product: AdminProduct | null; onClose: () => void; onSaved: () => void }) {
  const toast = useUI((s) => s.toast);
  const navigate = useNavigate();
  const [f, setF] = useState(() => ({
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    category: product?.category ?? 'kurtis',
    fabric: product?.fabric ?? 'Cotton',
    occasion: product?.occasion ?? 'Casual',
    price: String(product?.price ?? ''),
    mrp: String(product?.mrp ?? ''),
    description: product?.description ?? '',
    images: (product?.images ?? []).join('\n'),
    colors: (product?.colors ?? []).map((c) => `${c.name} ${c.hex}`).join('\n'),
    highlights: (product?.highlights ?? []).join('\n'),
    stock: Object.fromEntries(SIZES.map((s) => [s, String(product?.variants.find((v) => v.size === s)?.stock ?? '')])) as Record<string, string>,
    isNew: product?.isNew ?? true,
    isBestseller: product?.isBestseller ?? false,
    active: product?.active ?? true,
  }));
  const [busy, setBusy] = useState(false);
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  const save = async () => {
    setBusy(true);
    try {
      const body = {
        name: f.name.trim(),
        slug: f.slug.trim() || f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        category: f.category, fabric: f.fabric, occasion: f.occasion,
        price: Number(f.price), mrp: Number(f.mrp || f.price),
        description: f.description,
        images: lines(f.images),
        highlights: lines(f.highlights),
        colors: lines(f.colors).map((l) => { const m = l.match(/^(.*?)\s*(#[0-9a-fA-F]{6})$/); return m ? { name: m[1], hex: m[2] } : { name: l, hex: '#6E0F1C' }; }),
        stock: Object.fromEntries(Object.entries(f.stock).filter(([, v]) => v !== '').map(([k, v]) => [k, Math.max(0, Number(v) || 0)])),
        isNew: f.isNew, isBestseller: f.isBestseller, active: f.active,
      };
      await admin.saveProduct(product?.id ?? null, body);
      toast(product ? 'Product saved' : 'Product added');
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error');
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title={product ? 'Edit product' : 'Add product'} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Name (searchable: colour + fabric + work + type)"><input className="input" value={f.name} onChange={set('name')} placeholder="Bottle Green Embroidered Cotton Kurta Set" /></Field></div>
        <Field label="URL slug" hint="Leave empty to build from the name"><input className="input" value={f.slug} onChange={set('slug')} /></Field>
        <Field label="Category"><select className="input" value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>
        <Field label="Fabric"><input className="input" value={f.fabric} onChange={set('fabric')} /></Field>
        <Field label="Occasion"><input className="input" value={f.occasion} onChange={set('occasion')} /></Field>
        <Field label="Price (₹)"><input className="input" inputMode="numeric" value={f.price} onChange={set('price')} /></Field>
        <Field label="MRP (₹)"><input className="input" inputMode="numeric" value={f.mrp} onChange={set('mrp')} /></Field>
        <div className="sm:col-span-2"><Field label="Description"><textarea className="input min-h-[90px]" value={f.description} onChange={set('description')} /></Field></div>
        <Field label="Photo URLs (one per line)" hint="e.g. /products/<slug>/1.jpg"><textarea className="input min-h-[80px]" value={f.images} onChange={set('images')} /></Field>
        <Field label="Colours (one per line: name #hex)"><textarea className="input min-h-[80px]" value={f.colors} onChange={set('colors')} placeholder="Maroon #6E0F1C" /></Field>
        <div className="sm:col-span-2"><Field label="Highlights (one per line)"><textarea className="input min-h-[70px]" value={f.highlights} onChange={set('highlights')} /></Field></div>
        <div className="sm:col-span-2">
          <span className="label">Stock per size (leave empty if not offered)</span>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {SIZES.map((s) => <label key={s} className="text-center text-xs">{s}<input className="input mt-1 text-center" inputMode="numeric" value={f.stock[s]} onChange={(e) => setF({ ...f, stock: { ...f.stock, [s]: e.target.value.replace(/\D/g, '') } })} /></label>)}
          </div>
        </div>
        <div className="flex flex-wrap gap-5 text-sm sm:col-span-2">
          {(['isNew', 'isBestseller', 'active'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /> {k === 'isNew' ? 'New arrival' : k === 'isBestseller' ? 'Bestseller' : 'Visible in shop'}</label>
          ))}
        </div>
        <div className="flex gap-3 sm:col-span-2">
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Save'}</button>
          {product && <button className="btn-outline" onClick={() => navigate(`/product/${product.slug}`)}>View in shop</button>}
        </div>
      </div>
    </Modal>
  );
}
