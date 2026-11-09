import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { ProductGrid } from '@/components/ProductCard';
import { Breadcrumbs, EmptyState, Heading } from '@/components/ui';
import { CATEGORIES, categoryBySlug } from '@/data/categories';
import { ALL_COLORS, ALL_SIZES, FABRICS, OCCASIONS } from '@/data/products';
import { useAsync } from '@/hooks/useAsync';
import { getProducts } from '@/services/api';
import type { CategorySlug, Fabric, Occasion, ProductFilters, Size, SortKey } from '@/types';
import { cx } from '@/utils/format';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'newest', label: 'Newest' },
  { key: 'price-asc', label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' },
  { key: 'discount', label: 'Biggest discount' },
];

const PRICE_RANGES = [
  { label: 'Under ₹2,000', min: 0, max: 1999 },
  { label: '₹2,000 – ₹4,000', min: 2000, max: 4000 },
  { label: '₹4,000 – ₹7,000', min: 4000, max: 7000 },
  { label: 'Above ₹7,000', min: 7000, max: undefined },
];

type MultiKey = 'category' | 'fabric' | 'occasion' | 'size' | 'color';

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const { category: pathCat } = useParams();
  const navigate = useNavigate();

  // One category = a collection page with a clean, indexable URL: /shop?category=x → /collections/x
  useEffect(() => {
    const cats = params.getAll('category');
    if (!pathCat && cats.length === 1) {
      const rest = new URLSearchParams(params);
      rest.delete('category');
      navigate(`/collections/${cats[0]}${rest.size ? `?${rest}` : ''}`, { replace: true });
    }
  }, [pathCat, params, navigate]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters: ProductFilters = useMemo(() => {
    const num = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined);
    return {
      q: params.get('q') ?? undefined,
      category: (pathCat ? [pathCat] : params.getAll('category')) as CategorySlug[],
      fabric: params.getAll('fabric') as Fabric[],
      occasion: params.getAll('occasion') as Occasion[],
      size: params.getAll('size') as Size[],
      color: params.getAll('color'),
      minPrice: num('min'),
      maxPrice: num('max'),
      sort: (params.get('sort') as SortKey) ?? 'featured',
      page: num('page') ?? 1,
      pageSize: 12,
    };
  }, [params, pathCat]);

  const { data, loading } = useAsync(() => getProducts(filters), [pathCat, params.toString()]);

  const singleCat = filters.category?.length === 1 ? categoryBySlug(filters.category[0]) : undefined;

  const update = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    fn(next);
    if (!next.has('page-keep')) next.delete('page');
    next.delete('page-keep');
    setParams(next, { replace: false });
  };

  /** Categories live in the path when there is exactly one, so toggling one can change the route. */
  const toggleCategory = (slug: string) => {
    const cur = filters.category ?? [];
    const next = cur.includes(slug as CategorySlug) ? cur.filter((c) => c !== slug) : [...cur, slug];
    const p = new URLSearchParams(params);
    p.delete('category');
    p.delete('page');
    if (next.length === 1) return navigate(`/collections/${next[0]}${p.size ? `?${p}` : ''}`);
    next.forEach((c) => p.append('category', c));
    navigate(`/shop${p.size ? `?${p}` : ''}`);
  };

  const toggle = (key: MultiKey, value: string) =>
    key === 'category' ? toggleCategory(value) :
    update((p) => {
      const vals = p.getAll(key);
      p.delete(key);
      (vals.includes(value) ? vals.filter((v) => v !== value) : [...vals, value]).forEach((v) => p.append(key, v));
    });

  const setPrice = (min?: number, max?: number) =>
    update((p) => {
      const same = filters.minPrice === min && filters.maxPrice === max;
      p.delete('min');
      p.delete('max');
      if (!same) {
        if (min != null) p.set('min', String(min));
        if (max != null) p.set('max', String(max));
      }
    });

  const clearAll = () => navigate(filters.q ? `/shop?q=${encodeURIComponent(filters.q)}` : '/shop');

  const active: { label: string; onRemove: () => void }[] = [
    ...(['category', 'fabric', 'occasion', 'size', 'color'] as MultiKey[]).flatMap((k) =>
      (k === 'category' ? filters.category ?? [] : params.getAll(k)).map((v) => ({ label: k === 'category' ? categoryBySlug(v)?.name ?? v : k === 'size' ? `Size ${v}` : v, onRemove: () => toggle(k, v) })),
    ),
    ...(filters.minPrice != null || filters.maxPrice != null
      ? [{ label: PRICE_RANGES.find((r) => r.min === filters.minPrice && r.max === filters.maxPrice)?.label ?? 'Price', onRemove: () => setPrice(filters.minPrice, filters.maxPrice) }]
      : []),
  ];

  const filterPanel = (
    <div className="space-y-1">
      <FilterGroup title="Category" defaultOpen>
        {CATEGORIES.map((c) => <Check key={c.slug} label={c.name} checked={!!filters.category?.includes(c.slug)} onChange={() => toggle('category', c.slug)} />)}
      </FilterGroup>
      <FilterGroup title="Price" defaultOpen>
        {PRICE_RANGES.map((r) => <Check key={r.label} label={r.label} radio checked={filters.minPrice === r.min && filters.maxPrice === r.max} onChange={() => setPrice(r.min, r.max)} />)}
      </FilterGroup>
      <FilterGroup title="Occasion" defaultOpen>
        {OCCASIONS.map((o) => <Check key={o} label={o} checked={!!filters.occasion?.includes(o)} onChange={() => toggle('occasion', o)} />)}
      </FilterGroup>
      <FilterGroup title="Fabric">
        {FABRICS.map((f) => <Check key={f} label={f} checked={!!filters.fabric?.includes(f)} onChange={() => toggle('fabric', f)} />)}
      </FilterGroup>
      <FilterGroup title="Size">
        <div className="flex flex-wrap gap-2 pt-1">
          {ALL_SIZES.map((s) => (
            <button key={s} onClick={() => toggle('size', s)} className={cx('chip min-w-[44px] justify-center', filters.size?.includes(s) && 'chip-active')} aria-pressed={filters.size?.includes(s)}>{s}</button>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Colour">
        <div className="grid grid-cols-4 gap-3 pt-1">
          {ALL_COLORS.map((c) => {
            const on = filters.color?.includes(c.name);
            return (
              <button key={c.name} onClick={() => toggle('color', c.name)} className="flex flex-col items-center gap-1 text-[10px] text-ink-600" aria-pressed={on} title={c.name}>
                <span className={cx('grid h-8 w-8 place-items-center rounded-full ring-offset-2 ring-offset-paper', on ? 'ring-2 ring-brand' : 'ring-1 ring-ink/10')} style={{ background: c.hex }}>
                  {on && <Icon name="check" size={14} className={['Ivory', 'Mint', 'Blush', 'Peach', 'Powder Blue', 'Lavender'].includes(c.name) ? 'text-ink' : 'text-white'} />}
                </span>
                <span className="truncate">{c.name}</span>
              </button>
            );
          })}
        </div>
      </FilterGroup>
    </div>
  );

  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Shop', to: singleCat || filters.q ? '/shop' : undefined }, ...(singleCat ? [{ label: singleCat.name }] : [])]} />
      <div className="mt-4 flex flex-col gap-1 border-b border-ink/10 pb-6">
        <Heading as="h1" pre={filters.q ? 'Results for' : singleCat ? 'Shop' : 'Shop all'} title={filters.q ? `“${filters.q}”` : singleCat?.name ?? (filters.occasion?.length === 1 ? `${filters.occasion[0]} suits` : 'Suits')} />
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">{singleCat?.intro ?? 'Handcrafted ladies suits for every mood and moment: Anarkali, straight, sharara, palazzo, Patiala and unstitched suits, delivered across India.'}</p>
        {!filters.q && (
          <nav aria-label="Collections" className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
            {CATEGORIES.map((c) => (
              <Link key={c.slug} to={`/collections/${c.slug}`} className={cx('chip shrink-0', singleCat?.slug === c.slug && 'chip-active')} aria-current={singleCat?.slug === c.slug ? 'page' : undefined}>{c.name}</Link>
            ))}
          </nav>
        )}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 no-scrollbar">
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">Filters</p>
              {active.length > 0 && <button onClick={clearAll} className="text-xs text-brand underline underline-offset-4">Clear all</button>}
            </div>
            {filterPanel}
          </div>
        </aside>

        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <button onClick={() => setFiltersOpen(true)} className="btn-outline px-4 py-2 lg:hidden"><Icon name="filter" size={16} /> Filters {active.length > 0 && `(${active.length})`}</button>
            <p className="text-sm text-ink-600">{loading ? 'Loading…' : `${data?.total ?? 0} ${data?.total === 1 ? 'style' : 'styles'}`}</p>
            <label className="ml-auto flex items-center gap-2 text-sm">
              <span className="hidden text-ink-400 sm:inline">Sort by</span>
              <select value={filters.sort} onChange={(e) => update((p) => p.set('sort', e.target.value))} className="rounded-full border border-ink-200 bg-white py-2 pl-4 pr-8 text-sm focus:border-brand focus:outline-none">
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {active.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {active.map((a) => (
                <button key={a.label} onClick={a.onRemove} className="chip bg-brand-50 border-brand-100">{a.label} <Icon name="close" size={12} /></button>
              ))}
              <button onClick={clearAll} className="text-xs text-ink-600 underline underline-offset-4">Clear all</button>
            </div>
          )}

          {!loading && data?.items.length === 0 ? (
            <EmptyState icon="search" title="No styles found" body="Try removing a filter or searching for something else." action={<button onClick={clearAll} className="btn-primary">Clear filters</button>} />
          ) : (
            <ProductGrid products={data?.items} loading={loading} count={6} />
          )}

          {data && data.totalPages > 1 && (
            <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Pagination">
              <PageBtn disabled={data.page <= 1} onClick={() => update((p) => { p.set('page', String(data.page - 1)); p.set('page-keep', '1'); })} label="Previous page"><Icon name="chevronLeft" size={16} /></PageBtn>
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((n) => (
                <PageBtn key={n} active={n === data.page} onClick={() => update((p) => { p.set('page', String(n)); p.set('page-keep', '1'); })} label={`Page ${n}`}>{n}</PageBtn>
              ))}
              <PageBtn disabled={data.page >= data.totalPages} onClick={() => update((p) => { p.set('page', String(data.page + 1)); p.set('page-keep', '1'); })} label="Next page"><Icon name="chevronRight" size={16} /></PageBtn>
            </nav>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] animate-rise flex-col rounded-t-3xl bg-paper">
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <h2 className="text-2xl">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} className="btn-ghost -mr-3" aria-label="Close filters"><Icon name="close" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-2">{filterPanel}</div>
            <div className="flex gap-3 border-t border-ink/10 p-4">
              <button onClick={clearAll} className="btn-outline flex-1">Clear</button>
              <button onClick={() => setFiltersOpen(false)} className="btn-primary flex-[2]">Show {data?.total ?? ''} results</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-b border-ink/10 py-3">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between py-1 text-sm font-medium" aria-expanded={open}>
        {title} <Icon name="chevronDown" size={16} className={cx('transition', open && 'rotate-180')} />
      </button>
      {open && <div className="mt-2 space-y-1">{children}</div>}
    </div>
  );
}

function Check({ label, checked, onChange, radio }: { label: string; checked: boolean; onChange: () => void; radio?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1 text-sm text-ink-600 hover:text-ink">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span className={cx('grid h-4 w-4 place-items-center border transition peer-focus-visible:ring-2 peer-focus-visible:ring-gold', radio ? 'rounded-full' : 'rounded', checked ? 'border-brand bg-brand text-white' : 'border-ink-200 bg-white')}>
        {checked && <Icon name="check" size={11} strokeWidth={3} />}
      </span>
      {label}
    </label>
  );
}

function PageBtn({ children, active, disabled, onClick, label }: { children: ReactNode; active?: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={() => { onClick(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={disabled} aria-label={label} aria-current={active ? 'page' : undefined}
      className={cx('grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm transition disabled:opacity-30', active ? 'bg-brand text-paper' : 'hover:bg-ink/5')}>
      {children}
    </button>
  );
}
