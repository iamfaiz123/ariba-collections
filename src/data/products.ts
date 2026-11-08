import { PRODUCT_MEDIA } from './media';
import type { CategorySlug, ColorOption, Fabric, Occasion, Pattern, Product, ProductArt, Review, Size } from '@/types';

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
};

interface Seed {
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
}

const SEEDS: Seed[] = [
  { name: 'Mehr Zari Anarkali', category: 'anarkali', fabric: 'Georgette', occasion: 'Wedding', price: 6499, mrp: 8999, colors: ['maroon', 'wine', 'emerald'], pattern: 'paisley', isBestseller: true, blurb: 'A floor-grazing georgette Anarkali with zari paisley work cascading across a 24-kali flare.' },
  { name: 'Noor Gota Patti Anarkali', category: 'anarkali', fabric: 'Chanderi', occasion: 'Festive', price: 4299, mrp: 5799, colors: ['rani', 'mustard'], pattern: 'booti', isNew: true, blurb: 'Light chanderi with hand-applied gota patti booti and a scalloped dupatta.' },
  { name: 'Gulnaar Velvet Anarkali', category: 'anarkali', fabric: 'Velvet', occasion: 'Wedding', price: 8999, mrp: 11999, colors: ['wine', 'navy', 'black'], pattern: 'floral', stock: 4, blurb: 'Plush micro-velvet with dabka & sequin florals — made for winter weddings.' },
  { name: 'Sitara Printed Anarkali', category: 'anarkali', fabric: 'Rayon', occasion: 'Casual', price: 1899, mrp: 2799, colors: ['powder', 'peach', 'mint'], pattern: 'floral', isBestseller: true, blurb: 'An easy rayon Anarkali printed with soft florals and finished with lace trims.' },
  { name: 'Ruhani Organza Anarkali', category: 'anarkali', fabric: 'Organza', occasion: 'Party', price: 5499, mrp: 7499, colors: ['blush', 'lavender', 'ivory'], pattern: 'booti', isNew: true, blurb: 'Sheer organza layers with pearl-and-thread booti for a dreamy evening look.' },

  { name: 'Aarohi Chikankari Straight Suit', category: 'straight', fabric: 'Cotton', occasion: 'Office', price: 2499, mrp: 3299, colors: ['ivory', 'powder', 'mint'], pattern: 'booti', isBestseller: true, blurb: 'Lucknowi-inspired chikankari on breathable cotton, paired with straight pants.' },
  { name: 'Ziya Block Print Kurta Set', category: 'straight', fabric: 'Cotton', occasion: 'Casual', price: 1599, mrp: 2199, colors: ['teal', 'rust', 'navy'], pattern: 'chevron', blurb: 'Hand block-printed cotton with a mulmul dupatta — your everyday favourite.' },
  { name: 'Inaya Silk Straight Suit', category: 'straight', fabric: 'Silk', occasion: 'Festive', price: 4999, mrp: 6499, colors: ['emerald', 'mustard', 'maroon'], pattern: 'paisley', isNew: true, blurb: 'Art silk with a woven paisley jaal, embroidered yoke and banarasi dupatta.' },
  { name: 'Kiara Pinstripe Office Set', category: 'straight', fabric: 'Rayon', occasion: 'Office', price: 1799, mrp: 2499, colors: ['navy', 'black', 'olive'], pattern: 'stripes', blurb: 'Tailored pinstripe rayon with a mandarin collar — boardroom ready.' },
  { name: 'Saba Muslin Straight Suit', category: 'straight', fabric: 'Muslin', occasion: 'Festive', price: 3299, mrp: 4299, colors: ['peach', 'blush', 'lavender'], pattern: 'floral', blurb: 'Soft muslin with thread-and-mirror florals around the neckline and hem.' },

  { name: 'Shehnaaz Mirror Sharara Set', category: 'sharara', fabric: 'Georgette', occasion: 'Wedding', price: 7499, mrp: 9999, colors: ['rani', 'emerald', 'mustard'], pattern: 'booti', isBestseller: true, blurb: 'Short kurti with mirror work over a tiered georgette sharara — mehendi perfect.' },
  { name: 'Mahira Gharara Set', category: 'sharara', fabric: 'Silk', occasion: 'Wedding', price: 9499, mrp: 12999, colors: ['wine', 'maroon'], pattern: 'paisley', stock: 3, blurb: 'A heritage gharara in rich silk with a gota-lined knee joint and heavy dupatta.' },
  { name: 'Afreen Printed Sharara', category: 'sharara', fabric: 'Rayon', occasion: 'Party', price: 2299, mrp: 3199, colors: ['peach', 'mint', 'powder'], pattern: 'floral', isNew: true, blurb: 'Breezy printed sharara set with a ruffled hem and chiffon dupatta.' },
  { name: 'Laila Organza Sharara', category: 'sharara', fabric: 'Organza', occasion: 'Festive', price: 5999, mrp: 7999, colors: ['lavender', 'blush', 'ivory'], pattern: 'floral', blurb: 'Pastel organza with 3D floral appliqué — a sangeet showstopper.' },

  { name: 'Rumi Palazzo Suit', category: 'palazzo', fabric: 'Rayon', occasion: 'Casual', price: 1499, mrp: 1999, colors: ['mustard', 'teal', 'rust'], pattern: 'chevron', isBestseller: true, blurb: 'Relaxed rayon kurta with wide-leg palazzos — wear it all day, every day.' },
  { name: 'Hiba Embroidered Palazzo Set', category: 'palazzo', fabric: 'Georgette', occasion: 'Party', price: 3499, mrp: 4799, colors: ['black', 'navy', 'wine'], pattern: 'booti', blurb: 'Sequinned georgette with flared palazzos for cocktail evenings.' },
  { name: 'Tara Cotton Palazzo Set', category: 'palazzo', fabric: 'Cotton', occasion: 'Office', price: 1699, mrp: 2299, colors: ['powder', 'ivory', 'olive'], pattern: 'stripes', isNew: true, blurb: 'Crisp cotton with subtle stripes and pintuck detailing for workdays.' },
  { name: 'Zoya Chanderi Palazzo Suit', category: 'palazzo', fabric: 'Chanderi', occasion: 'Festive', price: 3999, mrp: 5299, colors: ['mint', 'peach', 'rani'], pattern: 'paisley', blurb: 'Shimmering chanderi with zari paisleys and lace-edged palazzos.' },

  { name: 'Simran Phulkari Patiala', category: 'patiala', fabric: 'Cotton', occasion: 'Festive', price: 2799, mrp: 3799, colors: ['rani', 'mustard', 'emerald'], pattern: 'floral', isBestseller: true, blurb: 'Vibrant phulkari dupatta over a cotton kurta with a full patiala salwar.' },
  { name: 'Harleen Striped Patiala', category: 'patiala', fabric: 'Cotton', occasion: 'Casual', price: 1399, mrp: 1899, colors: ['rust', 'navy', 'teal'], pattern: 'stripes', blurb: 'Classic striped short kurta with a voluminous patiala — pure joy.' },
  { name: 'Jasleen Silk Patiala Set', category: 'patiala', fabric: 'Silk', occasion: 'Wedding', price: 4599, mrp: 5999, colors: ['maroon', 'wine'], pattern: 'paisley', isNew: true, blurb: 'Silk patiala with tilla embroidery and a tasselled dupatta.' },

  { name: 'Ayesha Lawn Unstitched Suit', category: 'unstitched', fabric: 'Cotton', occasion: 'Casual', price: 1299, mrp: 1799, colors: ['mint', 'powder', 'peach'], pattern: 'floral', isBestseller: true, blurb: '3-piece printed lawn: 2.5m shirt, 2.5m bottom and 2.5m chiffon dupatta.' },
  { name: 'Mehrunissa Embroidered Unstitched', category: 'unstitched', fabric: 'Georgette', occasion: 'Festive', price: 3299, mrp: 4499, colors: ['wine', 'emerald', 'navy'], pattern: 'paisley', blurb: 'Embroidered georgette front panel, sleeves and border lace — tailor to taste.' },
  { name: 'Zainab Chanderi Unstitched', category: 'unstitched', fabric: 'Chanderi', occasion: 'Office', price: 1999, mrp: 2699, colors: ['ivory', 'lavender', 'olive'], pattern: 'booti', isNew: true, blurb: 'Chanderi with woven booti, santoon bottom and a matching dupatta.' },
];

