import { Link } from 'react-router-dom';
import { useCart, useUI, useWishlist } from '@/store';
import type { CartItem } from '@/types';
import { inr } from '@/utils/format';
import { Icon } from './Icon';
import { ProductArt } from './ProductArt';
import { QtyStepper } from './ui';

export function CartLine({ item, compact, onNavigate }: { item: CartItem; compact?: boolean; onNavigate?: () => void }) {
  const { setQty, remove } = useCart();
  const toggleWish = useWishlist((s) => s.toggle);
  const inWish = useWishlist((s) => s.ids.includes(item.productId));
  const toast = useUI((s) => s.toast);
  const href = `/product/${item.slug}?color=${encodeURIComponent(item.color.name)}`;

  return (
    <div className="flex gap-4">
      <Link to={href} onClick={onNavigate} className={`${compact ? 'h-28 w-20' : 'h-36 w-28'} shrink-0 overflow-hidden rounded-xl`}>
        <ProductArt art={item.art} color={item.color.hex} accent={item.color.accent} src={item.image} alt={item.name} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link to={href} onClick={onNavigate} className="line-clamp-2 text-sm font-medium hover:text-brand">{item.name}</Link>
          <button onClick={() => remove(item.key)} className="-mr-1 -mt-1 rounded-full p-1 text-ink-400 hover:text-red-600" aria-label={`Remove ${item.name}`}><Icon name="trash" size={16} /></button>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-600">
          <span className="h-3 w-3 rounded-full" style={{ background: item.color.hex }} /> {item.color.name} · Size {item.size}
        </p>
        <div className="mt-auto flex items-end justify-between pt-3">
          <QtyStepper size="sm" value={item.qty} max={item.maxQty} onChange={(n) => setQty(item.key, n)} />
          <div className="text-right">
            <p className="text-sm font-medium">{inr(item.price * item.qty)}</p>
            {item.mrp > item.price && <p className="text-xs text-ink-400 line-through">{inr(item.mrp * item.qty)}</p>}
          </div>
        </div>
        {!compact && !inWish && (
          <button
            className="mt-2 self-start text-xs text-ink-600 underline underline-offset-4 hover:text-brand"
            onClick={() => {
              toggleWish(item.productId);
              remove(item.key);
              toast('Moved to wishlist', 'info');
            }}
          >
            Move to wishlist
          </button>
        )}
      </div>
    </div>
  );
}
