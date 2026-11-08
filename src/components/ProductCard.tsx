import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '@/types';
import { useCart, useUI, useWishlist } from '@/store';
import { cx, inr } from '@/utils/format';
import { Icon } from './Icon';
import { ProductArt } from './ProductArt';
import { Skeleton } from './ui';

export function ProductCard({ product, tall }: { product: Product; tall?: boolean }) {
  const [colorIdx, setColorIdx] = useState(0);
  const [picking, setPicking] = useState(false);
  const wished = useWishlist((s) => s.ids.includes(product.id));
  const toggle = useWishlist((s) => s.toggle);
  const add = useCart((s) => s.add);
  const { toast, setCartOpen } = useUI();
  const color = product.colors[colorIdx];
  const href = `/product/${product.slug}?color=${encodeURIComponent(color.name)}`;

  const addSize = (size: (typeof product.sizes)[number]) => {
    add(product, size, color);
    setPicking(false);
    setCartOpen(true);
  };

  return (
    <article className="group relative flex flex-col" onMouseLeave={() => setPicking(false)}>
      <div className={cx('tile relative overflow-hidden rounded-xl', tall ? 'aspect-[4/5] sm:aspect-auto sm:h-full sm:min-h-[420px]' : 'aspect-[3/4]')}>
        <Link to={href} aria-label={product.name} className="block h-full w-full">
          <div className="h-full w-full transition duration-700 group-hover:scale-[1.04]">
            <ProductArt art={product.art} color={color.hex} accent={color.accent} src={product.images?.[0]} alt={`${product.name} in ${color.name}`} />
          </div>
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          {product.isNew && <span className="rounded-full bg-white px-2.5 py-1 font-display text-[10px] uppercase tracking-wider text-brand">New</span>}
          {product.stock <= 5 && <span className="rounded-full bg-brand px-2.5 py-1 font-display text-[10px] uppercase tracking-wider text-white">Only {product.stock} left</span>}
        </div>

        <div className="absolute right-3 top-3 flex gap-1.5">
          <button
            onClick={() => {
              const added = toggle(product.id);
              toast(added ? 'Added to wishlist' : 'Removed from wishlist', 'info', added ? { label: 'View', to: '/wishlist' } : undefined);
            }}
            className={cx('grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm transition hover:scale-110', wished ? 'text-brand' : 'text-ink')}
            aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={wished}
          >
            <Icon name="heart" size={17} filled={wished} />
          </button>
          <button
            onClick={() => (product.sizes.length === 1 ? addSize(product.sizes[0]) : setPicking((v) => !v))}
            className="grid h-9 w-9 place-items-center rounded-full bg-white text-ink shadow-sm transition hover:scale-110 hover:text-brand"
            aria-label={`Add ${product.name} to bag`}
            aria-expanded={picking}
          >
            <Icon name="bag" size={17} />
          </button>
        </div>

        {picking && (
          <div className="absolute inset-x-3 bottom-3 animate-rise rounded-xl bg-white/95 p-2 shadow-lg backdrop-blur">
            <p className="mb-1.5 text-center text-[10px] uppercase tracking-[.2em] text-ink-600">Select size</p>
            <div className="grid grid-cols-6 gap-1">
              {product.sizes.map((s) => (
                <button key={s} className="rounded-md py-1.5 text-xs font-medium hover:bg-brand hover:text-white" onClick={() => addSize(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <Link to={href} className="line-clamp-1 font-display text-sm font-medium uppercase tracking-wide text-brand hover:underline">{product.name}</Link>
          <span className="shrink-0 font-display text-base font-semibold text-brand">{inr(product.price)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="line-clamp-2 text-xs leading-relaxed text-ink-400">{product.description}</p>
          {product.mrp > product.price && <span className="shrink-0 self-start text-xs text-ink-400 line-through">{inr(product.mrp)}</span>}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          {product.colors.map((c, i) => (
            <button
              key={c.name}
              onClick={() => setColorIdx(i)}
              className={cx('h-3.5 w-3.5 rounded-full ring-offset-2 ring-offset-paper transition', i === colorIdx ? 'ring-1 ring-ink' : 'hover:ring-1 hover:ring-ink-200')}
              style={{ background: c.hex }}
              aria-label={`Show in ${c.name}`}
              title={c.name}
            />
          ))}
          <span className="ml-auto text-[11px] text-ink-400">★ {product.rating} · {product.reviewCount}</span>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[3/4] rounded-xl" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-full" />
    </div>
  );
}

export function ProductGrid({ products, loading, count = 8 }: { products?: Product[] | null; loading?: boolean; count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
      {loading || !products ? Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />) : products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
