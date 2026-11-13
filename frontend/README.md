# Aribas: storefront (frontend, phase 1)

An e-commerce frontend for Aribas kurtis and ladies suits, built with React 18, TypeScript, Vite, Tailwind and Zustand. Every feature works today against a **mock API** that saves data in the browser (localStorage), so the real backend can be added in phase 2 without touching the UI.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check, production build, then prerender every page into dist/
npm run preview    # serve dist/ locally, as Render does
```

**Live demo:** https://ariba-collections.onrender.com. Render rebuilds automatically on every push to `main`.

## Project layout

```
src/
  data/catalogue.ts    ← YOUR REAL PRODUCTS (add new ones here)
  data/products.ts     ← colour palette and derived product fields
  data/media.ts        ← site-wide media: hero film, new-collection posters, banner/footer slots
  data/categories.ts   ← collections (Anarkali, Straight…) with their SEO intro text
  data/content.ts      ← coupons, shipping rules, FAQs, size chart, Indian states
  services/api.ts      ← THE backend contract. Swap mock bodies for http() calls in phase 2.
  seo/                 ← titles, meta, Open Graph, JSON-LD per route + build-time prerender
  store/               ← cart, wishlist, auth, UI (Zustand, persisted)
  components/          ← Header, Footer, ProductCard, ProductArt, Media, CartDrawer…
  pages/               ← one file per route
  types/               ← shared domain types (Product, Order, Address…)
scripts/prerender.mjs  ← writes dist/<route>/index.html, sitemap.xml, robots.txt after vite build
public/media/          ← compressed site-wide images and videos
public/products/<slug>/← compressed product photos and videos
source-assets/         ← full-size originals (git-ignored, back it up yourself)
docs/VIDEO_PROMPTS.md  ← AI video prompts for your clothing photos
```

## Routes

| Path | Page | In Google? |
|---|---|---|
| `/` | Home: brand film, new-collection posters, featured, bestsellers, story stats, spotlight | yes |
| `/shop` | All products; filters and sort live in the URL | yes (filtered views: no) |
| `/collections/:category` | One collection, e.g. `/collections/anarkali` | yes |
| `/product/:slug` | Product page | real products only |
| `/about`, `/contact`, `/faq` | Content pages | yes |
| `/cart`, `/checkout`, `/order/:id`, `/wishlist`, `/account` | Shopping and account | no |

## Adding products

1. Put the originals in `source-assets/products/<slug>/`.
2. Compress them into `public/products/<slug>/` (`1.jpg`, `2.jpg`…, `video.mp4`); see the ffmpeg commands in `docs/VIDEO_PROMPTS.md`.
3. Add an entry to `src/data/catalogue.ts`.

A product with photos is automatically added to the shop and sitemap and given Google product data. **The shop is empty for now:** the demo placeholders were removed, and the Zumrud suit is parked in `ON_HOLD` in `catalogue.ts`; move it into `CATALOGUE` to bring it back. While the shop is empty, the home page hides its product sections and the shop shows a "new styles are on their way" message.

## SEO

- `src/seo/seo.ts` decides the title, description, canonical URL, Open Graph image and JSON-LD for each route (Organization, WebSite, BreadcrumbList, CollectionPage, Product with INR price, shipping and returns, FAQPage).
- `npm run build` prerenders each public route to static HTML, so crawlers and WhatsApp/Instagram previews see the right tags without JavaScript, and writes `sitemap.xml` and `robots.txt`.
- The site URL comes from `VITE_SITE_URL` (default `https://ariba-collections.onrender.com`). Set it when moving to a custom domain.
- **Contact details and social profiles** live in `CONTACT` and `SOCIAL` in `src/data/content.ts`. Empty fields are hidden everywhere; filled social URLs also go into Google's brand data (`sameAs`). Keep the name, phone and city identical to your Google Business Profile.
- **Google Search Console & Analytics:** paste the codes into `TRACKING` in `src/data/content.ts` and push. The verification tag then goes on every page; Analytics loads only after a visitor accepts the cookie banner, and sends a page view on every route change.
- **Empty collections are noindex** and left out of the sitemap until they contain at least one real product, so Google never sees thin pages.
- **Keywords:** the site targets "kurtis", "kurta sets" and "suits for women". Kurtis and Kurta Sets are the first two collections.
- **Reviews:** there are none yet. The UI shows stars and reviews only for products with real reviews. Add `aggregateRating` to the Product JSON-LD in `seo.ts` once real reviews come from the backend; never mark up reviews that aren't real.

## Deploying (Render)

Static site, built with `npm ci && npm run build`, published from `dist/`. Rewrite rules are listed in `render.yaml` (set on the service through the Render API; the service is not managed as a Blueprint). Each prerendered route is rewritten to its `index.html` by exact path, and everything else to `/200.html` (the app shell, marked noindex). Don't use wildcards such as `/product/*`: Render returns a blank page when the target file doesn't exist. **When you add a product, add a rule for `/product/<slug>`** (and for any new public page) before the catch-all.

## Connecting the backend

The API lives in [../backend](../backend/README.md). Set `VITE_API_URL` (e.g. `http://localhost:4000`, or the deployed API URL on Render) and the storefront switches to live mode:

- **Login:** a WhatsApp OTP.
- **Checkout:** server-priced, with Razorpay payment.
- **Account:** orders with PDF receipts, returns and saved addresses.
- **Admin:** `/admin`, for numbers listed in `ADMIN_PHONES`.
- **Catalogue:** the shop reads products from the API.

Without `VITE_API_URL`, everything runs on the in-browser demo data as before. Live-mode screens are in `src/pages/live/`, `src/pages/admin/` and `src/components/live/`; the API client is `src/services/backend.ts`.

The build-time prerender still uses `src/data/catalogue.ts`. Once products live in the backend, the prerender should fetch them from the API at build time so product pages stay crawlable.
