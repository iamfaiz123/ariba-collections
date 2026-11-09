import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { EmptyState, Field, Heading, Skeleton, Spinner } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { cancelOrder, getOrdersForUser, login, register, updateProfile } from '@/services/api';
import { useAuth, useUI } from '@/store';
import type { Order, OrderStatus } from '@/types';
import { cx, formatDate, inr } from '@/utils/format';

export default function Account() {
  const user = useAuth((s) => s.user);
  return user ? <Dashboard /> : <AuthForms />;
}

function AuthForms() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const setUser = useAuth((s) => s.setUser);
  const toast = useUI((s) => s.toast);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && form.name.trim().length < 2) return setError('Please enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Please enter a valid email.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    setBusy(true);
    try {
      const u = mode === 'login' ? await login(form.email, form.password) : await register(form.name.trim(), form.email, form.password);
      setUser(u);
      toast(mode === 'login' ? `Welcome back, ${u.name.split(' ')[0]}` : 'Account created — welcome to Aribas!');
      const next = params.get('next');
      if (next?.startsWith('/')) navigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-x grid max-w-5xl items-center gap-12 py-14 md:grid-cols-2">
      <div className="hidden md:block">
        <Heading pre={mode === 'login' ? 'Welcome' : 'Join the'} title={mode === 'login' ? 'Back' : 'Circle'} size="xl" />
        <p className="mt-6 max-w-sm text-ink-600">Track orders, save your wishlist across devices and get early access to festive drops.</p>
        <ul className="mt-6 space-y-3 text-sm">
          {['Faster checkout with saved addresses', 'Order tracking & easy returns', 'Members-only offers'].map((t) => (
            <li key={t} className="flex items-center gap-2"><Icon name="check" size={16} className="text-brand" /> {t}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl bg-white p-8">
        <div className="mb-6 grid grid-cols-2 rounded-full bg-paper p-1 text-sm">
          {(['login', 'register'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(''); }} className={cx('rounded-full py-2.5 transition', mode === m ? 'bg-brand text-white' : 'text-ink-600')}>
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
        <form onSubmit={submit} noValidate className="space-y-4">
          {mode === 'register' && <Field label="Full name"><input className="input" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>}
          <Field label="Email"><input className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Password"><input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          <p className="text-center text-xs text-ink-400">Demo mode: accounts are stored in this browser only.</p>
        </form>
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  Placed: 'bg-blue-50 text-blue-700', Packed: 'bg-amber-50 text-amber-700', Shipped: 'bg-indigo-50 text-indigo-700',
  Delivered: 'bg-emerald-50 text-emerald-700', Cancelled: 'bg-ink/5 text-ink-600',
};

function Dashboard() {
  const { user, setUser, logout } = useAuth();
  const toast = useUI((s) => s.toast);
  const [tab, setTab] = useState<'orders' | 'profile'>('orders');
  const [refresh, setRefresh] = useState(0);
  const orders = useAsync(() => getOrdersForUser(user!.email), [user!.email, refresh]);
  const [profile, setProfile] = useState({ name: user!.name, phone: user!.phone ?? '' });
  const [saving, setSaving] = useState(false);

  const onCancel = async (o: Order) => {
    if (!confirm(`Cancel order #${o.id}?`)) return;
    try {
      await cancelOrder(o.id);
      toast('Order cancelled');
      setRefresh((n) => n + 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not cancel', 'error');
    }
  };

  return (
    <div className="container-x py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading as="h1" pre="Hello," title={user!.name.split(' ')[0]} />
        <button onClick={() => { logout(); toast('Signed out', 'info'); }} className="btn-outline"><Icon name="logout" size={16} /> Sign out</button>
      </div>
      <div className="mt-8 flex gap-6 border-b border-ink/10">
        {(['orders', 'profile'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx('-mb-px border-b-2 pb-3 font-display uppercase tracking-wider', tab === t ? 'border-brand text-brand' : 'border-transparent text-ink-400')}>{t === 'orders' ? 'My orders' : 'Profile'}</button>
        ))}
      </div>

      {tab === 'orders' ? (
        <div className="mt-8">
          {orders.loading && !orders.data ? <Skeleton className="h-40" /> : !orders.data?.length ? (
            <EmptyState icon="package" title="No orders yet" body="When you place an order, it will show up here." action={<Link to="/shop" className="btn-primary">Start shopping</Link>} />
          ) : (
            <ul className="space-y-4">
              {orders.data.map((o) => (
                <li key={o.id} className="rounded-xl bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Link to={`/order/${o.id}`} className="font-medium hover:text-brand">Order #{o.id}</Link>
                      <p className="text-xs text-ink-400">{formatDate(o.createdAt)} · {o.lines.reduce((n, l) => n + l.qty, 0)} item(s)</p>
                    </div>
                    <span className={cx('rounded-full px-3 py-1 text-xs font-medium', STATUS_STYLE[o.status])}>{o.status}</span>
                    <p className="font-display text-xl font-semibold text-brand">{inr(o.total)}</p>
                  </div>
                  <p className="mt-3 line-clamp-1 text-sm text-ink-600">{o.lines.map((l) => `${l.name} (${l.size})`).join(', ')}</p>
                  <div className="mt-3 flex gap-4 text-xs">
                    <Link to={`/order/${o.id}`} className="link">View details</Link>
                    {o.status === 'Placed' && <button onClick={() => onCancel(o)} className="text-red-600 underline underline-offset-4">Cancel order</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <form
          className="mt-8 max-w-md space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              setUser(await updateProfile(user!.id, profile));
              toast('Profile updated');
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Could not save', 'error');
            } finally {
              setSaving(false);
            }
          }}
        >
          <Field label="Full name"><input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
          <Field label="Email"><input className="input bg-paper" value={user!.email} disabled /></Field>
          <Field label="Mobile"><input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} inputMode="tel" /></Field>
          <button className="btn-primary" disabled={saving}>{saving ? <Spinner /> : 'Save changes'}</button>
        </form>
      )}
    </div>
  );
}
