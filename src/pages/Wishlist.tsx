import { Link } from 'react-router-dom';
import { ProductGrid } from '@/components/ProductCard';
import { EmptyState, Heading } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getProductsByIds } from '@/services/api';
import { useWishlist } from '@/store';

export default function Wishlist() {
  useDocumentTitle('Wishlist');
  const ids = useWishlist((s) => s.ids);
  const { data, loading } = useAsync(() => getProductsByIds(ids), [ids.join(',')]);
  return (
    <div className="container-x py-10">
      <Heading as="h1" pre="Your" title="Wishlist" />
      <p className="mb-10 mt-3 text-sm text-ink-600">{ids.length} saved {ids.length === 1 ? 'style' : 'styles'}</p>
      {ids.length === 0 ? (
        <EmptyState icon="heart" title="Nothing saved yet" body="Tap the heart on any style to save it here for later." action={<Link to="/shop" className="btn-primary">Discover styles</Link>} />
      ) : (
        <ProductGrid products={data} loading={loading && !data} count={ids.length} />
      )}
    </div>
  );
}
