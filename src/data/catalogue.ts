import type { ProductEntry } from './products';

/**
 * YOUR REAL PRODUCTS. Add new ones at the end of this list.
 *
 * 1. Compress the photos/video into public/products/<slug>/ (slug = name in lower-case-with-dashes;
 *    originals go in source-assets/products/<slug>/).
 * 2. Add an entry below. `colors` are keys of PALETTE in products.ts (add a new colour there if needed).
 * 3. Real products (with images) are listed first in the shop, go into the sitemap and get Google
 *    product data automatically.
 */
export const CATALOGUE: ProductEntry[] = [
  {
    name: 'Zumrud Embroidered Lawn Suit',
    category: 'straight',
    fabric: 'Cotton',
    occasion: 'Festive',
    price: 3499,
    mrp: 4999,
    colors: ['bottle'],
    pattern: 'paisley',
    isNew: true,
    isBestseller: true,
    blurb: 'Bottle-green straight kurta with peach-and-ivory thread embroidery on the yoke, sleeves and hem, a matching embroidered dupatta with tassels, and black pants finished with a peach lace cuff.',
    images: ['/products/zumrud-embroidered-lawn-suit/1.jpg'],
    video: '/products/zumrud-embroidered-lawn-suit/video.mp4',
  },
];
