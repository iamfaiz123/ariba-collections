import { CATALOGUE } from './catalogue';
import type { CategorySlug, ColorOption, Fabric, Occasion, Pattern, Product, ProductArt, Size } from '@/types';

export const PALETTE: Record<string, ColorOption> = {
  maroon: { name: 'Maroon', hex: '#7A1F3D', accent: '#D9B677' },
  rani: { name: 'Rani Pink', hex: '#C2185B', accent: '#F7D9A0' },
  blush: { name: 'Blush', hex: '#E7A9A5', accent: '#8A3B4A' },
  teal: { name: 'Teal', hex: '#22636A', accent: '#E9D8A6' },
  emerald: { name: 'Emerald', hex: '#1F6B4A', accent: '#E8C77A' },
  mint: { name: 'Mint', hex: '#A8D5BA', accent: '#4E7A5E' },
  navy: { name: 'Navy', hex: '#1F2E5A', accent: '#D9B677' },
  powder: { name: 'Powder Blue', hex: '#9EB7D6', accent: '#2D4373' },
  mustard: { name: 'Mustard', hex: '#C9962B', accent: '#5B2A12' },
  rust: { name: 'Rust', hex: '#A8482A', accent: '#F4DDB5' },
  ivory: { name: 'Ivory', hex: '#EFE6D2', accent: '#B8893B' },
  black: { name: 'Black', hex: '#1E1A1D', accent: '#C9A15A' },
  lavender: { name: 'Lavender', hex: '#B9A6D6', accent: '#4B3A73' },
  wine: { name: 'Wine', hex: '#5A1530', accent: '#E6C17A' },
  peach: { name: 'Peach', hex: '#F2B48F', accent: '#8C3F2A' },
  olive: { name: 'Olive', hex: '#6B6B2E', accent: '#F0DFA8' },
  bottle: { name: 'Bottle Green', hex: '#1F3A2E', accent: '#E8B49A' },
};

/** One product as you write it. Everything else (id, slug, sizes, care…) is derived. */
export interface ProductEntry {
  name: string;
  category: CategorySlug;
  fabric: Fabric;
  occasion: Occasion;
  price: number;
  mrp: number;
  colors: (keyof typeof PALETTE)[];
  pattern: Pattern;
  isNew?: boolean;
  isBestseller?: boolean;
  stock?: number;
  blurb: string;
  /** Photo paths under /products/<slug>/. The first is the card image. Real products must have at least one. */
  images?: string[];
  /** Optional video, shown first in the product gallery. */
  video?: string;
}

// Demo placeholder products were removed on 2026-11-09 (see git history if you ever want them back).

const SIZES_STITCHED: Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const ART_BY_CATEGORY: Record<CategorySlug, Omit<ProductArt, 'pattern'>> = {
  kurtis: { silhouette: 'straight', bottom: 'pant' },
  'kurta-sets': { silhouette: 'straight', bottom: 'pant' },
  anarkali: { silhouette: 'anarkali', bottom: 'pant' },
  straight: { silhouette: 'straight', bottom: 'pant' },
  sharara: { silhouette: 'aline', bottom: 'sharara' },
  palazzo: { silhouette: 'aline', bottom: 'palazzo' },
  patiala: { silhouette: 'straight', bottom: 'patiala' },
  unstitched: { silhouette: 'straight', bottom: 'pant' },
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Small deterministic PRNG so mock data is stable across reloads. */
function rng(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const BUILT: Product[] = CATALOGUE.map((s, i) => {
  const r = rng(i + 1);
  const isUnstitched = s.category === 'unstitched';
  const day = 1 + Math.floor(r() * 27);
  const month = s.isNew ? 10 : 1 + Math.floor(r() * 8);
  return {
    id: `p${String(i + 1).padStart(3, '0')}`,
    slug: slugify(s.name),
    name: s.name,
    category: s.category,
    fabric: s.fabric,
    occasion: s.occasion,
    price: s.price,
    mrp: s.mrp,
    // Real customer reviews only: these stay empty until the reviews service supplies them.
    rating: 0,
    reviewCount: 0,
    colors: s.colors.map((c) => PALETTE[c]),
    sizes: isUnstitched ? ['Free'] : SIZES_STITCHED,
    stock: s.stock ?? 10 + Math.floor(r() * 40),
    isNew: !!s.isNew,
    isBestseller: !!s.isBestseller,
    description: s.blurb,
    highlights: [
      `${s.fabric} fabric with a soft, comfortable fall`,
      isUnstitched ? 'Shirt, bottom & dupatta fabric — 2.5m each' : 'Fully lined kurta with side pockets',
      s.occasion === 'Wedding' || s.occasion === 'Festive' ? 'Intricate hand-finished embellishment' : 'Easy, breathable everyday wear',
      'Colour-fast dyes, ethically crafted in India',
    ],
    includes: isUnstitched ? ['Shirt fabric', 'Bottom fabric', 'Dupatta'] : ['Kurta', s.category === 'sharara' ? 'Sharara' : s.category === 'palazzo' ? 'Palazzo' : s.category === 'patiala' ? 'Patiala salwar' : 'Pants', 'Dupatta'],
    care: s.fabric === 'Velvet' || s.fabric === 'Silk' || s.fabric === 'Organza' ? ['Dry clean only', 'Store in a muslin bag', 'Iron on reverse, low heat'] : ['Gentle hand wash in cold water', 'Wash dark colours separately', 'Dry in shade'],
    art: { pattern: s.pattern, ...ART_BY_CATEGORY[s.category] },
    images: s.images,
    video: s.video,
    reviews: [],
    createdAt: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
});

/** Products with real photos are listed first (stable sort keeps the rest in order). */
export const PRODUCTS: Product[] = [...BUILT].sort((a, b) => Number(!!b.images?.length) - Number(!!a.images?.length));

export const FABRICS: Fabric[] = ['Cotton', 'Georgette', 'Silk', 'Chanderi', 'Rayon', 'Muslin', 'Organza', 'Velvet'];
export const OCCASIONS: Occasion[] = ['Casual', 'Festive', 'Wedding', 'Office', 'Party'];
export const ALL_SIZES: Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free'];
export const ALL_COLORS = Object.values(PALETTE);
