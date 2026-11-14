import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { ProductArt } from '@/components/ProductArt';
import { CATEGORIES, categoryBySlug } from '@/data/categories';
import { MEDIA } from '@/data/media';
import type { Category, CategorySlug } from '@/types';
import { cx } from '@/utils/format';
import { LOOKS, RAIL, type Look } from './looks';

const PRODUCT_PHOTO = '/products/zumrud-embroidered-lawn-suit/1.jpg';
const PRODUCT_VIDEO = '/products/zumrud-embroidered-lawn-suit/video.mp4';

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Adds `is-in` to a `.reveal` element the first time it scrolls into view. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { el.classList.add('is-in'); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/** True once the element has come near the viewport (used to defer video loading). */
function useNearView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setNear(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, near] as const;
}

/** Centered two-tone serif heading used by every showcase: `Try the <em>Look</em>.` */
function ShowHead({ eyebrow, children, sub, align = 'center', dark }: { eyebrow?: string; children: ReactNode; sub?: string; align?: 'center' | 'left'; dark?: boolean }) {
  return (
    <div className={cx('mb-10 sm:mb-14', align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-xl')}>
      {eyebrow && <p className={cx('eyebrow mb-4', dark ? 'text-white/60' : 'text-brand/70')}>{eyebrow}</p>}
      <h2 className={cx('display-serif', dark && 'text-white [&_em]:text-blush-300')}>{children}</h2>
      {sub && <p className={cx('mt-4 text-sm leading-relaxed', dark ? 'text-white/65' : 'text-ink-600')}>{sub}</p>}
    </div>
  );
}

const lookArt = (l: Look, className?: string) => <ProductArt bare art={l.art} color={l.color.hex} accent={l.color.accent} alt={l.name} className={className} />;
const catLook = (c: Category): Look => ({
  name: c.name,
  category: c.slug,
  color: { name: c.name, hex: c.color, accent: c.accent },
  art: {
    pattern: c.pattern,
    silhouette: c.slug === 'anarkali' ? 'anarkali' : c.slug === 'sharara' || c.slug === 'palazzo' ? 'aline' : 'straight',
    bottom: c.slug === 'sharara' ? 'sharara' : c.slug === 'palazzo' ? 'palazzo' : c.slug === 'patiala' ? 'patiala' : 'pant',
  },
});

/* ───────────────────────── 1 · Cinematic hero ───────────────────────── */

const TICKER = ['Kurtis', 'Kurta Sets', 'Anarkali Suits', 'Sharara Sets', 'Handmade detailing', 'Our own designs', 'Tailored in-house', 'Free shipping above ₹1,999', 'Easy 7-day returns'];

export function Marquee({ items = TICKER, className }: { items?: string[]; className?: string }) {
  const row = (hidden?: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden}>
      {items.map((t) => (
        <li key={t} className="flex items-center gap-6 px-6 font-serif text-lg italic sm:text-xl">
          {t} <span className="text-gold-300 not-italic">✦</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className={cx('overflow-hidden py-3', className)}>
      <div className="flex w-max animate-marquee">{row()}{row(true)}</div>
    </div>
  );
}

export function Hero() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);
  // The film is attached after page load, so the poster paints first (faster LCP).
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    type Conn = { saveData?: boolean; effectiveType?: string };
    const conn = (navigator as Navigator & { connection?: Conn }).connection;
    const lowData = !!conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '');
    if (lowData || prefersReducedMotion()) { setPlaying(false); return; }
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
    if (!src) { setSrc(MEDIA.hero.video); setPlaying(true); return; }
    if (v.paused) { void v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };
  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted && v.paused) togglePlay();
  };

  return (
    <section className="relative isolate h-[calc(100svh-6.5rem)] min-h-[600px] overflow-hidden bg-ink text-white" aria-label="Aribas — the brand film">
      <img src={MEDIA.hero.image} alt="" width={1280} height={720} fetchPriority="high" className="absolute inset-0 h-full w-full animate-ken-burns object-cover" />
      <video
        ref={ref}
        className={cx('absolute inset-0 h-full w-full object-cover transition-opacity duration-1000', ready ? 'opacity-100' : 'opacity-0')}
        src={src}
        poster={MEDIA.hero.image}
        autoPlay muted loop playsInline preload={src ? 'auto' : 'none'}
        onCanPlay={() => setReady(true)}
        aria-label="Model in a dusty-rose embroidered Aribas suit walking through a sunlit palace hall"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

      <div className="absolute right-4 top-4 flex gap-2 sm:right-8 sm:top-8">
        <button onClick={togglePlay} className="glass grid h-10 w-10 place-items-center rounded-full text-white transition hover:bg-white/40" aria-label={playing ? 'Pause video' : 'Play video'}>
          <Icon name={playing ? 'pause' : 'play'} size={16} filled={!playing} />
        </button>
        <button onClick={toggleSound} className="glass grid h-10 w-10 place-items-center rounded-full text-white transition hover:bg-white/40" aria-label={muted ? 'Turn sound on' : 'Mute'}>
          <Icon name={muted ? 'volumeOff' : 'volume'} size={17} />
        </button>
      </div>

      <div className="container-x relative flex h-full flex-col justify-end pb-24 sm:pb-28">
        <p className="eyebrow animate-word-in text-white/75" style={{ animationDelay: '150ms' }}>The Festive Edit · 2026</p>
        <h1 className="mt-4 max-w-3xl font-serif text-[clamp(3rem,9vw,7.5rem)] normal-case leading-[.95] tracking-tight">
          <span className="sr-only">Aribas: designer kurtis and suits for women online in India. </span>
          <span className="block animate-word-in" style={{ animationDelay: '300ms' }} aria-hidden>Stitched for the</span>
          <em className="block animate-word-in text-blush-300" style={{ animationDelay: '500ms' }} aria-hidden>celebrations.</em>
        </h1>
        <p className="mt-6 max-w-md animate-word-in text-sm leading-relaxed text-white/80 sm:text-base" style={{ animationDelay: '700ms' }}>
          Kurtis and suits in our own designs, with handmade detailing and in-house tailoring — delivered across India.
        </p>
        <div className="mt-8 flex animate-word-in flex-wrap gap-3" style={{ animationDelay: '850ms' }}>
          <Link to="/shop" className="btn-gold">Shop the collection <Icon name="arrowUpRight" size={16} /></Link>
          <a href="#try-the-look" className="btn glass text-white hover:bg-white/40">Try the look</a>
        </div>
      </div>

      <Marquee className="absolute inset-x-0 bottom-0 border-t border-white/15 bg-brand/85 text-white backdrop-blur-sm" />
    </section>
  );
}

