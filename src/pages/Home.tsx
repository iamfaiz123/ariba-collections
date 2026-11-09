import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';
import { Media } from '@/components/Media';
import { ProductArt } from '@/components/ProductArt';
import { ProductCard, ProductCardSkeleton, ProductGrid } from '@/components/ProductCard';
import { ExploreLink, Heading, SectionHeading } from '@/components/ui';
import { CATEGORIES } from '@/data/categories';
import { MEDIA } from '@/data/media';
import { PRODUCTS } from '@/data/products';
import { useAsync } from '@/hooks/useAsync';
import { getFeatured } from '@/services/api';
import type { Category } from '@/types';
import { inr } from '@/utils/format';

const catArt = (c: Category) => ({
  pattern: c.pattern,
  silhouette: c.slug === 'anarkali' ? ('anarkali' as const) : ['straight', 'patiala', 'unstitched', 'kurtis', 'kurta-sets'].includes(c.slug) ? ('straight' as const) : ('aline' as const),
  bottom: c.slug === 'sharara' ? ('sharara' as const) : c.slug === 'palazzo' ? ('palazzo' as const) : c.slug === 'patiala' ? ('patiala' as const) : ('pant' as const),
});

const STATS = [
  ['2023', 'The year Aribas began, with our own designs instead of what was already on the shelf.'],
  ['1000s', 'Of kurtis sold to women who appreciate thoughtfully made clothing.'],
  ['100%', 'Our own designs. Every pattern is created by us, never copied from the market.'],
  ['In-house', 'Tailoring by our own skilled tailors, with handmade detailing on every piece.'],
];

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'sparkle', title: 'Premium fabrics', body: 'Pure georgette, chanderi and silk sourced from weaving clusters — soft fall, rich colour, built to last.' },
  { icon: 'ruler', title: 'Perfect fit', body: 'A fitted bodice and a 24-kali flare that moves with you. Seam allowance for easy alterations.' },
  { icon: 'heart', title: 'Comfort & style', body: 'Fully lined with breathable cotton so you can dance through the sangeet without a second thought.' },
  { icon: 'shield', title: 'Easy care', body: 'Colour-fast dyes and reinforced zari. Dry clean, store in muslin, and it stays heirloom-new.' },
];