const SIZES_STITCHED: Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const ART_BY_CATEGORY: Record<CategorySlug, Omit<ProductArt, 'pattern'>> = {
  anarkali: { silhouette: 'anarkali', bottom: 'pant' },
  straight: { silhouette: 'straight', bottom: 'pant' },
  sharara: { silhouette: 'aline', bottom: 'sharara' },
  palazzo: { silhouette: 'aline', bottom: 'palazzo' },
  patiala: { silhouette: 'straight', bottom: 'patiala' },
  unstitched: { silhouette: 'straight', bottom: 'pant' },
};

const REVIEWERS = ['Ananya S.', 'Fatima K.', 'Priya M.', 'Neha R.', 'Sana A.', 'Ritika J.', 'Mariam Z.', 'Kavya P.', 'Heena T.', 'Pooja D.'];
const REVIEW_TEXT: [string, string][] = [
  ['Absolutely stunning', 'The fabric quality exceeded my expectations and the colour is exactly as shown. Got so many compliments!'],
  ['Perfect fit', 'Ordered my usual size and it fits beautifully. The stitching is neat and the dupatta is gorgeous.'],
  ['Worth every rupee', 'Elegant, comfortable and well finished. Delivery was quick and packaging was lovely.'],
  ['Lovely but runs slightly large', 'Beautiful work. I would suggest going one size down if you are between sizes.'],
  ['My new favourite', 'Wore it for a family function and felt like a queen. Will definitely order again.'],
  ['Good quality', 'Soft fabric, rich colour. The embroidery is delicate and well done.'],
];

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

