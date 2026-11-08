import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx, discountPercent, inr } from '@/utils/format';
import { Icon } from './Icon';

export function Price({ price, mrp, size = 'md' }: { price: number; mrp: number; size?: 'sm' | 'md' | 'lg' }) {
  const off = discountPercent(price, mrp);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={cx('font-display font-semibold text-brand', size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-lg' : 'text-base')}>{inr(price)}</span>
      {off > 0 && (
        <>
          <span className={cx('text-ink-400 line-through', size === 'lg' ? 'text-base' : 'text-xs')}>{inr(mrp)}</span>
          <span className={cx('font-medium text-emerald-700', size === 'lg' ? 'text-sm' : 'text-xs')}>{off}% off</span>
        </>
      )}
    </div>
  );
}

export function Stars({ rating, size = 14, className }: { rating: number; size?: number; className?: string }) {
  return (
    <div className={cx('flex items-center gap-0.5', className)} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
          <Icon name="star" size={size} className="absolute inset-0 text-ink-200" filled stroke="none" />
          <span className="absolute inset-0 overflow-hidden" style={{ width: `${Math.max(0, Math.min(1, rating - i + 1)) * 100}%` }}>
            <Icon name="star" size={size} className="text-gold" filled stroke="none" />
          </span>
        </span>
      ))}
    </div>
  );
}

export function QtyStepper({ value, onChange, max = 10, size = 'md' }: { value: number; onChange: (n: number) => void; max?: number; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-8' : 'h-11';
  return (
    <div className={cx('inline-flex items-center rounded-full border border-ink-200 bg-white', h)}>
      <button type="button" aria-label="Decrease quantity" className="grid h-full w-9 place-items-center text-ink-600 hover:text-brand disabled:opacity-30" disabled={value <= 1} onClick={() => onChange(value - 1)}>
        <Icon name="minus" size={14} />
      </button>
      <span className="w-6 text-center text-sm tabular-nums" aria-live="polite">{value}</span>
      <button type="button" aria-label="Increase quantity" className="grid h-full w-9 place-items-center text-ink-600 hover:text-brand disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Icon name="plus" size={14} />
      </button>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="no-scrollbar flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-xs text-ink-400">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <Icon name="chevronRight" size={12} />}
          {it.to ? <Link to={it.to} className="hover:text-brand">{it.label}</Link> : <span className="text-ink-600">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} aria-hidden />;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('relative max-h-[90vh] w-full animate-rise overflow-y-auto rounded-t-3xl bg-paper p-6 shadow-2xl sm:rounded-3xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-ink/5" aria-label="Close"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: Parameters<typeof Icon>[0]['name']; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand"><Icon name={icon} size={28} /></div>
      <h2 className="text-3xl text-brand">{title}</h2>
      <p className="mt-2 text-sm text-ink-600">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Signature two-part heading: small italic serif lead-in + big condensed uppercase word. */
export function Heading({ pre, title, as: Tag = 'h2', size = 'lg', className }: { pre?: string; title: string; as?: 'h1' | 'h2' | 'h3'; size?: 'md' | 'lg' | 'xl'; className?: string }) {
  const big = size === 'xl' ? 'text-5xl sm:text-7xl' : size === 'lg' ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-4xl';
  const small = size === 'xl' ? 'text-3xl sm:text-5xl' : size === 'lg' ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-2xl';
  return (
    <Tag className={cx('flex flex-wrap items-baseline gap-x-3 leading-none', className)}>
      {pre && <span className={cx('font-serif normal-case italic text-brand', small)}>{pre}</span>}
      <span className={cx('font-display font-semibold uppercase text-brand', big)}>{title}</span>
    </Tag>
  );
}

export function SectionHeading({ pre, title, action, sub }: { pre?: string; title: string; action?: ReactNode; sub?: string }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        <Heading pre={pre} title={title} />
        {sub && <p className="mt-3 max-w-lg text-sm text-ink-600">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function ExploreLink({ to, children = 'Explore now' }: { to: string; children?: ReactNode }) {
  return (
    <Link to={to} className="link-cta">
      {children} <Icon name="arrowUpRight" size={18} />
    </Link>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-400">{hint}</span> : null}
    </label>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-ink/[.06]', className)} />;
}
