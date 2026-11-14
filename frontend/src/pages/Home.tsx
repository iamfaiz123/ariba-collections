import { ProductGrid } from '@/components/ProductCard';
import { ExploreLink } from '@/components/ui';
import { PRODUCTS } from '@/data/products';
import { useAsync } from '@/hooks/useAsync';
import { getFeatured } from '@/services/api';
import { LIVE } from '@/services/backend';
import { FeelTheDrape, FestiveFan, Hero, InMotion, Marquee, Moods, OnTheRail, PickAStyle, TryTheLook } from './home/sections';

/**
 * Home: a cinematic, scroll-through showcase.
 * Hero film → moods (arches) → try the look → pick a style → on the rail → feel the drape → festive fan → in motion (reels).
 */
export default function Home() {
  const featured = useAsync(() => getFeatured('new', 4), []);
  // Product grid stays hidden while the shop is empty.
  const hasProducts = LIVE ? !!featured.data?.length : PRODUCTS.length > 0;

  return (
    <>
      <Hero />
      <Moods />
      <TryTheLook />
      <PickAStyle />

      {hasProducts && (
        <section className="bg-paper pb-20 sm:pb-28" aria-label="New arrivals">
          <div className="container-x">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <h2 className="display-serif">New <em>arrivals</em>.</h2>
              <ExploreLink to="/shop?sort=newest">Explore all</ExploreLink>
            </div>
            <ProductGrid products={featured.data} loading={featured.loading} count={4} />
          </div>
        </section>
      )}

      <OnTheRail />
      <FeelTheDrape />
      <FestiveFan />
      <InMotion />
      <Marquee className="bg-brand text-white" items={['Our own designs', 'Handmade detailing', 'Since 2023', 'Tailored in-house', 'Delivered across India']} />
    </>
  );
}
