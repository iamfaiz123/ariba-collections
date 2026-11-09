/**
 * SEO for every route, in one place.
 *
 * Pure data: no React, no DOM. It is used in two places:
 *  - in the browser, by <Seo /> (src/seo/Seo.tsx), which keeps <head> in sync on navigation;
 *  - at build time, by scripts/prerender.mjs, which writes a static HTML file per route
 *    so crawlers and link previews (WhatsApp, Instagram, Facebook, X) see the right tags
 *    without running JavaScript.
 */
import { CATEGORIES, categoryBySlug } from '@/data/categories';
import { FAQS, SHIPPING, SOCIAL } from '@/data/content';
import { PRODUCTS } from '@/data/products';
import type { Category, Product } from '@/types';

export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || 'https://ariba-collections.onrender.com').replace(/\/$/, '');
export const BRAND = 'Aribas';
export const DEFAULT_IMAGE = '/og-image.jpg';
export const DEFAULT_DESCRIPTION =
  'Shop designer kurtis, kurta sets and suits for women online in India, in our own designs with handmade detailing and quality tailoring. Free shipping above ₹1,999, COD and easy 7-day returns.';

export type JsonLd = Record<string, unknown>;

export interface Seo {
  title: string;
  description: string;
  /** Path only (no origin), or null for pages that should not be indexed. */
  canonical: string | null;
  image: string;
  imageAlt: string;
  type: 'website' | 'product' | 'article';
  noindex: boolean;
  jsonLd: JsonLd[];
  /** Extra Open Graph product tags. */
  price?: { amount: number; currency: 'INR'; availability: 'instock' | 'oos' };
}

/** A product with real photography. Placeholder (drawn) products are kept out of search. */
export const isRealProduct = (p: Product) => !!p.images?.length;

export const abs = (path: string) => (/^https?:/.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`);
const clip = (s: string, n = 158) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…`);
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const singular = (c?: Category) => (c ? c.name.replace(/ Suits$/, ' Suit').replace(/ Sets$/, ' Set').replace(/^Kurtis$/, 'Kurti') : 'Kurti');

/* ---------- JSON-LD building blocks ---------- */

const organization: JsonLd = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: BRAND,
  alternateName: ['Ariba', 'Ariba Collections'],
  url: `${SITE_URL}/`,
  logo: abs('/icon-512.png'),
  description: DEFAULT_DESCRIPTION,
  areaServed: { '@type': 'Country', name: 'India' },
  // Filled from SOCIAL in src/data/content.ts.
  sameAs: Object.values(SOCIAL).filter(Boolean),
};

const website: JsonLd = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: BRAND,
  inLanguage: 'en-IN',
  publisher: { '@id': `${SITE_URL}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/shop?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

const breadcrumbs = (items: [string, string][]): JsonLd => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
});

const shippingDetails = (price: number): JsonLd => ({
  '@type': 'OfferShippingDetails',
  shippingRate: { '@type': 'MonetaryAmount', value: price >= SHIPPING.freeAbove ? 0 : SHIPPING.standardFee, currency: 'INR' },
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
    transitTime: { '@type': 'QuantitativeValue', minValue: 4, maxValue: 7, unitCode: 'DAY' },
  },
});

const returnPolicy = (p: Product): JsonLd =>
  p.category === 'unstitched'
    ? { '@type': 'MerchantReturnPolicy', applicableCountry: 'IN', returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted' }
    : {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      };

/**
 * Product structured data. Ratings and reviews are deliberately left out: the reviews on the
 * site are demo data, and marking up reviews that aren't real breaks Google's rules and can
 * get the whole site penalised. Add `aggregateRating` back when real reviews come from the backend.
 */
const productLd = (p: Product, url: string): JsonLd => ({
  '@type': 'Product',
  '@id': `${url}#product`,
  name: p.name,
  description: p.description,
  sku: p.id.toUpperCase(),
  url,
  image: (p.images ?? []).map(abs),
  brand: { '@type': 'Brand', name: BRAND },
  category: `Apparel & Accessories > Clothing > Traditional & Ceremonial Clothing > ${categoryBySlug(p.category)?.name ?? 'Suits'}`,
  material: p.fabric,
  color: p.colors.map((c) => c.name).join(', '),
  audience: { '@type': 'PeopleAudience', suggestedGender: 'female', suggestedMinAge: 13 },
  ...(p.video ? { subjectOf: { '@type': 'VideoObject', name: `${p.name}, video`, description: p.description, contentUrl: abs(p.video), thumbnailUrl: (p.images ?? []).map(abs), uploadDate: `${p.createdAt}T00:00:00+05:30` } } : {}),
  offers: {
    '@type': 'Offer',
    url,
    priceCurrency: 'INR',
    price: p.price,
    priceValidUntil: `${new Date().getFullYear() + 1}-03-31`,
    itemCondition: 'https://schema.org/NewCondition',
    availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    seller: { '@id': `${SITE_URL}/#organization` },
    shippingDetails: shippingDetails(p.price),
    hasMerchantReturnPolicy: returnPolicy(p),
  },
});

