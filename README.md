# Ariba Collections: storefront (frontend, phase 1)

An e-commerce frontend for ladies suits, built with React 18, TypeScript, Vite, Tailwind and Zustand. Every feature works today against a **mock API** that saves data in the browser (localStorage), so the real backend can be added in phase 2 without touching the UI.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

**Live demo:** https://ariba-collections.onrender.com. Render redeploys automatically on every push to `main`.

## Features

- **Home:** wordmark hero, campaign hero with a testimonial carousel, featured products, manifesto banner, an editorial bestsellers grid, stats, a best-product spotlight and shop-by-style
- **Shop:** search, filters (category, price, occasion, fabric, size, colour), sorting and pagination, all stored in the URL so any view can be shared. Filters open as a drawer on mobile.
- **Product page:** image/video gallery, colour and size pickers, size chart, quantity, wishlist, buy now, details/care/shipping tabs, reviews, related products, and a sticky add-to-bag bar on mobile
- **Cart:** slide-out drawer with a free-shipping progress bar, plus a full cart page with coupons (`ARIBA10`, `FESTIVE500`, `WELCOME15`)
- **Checkout:** address form with validation for Indian mobile numbers, PIN codes and states, standard/express delivery, and UPI / card / netbanking / COD (with a COD fee), followed by an order confirmation page
- **Account:** register and sign in, order history, cancel an order, edit profile
- **Wishlist, recently viewed, search** with live suggestions
- **Content pages:** About, Contact (form), FAQ, 404
- **Accessibility:** responsive layout, a skip link, focus rings, aria labels, and support for reduced motion

## Project layout

```
src/
  services/api.ts      ← THE backend contract. Swap mock bodies for http() calls in phase 2.
  data/                ← mock catalogue, coupons, content, media slots
  store/               ← cart, wishlist, auth, UI (Zustand, persisted)
  components/          ← Header, Footer, ProductCard, ProductArt, Media, CartDrawer…
  pages/               ← one file per route
  types/               ← shared domain types (Product, Order, Address…)
docs/VIDEO_PROMPTS.md  ← AI video prompts for your clothing photos
public/media/          ← drop hero/banner/footer videos & images here
public/products/<slug>/← drop product photos/videos here
```

## Adding your photos and videos

1. Put the files in `public/media/` (site-wide slots) or `public/products/<slug>/`.
2. Set the file paths in `src/data/media.ts` (`MEDIA` for site-wide slots, `PRODUCT_MEDIA` for products).
3. Until a file exists, the site shows a drawn illustration, so you can add media one file at a time.

See [docs/VIDEO_PROMPTS.md](docs/VIDEO_PROMPTS.md) for prompts to generate the videos.

## Phase 2: connecting the backend

- Set `VITE_API_URL` in `.env`.
- In `src/services/api.ts`, replace each function body with `http<T>('/path')`. The signatures are the contract the UI depends on.
- Endpoints the UI needs: products (list/filter/detail/related), coupons/validate, orders (create/get/list/cancel), auth (register/login/profile), newsletter, contact.
- **Before going live:** auth and the card form are demo-only. Passwords are stored in plain text in localStorage, and card fields are not collected. Replace them with real auth and a payment gateway (Razorpay or Cashfree), and re-price the cart on the server.
