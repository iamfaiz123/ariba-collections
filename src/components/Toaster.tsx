import { Link } from 'react-router-dom';
import { useUI } from '@/store';
import { cx } from '@/utils/format';
import { Icon } from './Icon';

export function Toaster() {
  const { toasts, dismiss } = useUI();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cx('pointer-events-auto flex w-full max-w-sm animate-rise items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white shadow-xl', t.tone === 'error' ? 'bg-red-700' : t.tone === 'info' ? 'bg-ink' : 'bg-brand')}>
          <Icon name={t.tone === 'error' ? 'close' : 'check'} size={16} />
          <span className="flex-1">{t.message}</span>
          {t.action && <Link to={t.action.to} onClick={() => dismiss(t.id)} className="font-medium text-gold-300 underline underline-offset-4">{t.action.label}</Link>}
        </div>
      ))}
    </div>
  );
}