/* ───────────────────────── 2 · Moods (arches) ───────────────────────── */

export function Moods() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="reveal bg-paper py-20 sm:py-28" aria-label="Shop by style">
      <div className="container-x">
        <ShowHead eyebrow="Shop by style" sub="From everyday kurtis to wedding Anarkalis — find the silhouette that feels like you.">
          Eight moods. <em>Timeless</em> silhouettes.
        </ShowHead>
      </div>
      <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:px-8 lg:mx-auto lg:grid lg:max-w-7xl lg:grid-cols-8 lg:overflow-visible lg:px-12">
        {CATEGORIES.map((c, i) => (
          <Link key={c.slug} to={`/collections/${c.slug}`} className="group w-[38vw] max-w-[170px] shrink-0 snap-start text-center lg:w-auto lg:max-w-none" style={{ transitionDelay: `${i * 60}ms` }}>
            <div className="arch relative aspect-[3/5] overflow-hidden shadow-lg shadow-ink/10 transition duration-500 group-hover:-translate-y-2 group-hover:shadow-2xl" style={{ background: `radial-gradient(120% 70% at 50% 15%, ${c.accent}55, transparent 60%), linear-gradient(180deg, ${c.color}CC, ${c.color})` }}>
              <div className="arch pointer-events-none absolute inset-1.5 border border-white/40" />
              <div className="absolute inset-x-[6%] bottom-[2%] top-[14%] transition duration-700 group-hover:scale-105">{lookArt(catLook(c))}</div>
            </div>
            <p className="mt-4 font-serif text-xl leading-tight text-ink transition group-hover:text-brand">{c.name}</p>
            <p className="mt-1 text-[11px] leading-snug text-ink-400">{c.tagline}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── 3 · Try the look ───────────────────────── */

export function TryTheLook() {
  const ref = useReveal<HTMLElement>();
  const [active, setActive] = useState(2);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || prefersReducedMotion()) return;
    const t = setInterval(() => setActive((a) => (a + 1) % LOOKS.length), 3200);
    return () => clearInterval(t);
  }, [auto]);
  const pick = (i: number) => { setAuto(false); setActive(i); };
  const cur = LOOKS[active];

  return (
    <section id="try-the-look" ref={ref} className="reveal scroll-mt-24 overflow-hidden bg-[#F1ECE6] py-20 sm:py-28" aria-label="Try the look">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <ShowHead align="left" eyebrow="Styled by Aribas" sub="Tap a colour or a look to bring it into focus.">Try the <em>Look</em>.</ShowHead>
          <div className="mb-10 flex gap-2.5 sm:mb-14" role="radiogroup" aria-label="Choose a look">
            {LOOKS.map((l, i) => (
              <button
                key={l.name}
                role="radio"
                aria-checked={i === active}
                aria-label={l.name}
                onClick={() => pick(i)}
                className={cx('h-9 w-9 rounded-full border-2 border-white shadow transition', i === active ? 'scale-110 ring-2 ring-brand ring-offset-2 ring-offset-[#F1ECE6]' : 'hover:scale-105')}
                style={{ background: `linear-gradient(135deg, ${l.color.hex} 55%, ${l.color.accent} 55%)` }}
              />
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-x-[10%] bottom-2 h-10 rounded-[50%] bg-ink/10 blur-xl" />
          <div className="relative flex h-[360px] items-end justify-center sm:h-[520px]">
            {LOOKS.map((l, i) => {
              const on = i === active;
              const d = Math.abs(i - active);
              return (
                <button
                  key={l.name}
                  onClick={() => pick(i)}
                  aria-label={`Focus ${l.name}`}
                  className={cx('-mx-[1%] h-full w-[22%] max-w-[260px] sm:-mx-[3%] sm:w-[26%] origin-bottom transition-all duration-700 ease-out', on ? 'z-20 scale-110 opacity-100' : 'z-10 scale-[.86] opacity-60 hover:opacity-90')}
                  style={{ filter: on ? 'none' : `blur(${Math.min(d * 2, 6)}px) saturate(.75)` }}
                >
                  {lookArt(l, 'h-full w-full')}
                </button>
              );
            })}
          </div>
        </div>

        <div key={active} className="mx-auto mt-8 flex max-w-md animate-rise flex-col items-center text-center">
          <p className="eyebrow text-brand/70">{categoryBySlug(cur.category)?.name}</p>
          <p className="mt-2 font-serif text-3xl text-ink">{cur.name}</p>
          <Link to={`/collections/${cur.category}`} className="btn-primary mt-5">Shop this look <Icon name="arrowUpRight" size={16} /></Link>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── 4 · Pick a style (tilted cards) ───────────────────────── */

const TILT = [-6, 4, -3, 5, -5, 3, -4, 6];

export function PickAStyle() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="reveal overflow-hidden bg-paper py-20 sm:py-28" aria-label="Pick a style">
      <div className="container-x">
        <ShowHead align="left" eyebrow="Eight ways to wear Aribas">Pick a <em>Style</em>.</ShowHead>
      </div>
      <div className="no-scrollbar flex snap-x overflow-x-auto px-6 pb-12 pt-6 sm:px-12 [perspective:1200px]">
        {CATEGORIES.map((c, i) => (
          <Link
            key={c.slug}
            to={`/collections/${c.slug}`}
            className="group relative -mr-6 aspect-[3/4.3] w-[56vw] max-w-[260px] shrink-0 transform snap-center overflow-hidden rounded-[22px] p-5 shadow-xl shadow-ink/20 transition duration-500 last:mr-0 hover:z-30 hover:!rotate-0 hover:-translate-y-4 hover:scale-105 sm:w-[260px]"
            style={{ background: `linear-gradient(160deg, ${c.color}, ${c.color}DD 55%, ${c.accent}AA)`, ['--tw-rotate' as string]: `${TILT[i % TILT.length]}deg` }}
          >
            <div className="pointer-events-none absolute inset-2 rounded-[16px] border border-white/30" />
            <p className="relative max-w-[80%] font-display text-[2.6rem] font-bold uppercase leading-[.85] text-white drop-shadow-sm" style={{ textShadow: `3px 3px 0 ${c.accent}66` }}>
              {c.name}
            </p>
            <p className="relative mt-2 max-w-[70%] text-[11px] leading-snug text-white/80">{c.tagline}</p>
            <div className="absolute -right-[8%] bottom-0 h-[64%] w-[78%] transition duration-700 group-hover:scale-110">{lookArt(catLook(c), 'h-full w-full')}</div>
            <span className="absolute bottom-4 left-4 grid h-10 w-10 place-items-center rounded-full bg-white text-ink transition group-hover:bg-ink group-hover:text-white"><Icon name="arrowUpRight" size={16} /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── 5 · On the rail ───────────────────────── */

const RAIL_FILTERS: { label: string; slug?: CategorySlug }[] = [
  { label: 'All' },
  { label: 'Kurtis', slug: 'kurtis' },
  { label: 'Kurta Sets', slug: 'kurta-sets' },
  { label: 'Anarkali', slug: 'anarkali' },
  { label: 'Sharara', slug: 'sharara' },
];

export function OnTheRail() {
  const ref = useReveal<HTMLElement>();
  const [filter, setFilter] = useState<CategorySlug | undefined>();
  const [sel, setSel] = useState<number | null>(null);
  const items = RAIL.filter((l) => !filter || l.category === filter);
  const picked = sel !== null ? items[sel] : undefined;

  return (
    <section ref={ref} className="reveal bg-gradient-to-b from-paper to-[#EFE9E2] py-20 sm:py-28" aria-label="Every piece, on the rail">
      <div className="container-x">
        <ShowHead eyebrow="The studio rail">Every piece, <em>on the rail</em>.</ShowHead>
        <div className="-mt-4 mb-10 flex flex-wrap justify-center gap-2">
          {RAIL_FILTERS.map((f) => (
            <button key={f.label} onClick={() => { setFilter(f.slug); setSel(null); }} className={cx('chip px-4 py-2', filter === f.slug && 'chip-active')}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="no-scrollbar overflow-x-auto px-4 sm:px-8">
        <div className="relative mx-auto w-max min-w-full pt-3">
          {/* the rail */}
          <div className="absolute inset-x-0 top-3 h-2 rounded-full bg-gradient-to-b from-[#C9B79C] via-[#8E7A5E] to-[#5E4F3B] shadow-md" />
          <div className="absolute left-0 top-0 h-8 w-3 rounded-full bg-[#5E4F3B]" />
          <div className="absolute right-0 top-0 h-8 w-3 rounded-full bg-[#5E4F3B]" />
          <div className="flex justify-center gap-1 px-6 sm:gap-2">
            {items.map((l, i) => {
              const on = sel === i;
              return (
                <button
                  key={l.name}
                  onClick={() => setSel(on ? null : i)}
                  aria-pressed={on}
                  aria-label={l.name}
                  className={cx(
                    'group -mt-[6px] aspect-[3/4] w-[120px] shrink-0 origin-top transition-all duration-500 sm:w-[150px]',
                    on ? 'z-10 translate-y-4 scale-[1.18]' : 'hover:animate-sway',
                    sel !== null && !on && 'opacity-50 blur-[2px]',
                  )}
                >
                  {lookArt(l, 'h-full w-full drop-shadow-xl')}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container-x mt-10 min-h-[140px]">
        {picked ? (
          <div key={picked.name} className="mx-auto flex max-w-lg animate-rise items-center gap-5 rounded-2xl bg-white p-5 shadow-lg shadow-ink/5">
            <span className="h-14 w-14 shrink-0 rounded-full border-4 border-white shadow" style={{ background: `linear-gradient(135deg, ${picked.color.hex} 55%, ${picked.color.accent} 55%)` }} />
            <div className="min-w-0 flex-1">
              <p className="font-serif text-2xl leading-tight">{picked.name}</p>
              <p className="text-xs text-ink-400">{picked.color.name} · {categoryBySlug(picked.category)?.name}</p>
            </div>
            <Link to={`/collections/${picked.category}`} className="btn-primary shrink-0 px-5">Shop</Link>
          </div>
        ) : (
          <p className="text-center text-sm text-ink-400">Tap a piece on the rail to take a closer look.</p>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── 6 · Feel the drape (collage) ───────────────────────── */

export function FeelTheDrape() {
  const ref = useReveal<HTMLElement>();
  const [vidRef, near] = useNearView<HTMLDivElement>();
  const motion = !prefersReducedMotion();
  const tile = (src: string, alt: string, cls: string) => (
    <div className={cx('overflow-hidden rounded-2xl shadow-xl shadow-ink/15 transition duration-700 hover:rotate-0 hover:scale-[1.03]', cls)}>
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
    </div>
  );
  return (
    <section ref={ref} className="reveal overflow-hidden bg-paper py-20 sm:py-28" aria-label="Feel the drape">
      <div className="container-x">
        <ShowHead eyebrow="Fabric that moves with you" sub="Soft lawn, georgette and chanderi with handmade embroidery — made to be lived in.">
          Feel the <em>drape</em>.
        </ShowHead>
        <div className="grid grid-cols-2 items-center gap-4 lg:grid-cols-[1fr_2.2fr_1fr] lg:gap-6">
          <div className="grid gap-4 lg:gap-6">
            {tile(MEDIA.newCollection.tiles[0].src, MEDIA.newCollection.tiles[0].alt, 'aspect-[4/5] -rotate-2')}
            {tile(MEDIA.newCollection.tiles[1].src, MEDIA.newCollection.tiles[1].alt, 'hidden aspect-[4/5] rotate-1 lg:block')}
          </div>
          <div ref={vidRef} className="order-first col-span-2 lg:order-none lg:col-span-1">
            <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-ink shadow-2xl shadow-ink/25">
              <video
                className="absolute inset-0 h-full w-full object-cover"
                src={near && motion ? MEDIA.hero.video : undefined}
                poster={MEDIA.hero.image}
                autoPlay muted loop playsInline preload="none"
                aria-label="An Aribas suit in motion"
              />
              <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/50 to-transparent p-6">
                <Link to="/shop?sort=newest" className="btn-gold">Shop the new collection <Icon name="arrowUpRight" size={16} /></Link>
              </div>
            </div>
          </div>
          <div className="grid gap-4 lg:gap-6">
            {tile(PRODUCT_PHOTO, 'Bottle-green embroidered Aribas lawn suit with tasselled dupatta', 'aspect-[4/5] rotate-2')}
            {tile(MEDIA.story.image ?? PRODUCT_PHOTO, MEDIA.story.alt ?? '', 'hidden aspect-[4/5] -rotate-1 lg:block')}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── 7 · Festive collection (fan of arches) ───────────────────────── */

type FanCard = { src?: string; look?: Look; alt: string };
const FAN: FanCard[] = [
  { look: LOOKS[3], alt: LOOKS[3].name },
  { src: MEDIA.newCollection.tiles[1].src, alt: MEDIA.newCollection.tiles[1].alt },
  { look: LOOKS[0], alt: LOOKS[0].name },
  { src: PRODUCT_PHOTO, alt: 'Bottle-green embroidered Aribas lawn suit' },
  { look: LOOKS[2], alt: LOOKS[2].name },
  { src: MEDIA.newCollection.tiles[0].src, alt: MEDIA.newCollection.tiles[0].alt },
  { look: LOOKS[4], alt: LOOKS[4].name },
];

export function FestiveFan() {
  const ref = useReveal<HTMLElement>();
  const mid = (FAN.length - 1) / 2;
  return (
    <section ref={ref} className="reveal overflow-hidden bg-gradient-to-b from-[#F7E9EC] to-paper py-20 sm:py-28" aria-label="The festive collection">
      <div className="container-x">
        <ShowHead eyebrow="Weddings · Mehendi · Sangeet">The Festive <em>Collection</em>.</ShowHead>
      </div>
      <div className="relative mx-auto h-[300px] max-w-5xl sm:h-[440px]">
        {FAN.map((f, i) => {
          const k = i - mid;
          return (
            <div
              key={i}
              className="group absolute bottom-0 left-1/2 w-[30%] max-w-[230px] transition-transform duration-700 hover:z-30"
              style={{ transform: `translateX(-50%) rotate(${k * 9}deg)`, transformOrigin: '50% 220%', zIndex: 10 - Math.abs(Math.round(k)) }}
            >
              <div className="arch aspect-[3/4.4] overflow-hidden border-4 border-white bg-white shadow-xl shadow-ink/20 transition duration-500 group-hover:-translate-y-6">
                {f.src ? (
                  <img src={f.src} alt={f.alt} loading="lazy" className="h-full w-full object-cover" />
                ) : f.look ? (
                  <div className="h-full w-full p-3" style={{ background: `linear-gradient(180deg, ${f.look.color.accent}, ${f.look.color.hex}55)` }}>{lookArt(f.look, 'h-full w-full')}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="container-x mt-28 text-center sm:mt-36">
        <p className="mx-auto max-w-md text-sm text-ink-600">Zari, gota and thread embroidery on Anarkalis and sharara sets, finished by hand for the days you’ll remember.</p>
        <Link to="/shop?occasion=Wedding" className="btn-primary mt-6">Shop festive & wedding <Icon name="arrowUpRight" size={16} /></Link>
      </div>
    </section>
  );
}

/* ───────────────────────── 8 · In motion (reels + viewer) ───────────────────────── */

type Reel = { title: string; sub: string; to: string; video?: string; poster: string };
const REELS: Reel[] = [
  { title: 'Zumrud Lawn Suit', sub: 'Bottle green · Thread embroidery', to: '/shop', video: PRODUCT_VIDEO, poster: PRODUCT_PHOTO },
  { title: 'The Festive Edit', sub: 'Dusty rose · Palace walk', to: '/shop?sort=newest', video: MEDIA.hero.video, poster: MEDIA.hero.image },
  { title: 'Effortless Elegance', sub: 'For the woman who leads', to: '/collections/straight', poster: MEDIA.newCollection.tiles[1].src },
  { title: 'Sofa Stories', sub: 'Tasselled dupatta, all smiles', to: '/collections/kurta-sets', poster: MEDIA.newCollection.tiles[0].src },
  { title: 'Where It Began', sub: 'The Aribas story', to: '/about', poster: MEDIA.story.image ?? PRODUCT_PHOTO },
];

function ReelMedia({ reel, play, className }: { reel: Reel; play: boolean; className?: string }) {
  const v = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = v.current;
    if (!el) return;
    if (play) void el.play().catch(() => {}); else el.pause();
  }, [play]);
  return reel.video ? (
    <video ref={v} src={reel.video} poster={reel.poster} muted loop playsInline preload="none" className={cx('h-full w-full object-cover', className)} aria-label={reel.title} />
  ) : (
    <img src={reel.poster} alt={reel.title} loading="lazy" className={cx('h-full w-full object-cover', play && 'scale-105', 'transition duration-[3s]', className)} />
  );
}

export function InMotion() {
  const ref = useReveal<HTMLElement>();
  const [open, setOpen] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <section ref={ref} className="reveal overflow-hidden bg-ink py-20 text-white sm:py-28" aria-label="Aribas in motion">
      <div className="container-x">
        <ShowHead dark eyebrow="Watch the collection" sub="Tap a reel to watch it full screen.">Aribas, <em>in motion</em>.</ShowHead>
      </div>
      <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:justify-center sm:px-8">
        {REELS.map((r, i) => (
          <button
            key={r.title}
            onClick={() => setOpen(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="group relative aspect-[9/16] w-[46vw] max-w-[220px] shrink-0 snap-center overflow-hidden rounded-2xl bg-white/5 text-left ring-1 ring-white/10 transition duration-500 hover:-translate-y-2 hover:ring-white/40"
          >
            <ReelMedia reel={r} play={hover === i} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            {r.video && <span className="glass absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full"><Icon name="play" size={12} filled /></span>}
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="font-serif text-xl leading-tight">{r.title}</p>
              <p className="mt-1 text-[11px] text-white/70">{r.sub}</p>
            </div>
          </button>
        ))}
      </div>
      {open !== null && <ReelViewer index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  );
}

function ReelViewer({ index, onIndex, onClose }: { index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const n = REELS.length;
  const go = useCallback((d: number) => onIndex((index + d + n) % n), [index, n, onIndex]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [go, onClose]);

  const cur = REELS[index];
  const side = (d: number) => REELS[(index + d + n) % n];
  return (
    <div className="fixed inset-0 z-[90] flex animate-fade-in items-center justify-center overflow-hidden bg-black" role="dialog" aria-modal="true" aria-label={`${cur.title} reel`}>
      <img src={cur.poster} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900/60 via-black/40 to-black/70" />

      <button onClick={onClose} className="glass absolute right-4 top-4 z-20 grid h-11 w-11 place-items-center rounded-full text-white" aria-label="Close"><Icon name="close" size={20} /></button>

      <div className="relative z-10 flex items-center gap-4 sm:gap-8">
        <button onClick={() => go(-1)} className="hidden aspect-[9/16] h-[42vh] overflow-hidden rounded-2xl opacity-60 blur-[1px] transition hover:opacity-90 md:block" aria-label={`Previous: ${side(-1).title}`}>
          <img src={side(-1).poster} alt="" className="h-full w-full object-cover" />
        </button>
        <div key={index} className="relative aspect-[9/16] h-[78vh] max-h-[760px] max-w-[92vw] animate-rise overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/20">
          {cur.video ? (
            <video src={cur.video} poster={cur.poster} autoPlay muted loop playsInline controls={false} className="h-full w-full object-cover" aria-label={cur.title} />
          ) : (
            <img src={cur.poster} alt={cur.title} className="h-full w-full animate-ken-burns object-cover" />
          )}
          <div className="absolute inset-x-0 top-0 flex gap-1 p-3">
            {REELS.map((_, i) => <span key={i} className={cx('h-0.5 flex-1 rounded-full', i <= index ? 'bg-white' : 'bg-white/30')} />)}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5 pt-20 text-white">
            <p className="font-serif text-3xl leading-tight">{cur.title}</p>
            <p className="mt-1 text-xs text-white/70">{cur.sub}</p>
            <Link to={cur.to} onClick={onClose} className="btn-gold mt-4 px-5 py-2.5">Shop now <Icon name="arrowUpRight" size={15} /></Link>
          </div>
          <button onClick={() => go(-1)} className="absolute inset-y-0 left-0 w-1/4 md:hidden" aria-label="Previous reel" />
          <button onClick={() => go(1)} className="absolute right-0 top-0 h-[70%] w-1/4 md:hidden" aria-label="Next reel" />
        </div>
        <button onClick={() => go(1)} className="hidden aspect-[9/16] h-[42vh] overflow-hidden rounded-2xl opacity-60 blur-[1px] transition hover:opacity-90 md:block" aria-label={`Next: ${side(1).title}`}>
          <img src={side(1).poster} alt="" className="h-full w-full object-cover" />
        </button>
      </div>

      <button onClick={() => go(-1)} className="glass absolute left-4 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full text-white md:grid" aria-label="Previous reel"><Icon name="chevronLeft" size={22} /></button>
      <button onClick={() => go(1)} className="glass absolute right-4 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full text-white md:grid" aria-label="Next reel"><Icon name="chevronRight" size={22} /></button>
    </div>
  );
}
