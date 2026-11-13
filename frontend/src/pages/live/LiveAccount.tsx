import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { OrderBadge } from '@/components/live/OrderBadge';
import { OtpLogin } from '@/components/live/OtpLogin';
import { EmptyState, Field, Heading, Skeleton, Spinner } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { addresses, auth, orders } from '@/services/backend';
import { useAuth, useUI } from '@/store';
import { cx, formatDate, inr } from '@/utils/format';

export default function LiveAccount() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  if (!user)
    return (
      <div className="container-x grid max-w-5xl items-center gap-12 py-14 md:grid-cols-2">
        <div className="hidden md:block">
          <Heading pre="Welcome to" title="Aribas" size="xl" />
          <p className="mt-6 max-w-sm text-ink-600">Log in with your WhatsApp number — no password needed.</p>
          <ul className="mt-6 space-y-3 text-sm">
            {['Order tracking & receipts in one place', 'Saved addresses for faster checkout', 'Easy 7-day returns'].map((t) => (
              <li key={t} className="flex items-center gap-2"><Icon name="check" size={16} className="text-brand" /> {t}</li>
            ))}
          </ul>
        </div>
        <OtpLogin onDone={() => { const next = params.get('next'); if (next?.startsWith('/')) navigate(next); }} />
      </div>
    );
  return <Dashboard />;
}

function Dashboard() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const toast = useUI((s) => s.toast);
  const [tab, setTab] = useState<'orders' | 'addresses' | 'profile'>('orders');
  const [refresh, setRefresh] = useState(0);
  const list = useAsync(() => orders.list(), [refresh]);
  const addr = useAsync(() => addresses.list(), [refresh]);
  const [profile, setProfile] = useState({ name: user.name, email: user.email });
  const [saving, setSaving] = useState(false);

  return (
    <div className="container-x py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading as="h1" pre="Hello," title={user.name ? user.name.split(' ')[0] : 'there'} />
        <div className="flex gap-3">
          {user.role === 'admin' && <Link to="/admin" className="btn-dark">Admin</Link>}
          <button onClick={async () => { await auth.logout(); setUser(null); toast('Signed out', 'info'); }} className="btn-outline"><Icon name="logout" size={16} /> Sign out</button>
        </div>
      </div>
      <div className="mt-8 flex gap-6 border-b border-ink/10">
        {(['orders', 'addresses', 'profile'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx('-mb-px border-b-2 pb-3 font-display uppercase tracking-wider', tab === t ? 'border-brand text-brand' : 'border-transparent text-ink-400')}>
            {t === 'orders' ? 'My orders' : t === 'addresses' ? 'Addresses' : 'Profile'}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="mt-8">
          {list.loading && !list.data ? <Skeleton className="h-40" /> : list.error ? <p className="text-red-600">{list.error}</p> : !list.data?.length ? (
            <EmptyState icon="package" title="No orders yet" body="When you place an order, it will show up here with its receipt." action={<Link to="/shop" className="btn-primary">Start shopping</Link>} />
          ) : (
            <ul className="space-y-4">
              {list.data.map((o) => (
                <li key={o.id} className="rounded-xl bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Link to={`/order/${o.id}`} className="font-medium hover:text-brand">Order {o.number}</Link>
                      <p className="text-xs text-ink-400">{formatDate(o.createdAt)} · {o.items.reduce((n, l) => n + l.qty, 0)} item(s)</p>
                    </div>
                    <OrderBadge status={o.status} label={o.statusLabel} />
                    <p className="font-display text-xl font-semibold text-brand">{inr(o.total)}</p>
                  </div>
                  <p className="mt-3 line-clamp-1 text-sm text-ink-600">{o.items.map((l) => `${l.name} (${l.size})`).join(', ')}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs">
                    <Link to={`/order/${o.id}`} className="link">View details</Link>
                    {o.receipt?.ready && <button className="link text-brand" onClick={() => orders.receipt(o).catch((e) => toast(e.message, 'error'))}>Receipt {o.receipt.number}</button>}
                    {o.canPay && <Link to={`/order/${o.id}`} className="link text-brand">Pay now</Link>}
                    {o.paymentStatus.includes('refund') && <span className="text-emerald-700">{o.paymentStatus === 'refund_pending' ? 'Refund in progress' : `Refunded ${inr(o.refunded)}`}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'addresses' && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {addr.loading && !addr.data ? <Skeleton className="h-32" /> : !addr.data?.length ? <p className="text-sm text-ink-600">No saved addresses yet — add one at checkout.</p> : addr.data.map((a) => (
            <div key={a.id} className="rounded-xl bg-white p-5 text-sm">
              <p className="font-medium">{a.fullName} {a.isDefault && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand">Default</span>}</p>
              <p className="mt-1 text-ink-600">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} – {a.pincode}</p>
              <p className="text-ink-600">{a.phone}</p>
              <button className="mt-3 text-xs text-red-600 underline" onClick={async () => { await addresses.remove(a.id); setRefresh((n) => n + 1); }}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'profile' && (
        <form
          className="mt-8 max-w-md space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              setUser(await auth.updateMe(profile));
              toast('Profile updated');
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Could not save', 'error');
            } finally {
              setSaving(false);
            }
          }}
        >
          <Field label="Full name"><input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
          <Field label="WhatsApp number" hint="This is how you log in"><input className="input bg-paper" value={user.phone ?? ''} disabled /></Field>
          <Field label="Email (optional)"><input className="input" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field>
          <button className="btn-primary" disabled={saving}>{saving ? <Spinner /> : 'Save changes'}</button>
        </form>
      )}
    </div>
  );
}