const graph = (...nodes: JsonLd[]): JsonLd[] => [{ '@context': 'https://schema.org', '@graph': nodes }];

/* ---------- Per-route SEO ---------- */

const PRIVATE: Record<string, string> = {
  '/cart': 'Your Bag',
  '/checkout': 'Checkout',
  '/wishlist': 'Your Wishlist',
  '/account': 'My Account',
};

const base = (over: Partial<Seo> & Pick<Seo, 'title'>): Seo => ({
  description: DEFAULT_DESCRIPTION,
  canonical: null,
  image: DEFAULT_IMAGE,
  imageAlt: 'Aribas: designer kurtis and suits for women',
  type: 'website',
  noindex: false,
  jsonLd: [],
  ...over,
});

export function getSeo(pathname: string, search = ''): Seo {
  const path = pathname.replace(/\/+$/, '') || '/';
  const q = new URLSearchParams(search);

  if (path === '/') {
    return base({
      title: `${BRAND} | Designer Kurtis & Suits for Women Online in India`,
      canonical: '/',
      jsonLd: graph(organization, website),
    });
  }

  if (path === '/shop') {
    const term = q.get('q');
    const cats = q.getAll('category');
    // Search results and multi-filter combinations are not landing pages: keep them out of the index.
    const filtered = !!term || [...q.keys()].some((k) => k !== 'page' && k !== 'sort');
    return base({
      title: term ? `Search: ${term} | ${BRAND}` : `Shop Kurtis & Suits for Women Online in India | ${BRAND}`,
      description: 'Browse Aribas kurtis, kurta sets and suits for women: Anarkali, straight, sharara, palazzo and Patiala styles in our own designs. Filter by fabric, occasion, size, colour and price. Delivery across India.',
      canonical: filtered ? (cats.length === 1 ? `/collections/${cats[0]}` : null) : '/shop',
      noindex: filtered,
      jsonLd: graph(breadcrumbs([['Home', '/'], ['Shop', '/shop']])),
    });
  }

  const col = path.match(/^\/collections\/([^/]+)$/);
  if (col) {
    const c = categoryBySlug(col[1]);
    if (!c) return notFound();
    const filtered = [...q.keys()].some((k) => k !== 'sort');
    const items = PRODUCTS.filter((p) => p.category === c.slug && isRealProduct(p));
    return base({
      title: `${c.name} for Women: Buy Online in India | ${BRAND}`,
      description: clip(c.intro),
      canonical: `/collections/${c.slug}`,
      // An empty collection is a thin page: keep it out of Google until it has real products.
      noindex: filtered || items.length === 0,
      image: items[0]?.images?.[0] ?? DEFAULT_IMAGE,
      imageAlt: c.name,
      jsonLd: graph(
        breadcrumbs([['Home', '/'], ['Shop', '/shop'], [c.name, `/collections/${c.slug}`]]),
        {
          '@type': 'CollectionPage',
          name: c.name,
          description: c.intro,
          url: abs(`/collections/${c.slug}`),
          isPartOf: { '@id': `${SITE_URL}/#website` },
          ...(items.length
            ? { mainEntity: { '@type': 'ItemList', itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`/product/${p.slug}`) })) } }
            : {}),
        },
      ),
    });
  }

  const prod = path.match(/^\/product\/([^/]+)$/);
  if (prod) {
    const p = PRODUCTS.find((x) => x.slug === prod[1]);
    if (!p) return notFound();
    const c = categoryBySlug(p.category);
    const url = abs(`/product/${p.slug}`);
    const off = p.mrp > p.price ? ` (${Math.round((1 - p.price / p.mrp) * 100)}% off)` : '';
    return base({
      title: `${p.name}: ${p.colors[0].name} ${singular(c)} for Women | ${BRAND}`,
      description: clip(`Buy ${p.name} online in India at ${rupees(p.price)}${off}. ${p.price >= SHIPPING.freeAbove ? 'Free shipping' : 'Fast delivery'}, COD & easy returns. ${p.description}`),
      canonical: `/product/${p.slug}`,
      // Drawn placeholder products are demo stock: keep them out of Google until they have real photos.
      noindex: !isRealProduct(p),
      image: p.images?.[0] ?? DEFAULT_IMAGE,
      imageAlt: `${p.name} in ${p.colors[0].name}`,
      type: 'product',
      price: { amount: p.price, currency: 'INR', availability: p.stock > 0 ? 'instock' : 'oos' },
      jsonLd: graph(
        breadcrumbs([['Home', '/'], ['Shop', '/shop'], ...(c ? [[c.name, `/collections/${c.slug}`] as [string, string]] : []), [p.name, `/product/${p.slug}`]]),
        ...(isRealProduct(p) ? [productLd(p, url)] : []),
      ),
    });
  }

  if (path === '/about') {
    return base({
      title: `Our Story: Thoughtfully Designed Kurtis Since 2023 | ${BRAND}`,
      description: 'Aribas began in 2023 to bring women kurtis with our own designs, handmade detailing and quality tailoring by our own skilled tailors. Thousands of kurtis sold, and growing.',
      canonical: '/about',
      type: 'article',
      jsonLd: graph(breadcrumbs([['Home', '/'], ['Our Story', '/about']]), { '@type': 'AboutPage', url: abs('/about'), about: { '@id': `${SITE_URL}/#organization` } }),
    });
  }

  if (path === '/contact') {
    return base({
      title: `Contact Us | ${BRAND}`,
      description: 'Questions about sizing, orders, delivery or returns? Contact the Aribas team: we reply within one working day.',
      canonical: '/contact',
      jsonLd: graph(breadcrumbs([['Home', '/'], ['Contact', '/contact']]), { '@type': 'ContactPage', url: abs('/contact') }),
    });
  }

  if (path === '/faq') {
    return base({
      title: `FAQs: Shipping, Returns, Sizing & COD | ${BRAND}`,
      description: `Answers on delivery times across India, free shipping above ${rupees(SHIPPING.freeAbove)}, cash on delivery, 7-day returns, sizing and fabric care for Aribas suits.`,
      canonical: '/faq',
      jsonLd: graph(breadcrumbs([['Home', '/'], ['FAQs', '/faq']]), {
        '@type': 'FAQPage',
        mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }),
    });
  }

  if (PRIVATE[path]) return base({ title: `${PRIVATE[path]} | ${BRAND}`, noindex: true });
  if (/^\/order\//.test(path)) return base({ title: `Order Confirmed | ${BRAND}`, noindex: true });
  return notFound();
}

