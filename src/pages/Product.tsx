import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { ProductArt, type ArtView } from '@/components/ProductArt';
import { ProductGrid } from '@/components/ProductCard';
import { Breadcrumbs, EmptyState, Modal, Price, QtyStepper, SectionHeading, Skeleton, Stars } from '@/components/ui';
import { categoryBySlug } from '@/data/categories';
import { SHIPPING, SIZE_CHART } from '@/data/content';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getProductBySlug, getRelated } from '@/services/api';
import { useCart, useRecent, useUI, useWishlist } from '@/store';
import type { Product as P, Size } from '@/types';
import { cx, deliveryEstimate, formatDate } from '@/utils/format';

type Slide = { kind: 'video'; src: string } | { kind: 'image'; src: string } | { kind: 'art'; view: ArtView };

export default function ProductPage() {
  const { slug = '' } = useParams();
  const { data: product, loading } = useAsync(() => getProductBySlug(slug), [slug]);
  useDocumentTitle(product?.name ?? 'Product');

  if (loading) return <ProductSkeleton />;
  if (!product) return <div className="container-x"><EmptyState icon="search" title="Product not found" body="It may have sold out or moved. Explore our latest styles instead." action={<Link to="/shop" className="btn-primary">Shop all</Link>} /></div>;
  return <ProductView key={product.id} product={product} />;
}

