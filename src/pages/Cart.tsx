import { Link } from 'react-router-dom';
import { CartLine } from '@/components/CartLine';
import { Icon } from '@/components/Icon';
import { CouponBox, TotalsTable } from '@/components/OrderSummary';
import { ProductGrid } from '@/components/ProductCard';
import { EmptyState, Heading, SectionHeading } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getFeatured } from '@/services/api';
import { cartCount, useCart } from '@/store';

export default function Cart() {
  useDocumentTitle('Your bag');
  const items = useCart((s) => s.items);
  const suggestions = useAsync(() => getFeatured('bestseller', 4), []);

  return (
    <div className="container-x py-10">
      <Heading as="h1" pre="Your" title="Bag" />
      {items.length === 0 ? (
        <EmptyState icon="bag" title="Your bag is empty" body="Looks like you haven’t added anything yet." action={<Link to="/shop" className="btn-primary">Continue shopping</Link>} />
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div>
            <p className="mb-4 text-sm text-ink-600">{cartCount(items)} item(s)</p>
            <ul className="divide-y divide-ink/10 border-y border-ink/10">
              {items.map((it) => <li key={it.key} className="py-6"><CartLine item={it} /></li>)}
            </ul>
            <Link to="/shop" className="link mt-6 inline-flex items-center gap-1 text-sm"><Icon name="chevronLeft" size={14} /> Continue shopping</Link>
          </div>
          <aside className="h-fit space-y-5 rounded-xl bg-white p-6 lg:sticky lg:top-24">
            <h2 className="text-2xl text-brand">Order summary</h2>
            <CouponBox />
            <TotalsTable />
            <Link to="/checkout" className="btn-primary w-full"><Icon name="lock" size={16} /> Proceed to checkout</Link>
            <p className="text-center text-xs text-ink-400">Secure checkout · UPI · Cards · Netbanking · COD</p>
          </aside>
        </div>
      )}
      <section className="mt-24">
        <SectionHeading pre="You might" title="Also love" />
        <ProductGrid products={suggestions.data} loading={suggestions.loading} count={4} />
      </section>
    </div>
  );
}