export default function Home() {
  const featured = useAsync(() => getFeatured('new', 4), []);
  const best = useAsync(() => getFeatured('bestseller', 3), []);
  const spotlight = PRODUCTS[0] as (typeof PRODUCTS)[number] | undefined;

  return (
    <>
      {/* 1 — Brand film hero */}
      <HeroFilm />

      {/* 2 — New collection: posters either side of the film */}
      <NewCollection />

      {/* 3 — Featured products (hidden while the shop is empty) */}
      {PRODUCTS.length > 0 && (
      <section className="container-x pt-24">
        <SectionHeading pre="Featured" title="Products" action={<ExploreLink to="/shop?sort=newest">Explore all</ExploreLink>} />
        <ProductGrid products={featured.data} loading={featured.loading} count={4} />
      </section>
      )}

      {/* 4 — Manifesto banner */}
      <section className="container-x pt-24">
        <div className="grid overflow-hidden rounded-[4px] bg-[#FBF1E4] md:grid-cols-[1fr_1.3fr]">
          <Media {...MEDIA.banner} className="min-h-[300px]" fallback={<BannerFallback />} />
          <div className="flex flex-col justify-center p-8 sm:p-12">
            <p className="font-display text-4xl font-bold uppercase leading-[1.05] text-brand sm:text-5xl lg:text-6xl">
              We don’t <span className="text-outline">chase</span> trends
              <br />— we <span className="text-outline">weave</span> traditions.
            </p>
            <p className="mt-5 max-w-md text-sm text-ink-600">Every Aribas piece begins as our own design and is brought to life with handmade detailing by our own skilled tailors.</p>
            <div className="mt-6"><ExploreLink to="/about">Our story</ExploreLink></div>
          </div>
        </div>
      </section>

      {/* 5 — Bestsellers, editorial grid (hidden while the shop is empty) */}
      {PRODUCTS.length > 0 && (
      <section className="container-x pt-24">
        <SectionHeading pre="Our" title="Bestsellers" action={<ExploreLink to="/shop">Explore all</ExploreLink>} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
          {best.loading || !best.data
            ? Array.from({ length: 3 }, (_, i) => <div key={i} className={i === 2 ? 'col-span-2' : ''}><ProductCardSkeleton /></div>)
            : best.data.map((p, i) => (
                <div key={p.id} className={i === 2 ? 'col-span-2' : ''}>
                  <ProductCard product={p} tall={i === 2} />
                </div>
              ))}
        </div>
      </section>
      )}

      {/* 6 — Stats */}
      <section className="container-x pt-24">
        <Heading pre="We are" title="Proud of it" />
        <dl className="mt-12 grid gap-y-10 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-ink/10">
          {STATS.map(([n, t]) => (
            <div key={n} className="lg:px-8 lg:first:pl-0">
              <dt className="font-display text-6xl font-semibold text-ink sm:text-7xl">{n}</dt>
              <dd className="mt-3 max-w-[230px] text-xs leading-relaxed text-ink-600">{t}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 7 — Best product spotlight (hidden while the shop is empty) */}
      {spotlight && (
      <section className="container-x pt-28">
        <div className="text-center">
          <Heading pre="Our best" title="Product" className="justify-center" />
          <p className="mx-auto mt-4 max-w-md text-sm text-ink-600">Where heritage craft meets a modern silhouette — the {spotlight.name}, our most-loved piece this season.</p>
        </div>
        <div className="mt-12 grid items-center gap-6 lg:grid-cols-[1fr_1.1fr_1fr]">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 lg:justify-items-end">
            <FeatureCard {...FEATURES[0]} />
            <FeatureCard {...FEATURES[2]} className="lg:mr-6" />
          </div>
          <Link to={`/product/${spotlight.slug}`} className="group order-first mx-auto block w-full max-w-sm lg:order-none">
            <div className={`aspect-[3/4] drop-shadow-2xl transition duration-700 group-hover:-translate-y-2 ${!MEDIA.spotlight.image && spotlight.images?.length ? 'overflow-hidden rounded-2xl' : ''}`}>
              <Media image={MEDIA.spotlight.image ?? spotlight.images?.[0]} className="h-full w-full" fallback={<ProductArt art={spotlight.art} color={spotlight.colors[0].hex} accent={spotlight.colors[0].accent} bare alt={spotlight.name} />} />
            </div>
            <p className="mt-4 text-center font-display uppercase text-brand">{spotlight.name} · {inr(spotlight.price)}</p>
          </Link>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <FeatureCard {...FEATURES[1]} />
            <FeatureCard {...FEATURES[3]} className="lg:ml-6" />
          </div>
        </div>
        <div className="mt-10 text-center"><ExploreLink to={`/product/${spotlight.slug}`} /></div>
      </section>
      )}

      {/* 8 — Shop by style */}
      <section className="container-x pt-28">
        <SectionHeading pre="Shop by" title="Style" action={<ExploreLink to="/shop">View all</ExploreLink>} />
        <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} to={`/collections/${c.slug}`} className="group w-40 shrink-0 snap-start sm:w-auto">
              <div className="tile aspect-[3/4] overflow-hidden rounded-xl">
                <div className="h-full transition duration-700 group-hover:scale-105"><ProductArt art={catArt(c)} color={c.color} accent={c.accent} alt={c.name} /></div>
              </div>
              <p className="mt-3 font-display uppercase text-brand">{c.name}</p>
              <p className="text-xs text-ink-400">{c.tagline}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function HeroFilm() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);
  // The film is only attached once the page has loaded, so the poster image paints first (faster LCP).
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    type Conn = { saveData?: boolean; effectiveType?: string };
    const conn = (navigator as Navigator & { connection?: Conn }).connection;
    const lowData = !!conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '');
    // Reduced motion, data saver or a 2G connection: keep the still frame; the play button loads the film.
    if (lowData || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPlaying(false);
      return;
    }
    const start = () => setTimeout(() => setSrc(MEDIA.hero.video), 300);
    if (document.readyState === 'complete') { const t = start(); return () => clearTimeout(t); }
    let t: ReturnType<typeof setTimeout> | undefined;
    const onLoad = () => { t = start(); };
    window.addEventListener('load', onLoad, { once: true });
    return () => { window.removeEventListener('load', onLoad); if (t) clearTimeout(t); };
  }, []);

  const togglePlay = () => {
    const v = ref.current;
    if (!v) return;
    if (!src) { setSrc(MEDIA.hero.video); setPlaying(true); return; } // autoPlay starts it once loaded
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };
  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted && v.paused) togglePlay();
  };

  return (
    <section className="relative h-[calc(100svh-6.5rem)] min-h-[560px] overflow-hidden bg-[#E9D9C4]" aria-label="Aribas — the brand film">
      <img src={MEDIA.hero.image} alt="" width={1280} height={720} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
      <video
        ref={ref}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${ready ? 'opacity-100' : 'opacity-0'}`}
        src={src}
        poster={MEDIA.hero.image}
        autoPlay muted loop playsInline preload={src ? 'auto' : 'none'}
        onCanPlay={() => setReady(true)}
        aria-label="Model in a dusty-rose embroidered Aribas suit walking through a sunlit palace hall"
      />
      {/* Fade the film into the page so the wordmark sits on paper */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent via-30% to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-paper via-paper/85 via-45% to-transparent" />

      {/* Top bar over the film */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-5 text-white sm:p-8">
        <p className="font-serif text-lg italic drop-shadow sm:text-xl">The Festive Edit · 2026</p>
        <div className="flex gap-2">
          <button onClick={togglePlay} className="glass grid h-10 w-10 place-items-center rounded-full text-white transition hover:bg-white/40" aria-label={playing ? 'Pause video' : 'Play video'}>
            <Icon name={playing ? 'pause' : 'play'} size={16} filled={!playing} />
          </button>
          <button onClick={toggleSound} className="glass grid h-10 w-10 place-items-center rounded-full text-white transition hover:bg-white/40" aria-label={muted ? 'Turn sound on' : 'Mute'}>
            <Icon name={muted ? 'volumeOff' : 'volume'} size={17} />
          </button>
        </div>
      </div>

      {/* Brand name */}
      <div className="absolute inset-x-0 bottom-0 px-4 pb-6 sm:px-8 sm:pb-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-3 px-1 pb-2 sm:pb-0">
          <p className="max-w-sm text-sm font-medium leading-relaxed text-ink">Kurtis and suits in our own designs, with handmade detailing and quality tailoring, delivered across India.</p>
          <ExploreLink to="/shop">Shop the collection</ExploreLink>
        </div>
        <h1 className="mt-1 flex select-none justify-center font-script normal-case tracking-normal text-[33vw] leading-[1.05] text-brand sm:text-[22vw] xl:text-[300px]">
          <span className="sr-only">Aribas: designer kurtis and suits for women online in India</span>
          <span className="animate-word-in pr-[.12em]" style={{ animationDelay: '300ms' }} aria-hidden>Aribas</span>
        </h1>
      </div>
    </section>
  );
}

function FeatureCard({ icon, title, body, className = '' }: { icon: IconName; title: string; body: string; className?: string }) {
  return (
    <div className={`relative w-full max-w-[290px] rounded-xl bg-ink p-6 pt-8 text-center text-white ${className}`}>
      <span className="absolute -right-px -top-px grid h-12 w-12 place-items-center rounded-bl-[22px] bg-paper text-brand"><Icon name={icon} size={18} /></span>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-[12px] leading-relaxed text-white/75">{body}</p>
    </div>
  );
}

function NewCollection() {
  const { href, tiles } = MEDIA.newCollection;
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return (
    <section className="bg-[#EAE2D6] pb-14 pt-12 sm:pt-16" aria-label="The new collection">
      <div className="container-x flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-brand/80">Now in stock · Handcrafted · Timeless</p>
          <Heading pre="The new" title="Collection is here" className="mt-2" />
        </div>
        <Link to={href} className="btn-primary">Shop the new collection <Icon name="arrowUpRight" size={16} /></Link>
      </div>

      <div className="no-scrollbar mt-8 flex snap-x snap-mandatory items-center gap-4 overflow-x-auto px-4 sm:px-8 lg:mx-auto lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-center lg:gap-8 lg:overflow-visible lg:px-8">
        {tiles.map((t) => (
          <Link key={t.src} to={t.to ?? href} style={{ aspectRatio: `${t.w} / ${t.h}` }} className="group relative block w-[78vw] max-w-[420px] shrink-0 snap-center overflow-hidden rounded-xl bg-[#DCD2C4] shadow-xl shadow-ink/10 sm:w-[46vw] lg:w-auto lg:max-w-none">
            {t.kind === 'video' ? (
              <video src={t.src} poster={t.poster} aria-label={t.alt} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" autoPlay={!reduceMotion} muted loop playsInline preload="metadata" />
            ) : (
              <img src={t.src} alt={t.alt} width={t.w} height={t.h} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

function BannerFallback() {
  return (
    <div className="backdrop-clouds absolute inset-0 flex items-end justify-center">
      <div className="h-[92%] aspect-[3/4]"><ProductArt bare art={{ pattern: 'floral', silhouette: 'aline', bottom: 'sharara' }} color="#C2185B" accent="#F7D9A0" /></div>
    </div>
  );
}
