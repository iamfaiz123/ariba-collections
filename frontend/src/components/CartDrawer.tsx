import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SHIPPING } from '@/data/content';
import { cartSubtotal, useCart, useUI } from '@/store';
import { inr } from '@/utils/format';
import { CartLine } from './CartLine';
import { Icon } from './Icon';

export function CartDrawer() {
  const { cartOpen, setCartOpen } = useUI();
  const items = useCart((s) => s.items);
  const subtotal = cartSubtotal(items);
  const navigate = useNavigate();
  const remaining = Math.max(0, SHIPPING.freeAbove - subtotal);
  const progress = Math.min(100, (subtotal / SHIPPING.freeAbove) * 100);

  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCartOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cartOpen, setCartOpen]);

  if (!cartOpen) return null;
  const go = (to: string) => {
    setCartOpen(false);
    navigate(to);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping bag">
      <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={() => setCartOpen(false)} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-in flex-col bg-paper shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <h2 className="text-2xl">Your bag <span className="text-base text-ink-400">({items.length})</span></h2>
          <button onClick={() => setCartOpen(false)} className="btn-ghost -mr-3" aria-label="Close bag"><Icon name="close" /></button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand"><Icon name="bag" size={28} /></div>
            <p className="font-display text-2xl">Your bag is empty</p>
            <p className="mt-2 text-sm text-ink-600">Discover suits handcrafted for every occasion.</p>
            <button onClick={() => go('/shop')} className="btn-primary mt-6">Start shopping</button>
          </div>
        ) : (
          <>
            <div className="border-b border-ink/10 bg-white px-5 py-3">
              <p className="text-xs text-ink-600">
                {remaining > 0 ? <>Add <b className="text-ink">{inr(remaining)}</b> more for <b className="text-ink">free shipping</b></> : <span className="text-emerald-700">✓ You’ve unlocked free shipping</span>}
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/10"><div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
            <ul className="flex-1 divide-y divide-ink/10 overflow-y-auto px-5">
              {items.map((it) => <li key={it.key} className="py-4"><CartLine item={it} compact onNavigate={() => setCartOpen(false)} /></li>)}
            </ul>
            <div className="space-y-3 border-t border-ink/10 bg-white px-5 py-4">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-medium">{inr(subtotal)}</span></div>
              <p className="text-xs text-ink-400">Shipping & discounts calculated at checkout.</p>
              <button onClick={() => go('/checkout')} className="btn-primary w-full"><Icon name="lock" size={16} /> Checkout</button>
              <Link to="/cart" onClick={() => setCartOpen(false)} className="btn-outline w-full">View bag</Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
