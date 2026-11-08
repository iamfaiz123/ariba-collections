import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';
import { Media } from '@/components/Media';
import { ProductArt } from '@/components/ProductArt';
import { ProductCard, ProductCardSkeleton, ProductGrid } from '@/components/ProductCard';
import { ExploreLink, Heading, SectionHeading } from '@/components/ui';
import { CATEGORIES } from '@/data/categories';
import { TESTIMONIALS } from '@/data/content';
import { MEDIA } from '@/data/media';
import { PRODUCTS } from '@/data/products';
import { useAsync } from '@/hooks/useAsync';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getFeatured } from '@/services/api';
import type { Category } from '@/types';
import { inr } from '@/utils/format';

const catArt = (c: Category) => ({
  pattern: c.pattern,
  silhouette: c.slug === 'anarkali' ? ('anarkali' as const) : c.slug === 'straight' || c.slug === 'patiala' || c.slug === 'unstitched' ? ('straight' as const) : ('aline' as const),
  bottom: c.slug === 'sharara' ? ('sharara' as const) : c.slug === 'palazzo' ? ('palazzo' as const) : c.slug === 'patiala' ? ('patiala' as const) : ('pant' as const),
});

const STATS = [
  ['12+', 'Years of crafting suits with artisans in Lucknow and Jaipur. We don’t copy trends — we keep traditions alive.'],
  ['50K', 'Women across India trust Ariba for quality fabric and a fit that feels made for them.'],
  ['2L+', 'Suits delivered to doorsteps, every piece hand-checked before it leaves our studio.'],
  ['68%', 'Of our customers come back for another — the truest proof of our craft and care.'],
];

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'sparkle', title: 'Premium fabrics', body: 'Pure georgette, chanderi and silk sourced from weaving clusters — soft fall, rich colour, built to last.' },
  { icon: 'ruler', title: 'Perfect fit', body: 'A fitted bodice and a 24-kali flare that moves with you. Seam allowance for easy alterations.' },
  { icon: 'heart', title: 'Comfort & style', body: 'Fully lined with breathable cotton so you can dance through the sangeet without a second thought.' },
  { icon: 'shield', title: 'Easy care', body: 'Colour-fast dyes and reinforced zari. Dry clean, store in muslin, and it stays heirloom-new.' },
];