function buildReviews(i: number, count: number): Review[] {
  const r = rng(i * 97 + 13);
  return Array.from({ length: count }, (_, k) => {
    const [title, body] = REVIEW_TEXT[Math.floor(r() * REVIEW_TEXT.length)];
    const day = 1 + Math.floor(r() * 27);
    const month = 1 + Math.floor(r() * 10);
    return {
      id: `r${i}-${k}`,
      author: REVIEWERS[Math.floor(r() * REVIEWERS.length)],
      rating: r() > 0.25 ? 5 : 4,
      title,
      body,
      date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  });
}

export const PRODUCTS: Product[] = SEEDS.map((s, i) => {
  const r = rng(i + 1);
  const isUnstitched = s.category === 'unstitched';
  const reviewCount = 8 + Math.floor(r() * 180);
  const reviews = buildReviews(i, 3 + Math.floor(r() * 3));
  const rating = Math.round((4 + r() * 0.9) * 10) / 10;
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
    rating: Math.min(rating, 4.9),
    reviewCount,
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
    ...PRODUCT_MEDIA[slugify(s.name)],
    reviews,
    createdAt: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
});

export const FABRICS: Fabric[] = ['Cotton', 'Georgette', 'Silk', 'Chanderi', 'Rayon', 'Muslin', 'Organza', 'Velvet'];
export const OCCASIONS: Occasion[] = ['Casual', 'Festive', 'Wedding', 'Office', 'Party'];
export const ALL_SIZES: Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free'];
export const ALL_COLORS = Object.values(PALETTE);
export const PRICE_BOUNDS = { min: 0, max: 12000 };
