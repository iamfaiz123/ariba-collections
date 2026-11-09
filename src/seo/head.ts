import { abs, BRAND, type Seo } from './seo';

/** One <meta>/<link>/<script> tag, described as data so it can be rendered as a string (build) or as DOM (browser). */
export type HeadTag = { tag: 'meta' | 'link'; attrs: Record<string, string> } | { tag: 'script'; attrs: Record<string, string>; text: string };

export function headTags(seo: Seo): HeadTag[] {
  const meta = (key: 'name' | 'property', k: string, content: string): HeadTag => ({ tag: 'meta', attrs: { [key]: k, content } });
  const url = seo.canonical ? abs(seo.canonical) : undefined;
  const image = abs(seo.image);
  const tags: HeadTag[] = [
    meta('name', 'description', seo.description),
    meta('name', 'robots', seo.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'),
    meta('property', 'og:site_name', BRAND),
    meta('property', 'og:locale', 'en_IN'),
    meta('property', 'og:type', seo.type === 'product' ? 'product' : seo.type),
    meta('property', 'og:title', seo.title),
    meta('property', 'og:description', seo.description),
    meta('property', 'og:image', image),
    meta('property', 'og:image:alt', seo.imageAlt),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', seo.title),
    meta('name', 'twitter:description', seo.description),
    meta('name', 'twitter:image', image),
  ];
  if (url) {
    tags.push(
      meta('property', 'og:url', url),
      { tag: 'link', attrs: { rel: 'canonical', href: url } },
      { tag: 'link', attrs: { rel: 'alternate', hreflang: 'en-IN', href: url } },
      { tag: 'link', attrs: { rel: 'alternate', hreflang: 'x-default', href: url } },
    );
  }
  if (seo.price) {
    tags.push(
      meta('property', 'product:price:amount', String(seo.price.amount)),
      meta('property', 'product:price:currency', seo.price.currency),
      meta('property', 'product:availability', seo.price.availability === 'instock' ? 'in stock' : 'out of stock'),
      meta('property', 'product:brand', BRAND),
      meta('property', 'product:condition', 'new'),
    );
  }
  for (const ld of seo.jsonLd) tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, text: JSON.stringify(ld) });
  return tags;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Build time: the tags as an HTML string. Every tag carries data-seo so the browser can replace them on navigation. */
export function headHtml(seo: Seo): string {
  const lines = [`<title>${esc(seo.title)}</title>`];
  for (const t of headTags(seo)) {
    const attrs = Object.entries({ ...t.attrs, 'data-seo': '' })
      .map(([k, v]) => (v === '' ? k : `${k}="${esc(v)}"`))
      .join(' ');
    lines.push(t.tag === 'script' ? `<script ${attrs}>${t.text.replace(/</g, '\\u003c')}</script>` : `<${t.tag} ${attrs} />`);
  }
  return lines.join('\n    ');
}

/** Browser: swap the previous route's tags for this route's. */
export function applyHead(seo: Seo) {
  document.title = seo.title;
  document.head.querySelectorAll('[data-seo]').forEach((el) => el.remove());
  const frag = document.createDocumentFragment();
  for (const t of headTags(seo)) {
    const el = document.createElement(t.tag);
    for (const [k, v] of Object.entries(t.attrs)) el.setAttribute(k, v);
    el.setAttribute('data-seo', '');
    if (t.tag === 'script') el.textContent = t.text;
    frag.appendChild(el);
  }
  document.head.appendChild(frag);
}