function notFound(): Seo {
  return base({ title: `Page Not Found | ${BRAND}`, noindex: true });
}

/* ---------- Build-time helpers ---------- */

/** Every indexable route, for the sitemap and the prerenderer. */
export function indexableRoutes(): { path: string; images: { url: string; title: string }[]; lastmod?: string }[] {
  const real = PRODUCTS.filter(isRealProduct);
  return [
    { path: '/', images: [] },
    { path: '/shop', images: [] },
    ...CATEGORIES.filter((c) => real.some((p) => p.category === c.slug)).map((c) => ({ path: `/collections/${c.slug}`, images: [] })),
    ...real.map((p) => ({ path: `/product/${p.slug}`, lastmod: p.createdAt, images: (p.images ?? []).map((u) => ({ url: abs(u), title: p.name })) })),
    { path: '/about', images: [] },
    { path: '/contact', images: [] },
    { path: '/faq', images: [] },
  ];
}

/** Routes to prerender: indexable ones plus placeholder products (prerendered as noindex so their previews work). */
export function prerenderRoutes(): string[] {
  const all = new Set([...indexableRoutes().map((r) => r.path), ...CATEGORIES.map((c) => `/collections/${c.slug}`)]);
  return [...all, ...PRODUCTS.filter((p) => !isRealProduct(p)).map((p) => `/product/${p.slug}`)];
}
