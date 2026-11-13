/**
 * Build-time only (loaded by scripts/prerender.mjs). Produces, for every public route:
 *  - the <head> tags for that page, and
 *  - a plain-HTML snapshot of its main content (heading, text, images, links) placed inside #root.
 * Crawlers and link previews read this without JavaScript; React replaces it as soon as the app starts.
 */
import { CATEGORIES, categoryBySlug } from '@/data/categories';
import { FAQS } from '@/data/content';
import { PRODUCTS } from '@/data/products';
import type { Product } from '@/types';
import { headHtml } from './head';
import { abs, getSeo, indexableRoutes, isRealProduct, prerenderRoutes, SITE_URL } from './seo';

const e = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const nav = () =>
  `<nav aria-label="Collections"><a href="/">Aribas</a> · <a href="/shop">Shop all</a> · ${CATEGORIES.map((c) => `<a href="/collections/${c.slug}">${e(c.name)}</a>`).join(' · ')} · <a href="/about">Our story</a> · <a href="/faq">FAQs</a> · <a href="/contact">Contact</a></nav>`;
const card = (p: Product) =>
  `<li><a href="/product/${p.slug}">${p.images?.[0] ? `<img src="${p.images[0]}" alt="${e(p.name)}" width="300" height="400" loading="lazy" />` : ''}${e(p.name)}</a> ${rupees(p.price)}</li>`;
const listing = (items: Product[]) => (items.length ? `<ul>${items.map(card).join('')}</ul>` : '');
const featured = () => PRODUCTS.filter(isRealProduct);

function body(path: string): string {
  if (path === '/') {
    return `<h1>Aribas: designer kurtis and suits for women online in India</h1>
<p>Kurtis, kurta sets and suits in our own designs, with handmade detailing and quality tailoring, delivered across India. Free shipping above ₹1,999, cash on delivery and easy 7-day returns.</p>
<h2>Shop by style</h2><ul>${CATEGORIES.map((c) => `<li><a href="/collections/${c.slug}">${e(c.name)}</a>: ${e(c.tagline)}</li>`).join('')}</ul>
<h2>Featured</h2>${listing(featured())}`;
  }
  if (path === '/shop') return `<h1>Shop kurtis &amp; suits</h1><p>Kurtis, kurta sets, Anarkali, straight, sharara, palazzo and Patiala suits, in our own designs, delivered across India.</p>${listing(featured())}`;

  const col = path.match(/^\/collections\/(.+)$/);
  if (col) {
    const c = categoryBySlug(col[1])!;
    return `<h1>${e(c.name)}</h1><p>${e(c.intro)}</p>${listing(PRODUCTS.filter((p) => p.category === c.slug && isRealProduct(p)))}`;
  }

  const prod = path.match(/^\/product\/(.+)$/);
  if (prod) {
    const p = PRODUCTS.find((x) => x.slug === prod[1])!;
    const c = categoryBySlug(p.category);
    return `<nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/shop">Shop</a> › ${c ? `<a href="/collections/${c.slug}">${e(c.name)}</a> › ` : ''}${e(p.name)}</nav>
<h1>${e(p.name)}</h1>
${(p.images ?? []).map((src) => `<img src="${src}" alt="${e(`${p.name} in ${p.colors[0].name}`)}" width="600" height="800" />`).join('')}
<p><strong>${rupees(p.price)}</strong>${p.mrp > p.price ? ` <s>${rupees(p.mrp)}</s>` : ''} · Inclusive of all taxes</p>
<p>${e(p.description)}</p>
<ul>${p.highlights.map((h) => `<li>${e(h)}</li>`).join('')}</ul>
<p>Fabric: ${e(p.fabric)} · Occasion: ${e(p.occasion)} · Colour: ${e(p.colors.map((x) => x.name).join(', '))} · Sizes: ${p.sizes.join(', ')}</p>
<p>Includes: ${e(p.includes.join(', '))}. Care: ${e(p.care.join('; '))}.</p>`;
  }
  if (path === '/faq') return `<h1>Help &amp; FAQs</h1>${FAQS.map((f) => `<h2>${e(f.q)}</h2><p>${e(f.a)}</p>`).join('')}`;
  if (path === '/about') return `<h1>Our story</h1><p>Every beautiful outfit begins with an idea. In 2023 we noticed women were buying kurtis with machine-made designs and ordinary prints, and finding something truly special was becoming difficult. So Aribas began: kurtis with thoughtfully designed patterns, handmade detailing and quality tailoring, brought to life by our own skilled tailors. We have since sold thousands of kurtis, and today we are expanding to bring our designs to even more women.</p><p>Beautiful clothing shouldn’t just look good. It should make you feel beautiful.</p>`;
  if (path === '/contact') return `<h1>Contact us</h1><p>Questions about sizing, orders, delivery or returns? Write to us and we reply within one working day.</p>`;
  return '';
}

export function buildPages(): { path: string; head: string; body: string }[] {
  return prerenderRoutes().map((path) => ({
    path,
    head: headHtml(getSeo(path)),
    body: `<div class="container-x py-8 prose-seo">${nav()}${body(path)}</div>`,
  }));
}

export function sitemapXml(today: string): string {
  const urls = indexableRoutes().map(
    (r) => `  <url>
    <loc>${abs(r.path)}</loc>
    <lastmod>${r.lastmod ?? today}</lastmod>${r.images.map((i) => `\n    <image:image><image:loc>${e(i.url)}</image:loc><image:title>${e(i.title)}</image:title></image:image>`).join('')}
  </url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>
`;
}

export function robotsTxt(): string {
  return `User-agent: *
Allow: /
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /wishlist
Disallow: /order/

Sitemap: ${SITE_URL}/sitemap.xml
`;
}
