import { cx } from '@/utils/format';

const STYLE: Record<string, string> = {
  pending_payment: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-blue-50 text-blue-700',
  packed: 'bg-indigo-50 text-indigo-700',
  shipped: 'bg-violet-50 text-violet-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-ink/5 text-ink-600',
};

export function OrderBadge({ status, label }: { status: string; label?: string }) {
  return <span className={cx('inline-block rounded-full px-3 py-1 text-xs font-medium', STYLE[status] ?? 'bg-ink/5 text-ink-600')}>{label ?? status.replace('_', ' ')}</span>;
}