export default function Home() {
  useDocumentTitle('');
  const featured = useAsync(() => getFeatured('new', 4), []);
  const best = useAsync(() => getFeatured('bestseller', 3), []);
  const spotlight = PRODUCTS[0];

  return (
    <>
      {/* 1 — Brand film hero */}
      <HeroFilm />

      {/* 2 — Campaign hero */}
      <section className="px-0 sm:px-6">
        <Media {...MEDIA.heroTitle} className="h-[80vh] min-h-[540px] sm:rounded-[4px]"
          fallback={<CampaignFallback />}>
          <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/5 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          <div className="relative flex h-full flex-col justify-between p-6 sm:p-10">
            <div>
              <h2 className="font-display text-[13vw] font-bold leading-[.85] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.25)] sm:text-[7vw] xl:text-[100px]">The festive<br />edit is here</h2>
              <p className="mt-5 max-w-[17rem] text-sm leading-relaxed text-white drop-shadow">Anarkalis, shararas and everyday suits, hand-embroidered by 320 artisans — made to be photographed, remembered and passed down.</p>
              <Link to="/shop?occasion=Festive" className="btn-gold mt-6">Shop festive <Icon name="arrowUpRight" size={16} /></Link>
            </div>
            <TestimonialCard />
          </div>
        </Media>
      </section>

      {/* 3 — Featured products */}
      <section className="container-x pt-24">
        <SectionHeading pre="Featured" title="Products" action={<ExploreLink to="/shop?sort=newest">Explore all</ExploreLink>} />
        <ProductGrid products={featured.data} loading={featured.loading} count={4} />
      </section>

      {/* 4 — Manifesto banner */}
      <section className="container-x pt-24">
        <div className="grid overflow-hidden rounded-[4px] bg-[#FBF1E4] md:grid-cols-[1fr_1.3fr]">
          <Media {...MEDIA.banner} className="min-h-[300px]" fallback={<BannerFallback />} />
          <div className="flex flex-col justify-center p-8 sm:p-12">
            <p className="font-display text-4xl font-bold uppercase leading-[1.05] text-brand sm:text-5xl lg:text-6xl">
              We don’t <span className="text-outline">chase</span> trends
              <br />— we <span className="text-outline">weave</span> traditions.
            </p>
            <p className="mt-5 max-w-md text-sm text-ink-600">Every Ariba suit begins as hand-drawn motifs and ends in the hands of a karigar whose family has embroidered for generations.</p>
            <div className="mt-6"><ExploreLink to="/about">Our story</ExploreLink></div>
          </div>
        </div>
      </section>

      {/* 5 — Bestsellers, editorial grid */}
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

      {/* 7 — Best product spotlight */}
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
            <div className="aspect-[3/4] drop-shadow-2xl transition duration-700 group-hover:-translate-y-2">
              <Media image={MEDIA.spotlight.image} className="h-full w-full" fallback={<ProductArt art={spotlight.art} color={spotlight.colors[0].hex} accent={spotlight.colors[0].accent} bare alt={spotlight.name} />} />
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

      {/* 8 — Shop by style */}
      <section className="container-x pt-28">
        <SectionHeading pre="Shop by" title="Style" action={<ExploreLink to="/shop">View all</ExploreLink>} />
        <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} to={`/shop?category=${c.slug}`} className="group w-40 shrink-0 snap-start sm:w-auto">
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

  // Respect reduced-motion: show the poster frame and let the visitor choose to play.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ref.current?.pause();
      setPlaying(false);
    }
  }, []);

  const togglePlay = () => {
    const v = ref.current;
    if (!v) return;
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
    <section className="relative h-[calc(100svh-6.5rem)] min-h-[560px] overflow-hidden bg-[#E9D9C4]" aria-label="Ariba — the brand film">
      <img src={MEDIA.hero.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <video
        ref={ref}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${ready ? 'opacity-100' : 'opacity-0'}`}
        src={MEDIA.hero.video}
        poster={MEDIA.hero.image}
        autoPlay muted loop playsInline preload="auto"
        onCanPlay={() => setReady(true)}
        aria-label="Model in a dusty-rose embroidered Ariba suit walking through a sunlit palace hall"
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
          <p className="max-w-xs text-sm font-medium leading-relaxed text-ink">Handcrafted ladies suits, embroidered by artisans in Lucknow &amp; Jaipur.</p>
          <ExploreLink to="/shop">Shop the collection</ExploreLink>
        </div>
        <h1 className="mt-3 flex select-none justify-center font-display text-[30vw] font-bold leading-[.9] tracking-tight text-brand sm:text-[19vw] xl:text-[250px]" aria-label="Ariba">
          {'ARIBA'.split('').map((ch, i) => (
            <span key={i} className="animate-word-in" style={{ animationDelay: `${300 + i * 110}ms` }} aria-hidden>{ch}</span>
          ))}
        </h1>
        <p className="mt-1 text-center font-serif text-lg italic text-brand sm:text-2xl">collections</p>
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

function TestimonialCard() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(t);
  }, []);
  const t = TESTIMONIALS[i];
  return (
    <div className="glass ml-auto w-full max-w-xs rounded-xl p-5 text-white">
      <p className="text-[10px] uppercase tracking-[.3em] text-white/80">Satisfied customers</p>
      <p key={i} className="mt-3 animate-fade-in text-sm leading-relaxed">“{t.text}”</p>
      <p className="mt-3 text-xs text-white/80">— {t.name}, {t.city}</p>
      <div className="mt-4 flex gap-1.5">
        {TESTIMONIALS.map((_, k) => (
          <button key={k} onClick={() => setI(k)} aria-label={`Show testimonial ${k + 1}`} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />
        ))}
      </div>
    </div>
  );
}

function CampaignFallback() {
  return (
    <div className="scene-fallback absolute inset-0">
      <div className="absolute left-[30%] top-[10%] h-[60%] w-[50%] animate-drift rounded-full bg-blush-200 blur-3xl" />
      <div className="absolute bottom-0 left-1/2 flex h-[85%] -translate-x-1/2 items-end gap-2 sm:gap-6">
        {[['#7A1F3D', '#D9B677', 'paisley', 'anarkali'], ['#F2B48F', '#8C3F2A', 'floral', 'aline'], ['#1F6B4A', '#E8C77A', 'booti', 'straight']].map(([c, a, p, s], k) => (
          <div key={c} className={`aspect-[3/4] ${k === 1 ? 'h-full' : 'h-[82%]'}`}>
            <ProductArt bare art={{ pattern: p as 'floral', silhouette: s as 'aline', bottom: k === 1 ? 'sharara' : 'pant' }} color={c} accent={a} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BannerFallback() {
  return (
    <div className="backdrop-clouds absolute inset-0 flex items-end justify-center">
      <div className="h-[92%] aspect-[3/4]"><ProductArt bare art={{ pattern: 'floral', silhouette: 'aline', bottom: 'sharara' }} color="#C2185B" accent="#F7D9A0" /></div>
    </div>
  );
}