function ProductView({ product }: { product: P }) {
  const [params, setParams] = useSearchParams();
  const initialColor = Math.max(0, product.colors.findIndex((c) => c.name === params.get('color')));
  const [colorIdx, setColorIdx] = useState(initialColor);
  const [size, setSize] = useState<Size | null>(product.sizes.length === 1 ? product.sizes[0] : null);
  const [qty, setQty] = useState(1);
  const [slide, setSlide] = useState(0);
  const [sizeError, setSizeError] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [tab, setTab] = useState<'details' | 'care' | 'shipping'>('details');
  const add = useCart((s) => s.add);
  const { setCartOpen, toast } = useUI();
  const wished = useWishlist((s) => s.ids.includes(product.id));
  const toggleWish = useWishlist((s) => s.toggle);
  const pushRecent = useRecent((s) => s.push);
  const navigate = useNavigate();
  const related = useAsync(() => getRelated(product, 4), [product.id]);
  const color = product.colors[colorIdx];
  const cat = categoryBySlug(product.category);

  useEffect(() => {
    pushRecent(product.id);
  }, [product.id, pushRecent]);

  const slides: Slide[] = useMemo(() => {
    const s: Slide[] = [];
    if (product.video) s.push({ kind: 'video', src: product.video });
    if (product.images?.length) product.images.forEach((src) => s.push({ kind: 'image', src }));
    else (['front', 'back', 'detail', 'dupatta'] as ArtView[]).forEach((view) => s.push({ kind: 'art', view }));
    return s;
  }, [product]);

  const pickColor = (i: number) => {
    setColorIdx(i);
    const next = new URLSearchParams(params);
    next.set('color', product.colors[i].name);
    setParams(next, { replace: true });
  };

  const addToBag = (buyNow = false) => {
    if (!size) {
      setSizeError(true);
      document.getElementById('size-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    add(product, size, color, qty);
    if (buyNow) navigate('/checkout');
    else {
      setCartOpen(true);
      toast(`${product.name} added to bag`);
    }
  };

  const renderSlide = (s: Slide, thumb = false) =>
    s.kind === 'video' ? (
      thumb ? <div className="tile grid h-full w-full place-items-center text-brand"><Icon name="play" size={20} filled /></div>
        : <video src={s.src} className="h-full w-full object-cover" autoPlay muted loop playsInline controls={false} />
    ) : (
      <ProductArt art={product.art} color={color.hex} accent={color.accent} view={s.kind === 'art' ? s.view : 'front'} src={s.kind === 'image' ? s.src : undefined} alt={`${product.name} in ${color.name}`} />
    );

  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Shop', to: '/shop' }, { label: cat?.name ?? '', to: `/shop?category=${product.category}` }, { label: product.name }]} />

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        {/* Gallery */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row lg:sticky lg:top-24 lg:self-start">
          <div className="no-scrollbar flex gap-3 overflow-x-auto sm:w-20 sm:flex-col">
            {slides.map((s, i) => (
              <button key={i} onClick={() => setSlide(i)} className={cx('tile aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-lg ring-offset-2 ring-offset-paper transition', i === slide ? 'ring-2 ring-brand' : 'opacity-70 hover:opacity-100')} aria-label={`View image ${i + 1}`}>
                {renderSlide(s, true)}
              </button>
            ))}
          </div>
          <div className="tile relative aspect-[3/4] flex-1 overflow-hidden rounded-xl">
            <div key={`${slide}-${colorIdx}`} className="h-full w-full animate-fade-in">{renderSlide(slides[slide])}</div>
            <button onClick={() => setSlide((slide - 1 + slides.length) % slides.length)} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow" aria-label="Previous image"><Icon name="chevronLeft" size={18} /></button>
            <button onClick={() => setSlide((slide + 1) % slides.length)} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow" aria-label="Next image"><Icon name="chevronRight" size={18} /></button>
          </div>
        </div>

        {/* Info */}
        <div>
          <p className="eyebrow">{cat?.name} · {product.fabric}</p>
          <h1 className="mt-3 text-4xl font-semibold leading-none text-brand sm:text-5xl">{product.name}</h1>
          <a href="#reviews" className="mt-3 flex items-center gap-2 text-sm text-ink-600 hover:text-brand">
            <Stars rating={product.rating} /> {product.rating} · {product.reviewCount} reviews
          </a>
          <div className="mt-5"><Price price={product.price} mrp={product.mrp} size="lg" /></div>
          <p className="mt-1 text-xs text-ink-400">Inclusive of all taxes</p>
          <p className="mt-5 text-[15px] leading-relaxed text-ink-600">{product.description}</p>

          <div className="mt-7">
            <p className="label">Colour: <span className="normal-case tracking-normal text-ink">{color.name}</span></p>
            <div className="flex gap-3">
              {product.colors.map((c, i) => (
                <button key={c.name} onClick={() => pickColor(i)} className={cx('h-10 w-10 rounded-full ring-offset-2 ring-offset-paper transition', i === colorIdx ? 'ring-2 ring-brand' : 'ring-1 ring-ink/10 hover:ring-ink/40')} style={{ background: `linear-gradient(135deg, ${c.hex} 60%, ${c.accent} 60%)` }} aria-label={c.name} aria-pressed={i === colorIdx} />
              ))}
            </div>
          </div>

          <div className="mt-7" id="size-picker">
            <div className="flex items-center justify-between">
              <p className="label">Size {size && <span className="normal-case tracking-normal text-ink">: {size}</span>}</p>
              {product.sizes.length > 1 && <button onClick={() => setChartOpen(true)} className="flex items-center gap-1 text-xs text-brand underline underline-offset-4"><Icon name="ruler" size={14} /> Size chart</button>}
            </div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s) => (
                <button key={s} onClick={() => { setSize(s); setSizeError(false); }} className={cx('h-11 min-w-[52px] rounded-full border px-4 text-sm transition', size === s ? 'border-brand bg-brand text-white' : 'border-ink-200 bg-white hover:border-brand')} aria-pressed={size === s}>
                  {s === 'Free' ? 'Free size' : s}
                </button>
              ))}
            </div>
            {sizeError && <p className="mt-2 text-xs text-red-600">Please select a size</p>}
            {product.stock <= 5 && <p className="mt-3 text-xs font-medium text-amber-700">Hurry — only {product.stock} left in stock</p>}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <QtyStepper value={qty} onChange={setQty} max={Math.min(10, product.stock)} />
            <button onClick={() => addToBag()} className="btn-primary flex-1"><Icon name="bag" size={18} /> Add to bag</button>
            <button onClick={() => { const a = toggleWish(product.id); toast(a ? 'Saved to wishlist' : 'Removed from wishlist', 'info'); }} className={cx('btn-outline h-11 w-11 p-0', wished && 'border-brand text-brand')} aria-label="Toggle wishlist" aria-pressed={wished}>
              <Icon name="heart" size={18} filled={wished} />
            </button>
            <button onClick={() => addToBag(true)} className="btn-dark w-full">Buy it now</button>
          </div>

          <ul className="mt-8 grid gap-3 rounded-xl bg-white p-5 text-sm">
            <li className="flex gap-3"><Icon name="truck" size={18} className="text-brand" /> Estimated delivery <b className="font-medium">{deliveryEstimate([4, 7])}</b></li>
            <li className="flex gap-3"><Icon name="refresh" size={18} className="text-brand" /> Easy 7-day returns & exchanges</li>
            <li className="flex gap-3"><Icon name="shield" size={18} className="text-brand" /> Cash on delivery available</li>
          </ul>

          <div className="mt-8">
            <div className="flex gap-6 border-b border-ink/10" role="tablist">
              {(['details', 'care', 'shipping'] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx('-mb-px border-b-2 pb-3 font-display text-sm uppercase tracking-wider', tab === t ? 'border-brand text-brand' : 'border-transparent text-ink-400 hover:text-ink')}>{t}</button>
              ))}
            </div>
            <div className="py-5 text-sm leading-relaxed text-ink-600" role="tabpanel">
              {tab === 'details' && (
                <>
                  <ul className="list-disc space-y-1.5 pl-5">{product.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
                  <dl className="mt-5 grid grid-cols-2 gap-y-2">
                    <dt className="text-ink-400">Fabric</dt><dd>{product.fabric}</dd>
                    <dt className="text-ink-400">Occasion</dt><dd>{product.occasion}</dd>
                    <dt className="text-ink-400">Set includes</dt><dd>{product.includes.join(', ')}</dd>
                    <dt className="text-ink-400">SKU</dt><dd>{product.id.toUpperCase()}-{color.name.slice(0, 3).toUpperCase()}</dd>
                  </dl>
                </>
              )}
              {tab === 'care' && <ul className="list-disc space-y-1.5 pl-5">{product.care.map((c) => <li key={c}>{c}</li>)}</ul>}
              {tab === 'shipping' && (
                <p>Free standard shipping on orders above ₹{SHIPPING.freeAbove.toLocaleString('en-IN')} (₹{SHIPPING.standardFee} otherwise), delivered in 4–7 business days. Express delivery (1–3 days) for ₹{SHIPPING.expressFee}. Returns accepted within 7 days of delivery for unworn pieces with tags.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section id="reviews" className="mt-24 scroll-mt-24">
        <SectionHeading pre="Customer" title="Reviews" />
        <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
          <div className="rounded-xl bg-white p-6">
            <p className="font-display text-6xl font-semibold text-brand">{product.rating}</p>
            <Stars rating={product.rating} size={18} className="mt-2" />
            <p className="mt-2 text-sm text-ink-600">Based on {product.reviewCount} reviews</p>
            {[5, 4, 3, 2, 1].map((n) => {
              const pct = n === 5 ? 72 : n === 4 ? 21 : n === 3 ? 5 : 1;
              return (
                <div key={n} className="mt-2 flex items-center gap-2 text-xs">
                  <span className="w-3">{n}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10"><div className="h-full bg-brand" style={{ width: `${pct}%` }} /></div>
                  <span className="w-8 text-right text-ink-400">{pct}%</span>
                </div>
              );
            })}
          </div>
          <ul className="divide-y divide-ink/10">
            {product.reviews.map((r) => (
              <li key={r.id} className="py-5 first:pt-0">
                <div className="flex items-center justify-between">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-ink-400">{formatDate(r.date)}</span>
                </div>
                <p className="mt-2 font-medium">{r.title}</p>
                <p className="mt-1 text-sm text-ink-600">{r.body}</p>
                <p className="mt-2 text-xs text-ink-400">{r.author} · <span className="text-emerald-700">Verified buyer</span></p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-24">
        <SectionHeading pre="You may" title="Also like" />
        <ProductGrid products={related.data} loading={related.loading} count={4} />
      </section>

      {/* Mobile sticky add-to-bag */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-ink/10 bg-paper/95 p-3 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1"><Price price={product.price} mrp={product.mrp} size="sm" /></div>
        <button onClick={() => addToBag()} className="btn-primary px-8">Add to bag</button>
      </div>

      <Modal open={chartOpen} onClose={() => setChartOpen(false)} title="Size chart" wide>
        <p className="mb-4 text-sm text-ink-600">Garment measurements in inches. Kurtas include 1.5–2" seam allowance.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead><tr className="border-b border-ink/10 text-xs uppercase tracking-wider text-ink-600">{['Size', 'Bust', 'Waist', 'Hip', 'Length'].map((h) => <th key={h} className="py-3">{h}</th>)}</tr></thead>
            <tbody>
              {SIZE_CHART.map((r) => (
                <tr key={r.size} className={cx('border-b border-ink/5', size === r.size && 'bg-brand-50 font-medium')}>
                  <td className="py-2.5">{r.size}</td><td>{r.bust}</td><td>{r.waist}</td><td>{r.hip}</td><td>{r.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="container-x grid gap-10 py-14 lg:grid-cols-[1.15fr_1fr]">
      <Skeleton className="aspect-[3/4]" />
      <div className="space-y-4"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-12 w-3/4" /><Skeleton className="h-6 w-1/4" /><Skeleton className="h-24" /><Skeleton className="h-12" /></div>
    </div>
  );
}
