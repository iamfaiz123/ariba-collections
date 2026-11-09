export type CategorySlug =
  | 'kurtis'
  | 'kurta-sets'
  | 'anarkali'
  | 'straight'
  | 'sharara'
  | 'palazzo'
  | 'patiala'
  | 'unstitched';

export type Fabric = 'Cotton' | 'Georgette' | 'Silk' | 'Chanderi' | 'Rayon' | 'Muslin' | 'Organza' | 'Velvet';
export type Occasion = 'Casual' | 'Festive' | 'Wedding' | 'Office' | 'Party';
export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'Free';
export type Pattern = 'booti' | 'stripes' | 'floral' | 'chevron' | 'paisley' | 'plain';

export interface Category {
  slug: CategorySlug;
  name: string;
  tagline: string;
  color: string;
  accent: string;
  pattern: Pattern;
  /** Shown under the H1 on /collections/<slug> and used for its meta description. */
  intro: string;
}

export interface ColorOption {
  name: string;
  hex: string;
  accent: string;
}

/** Visual parameters for generated product art (replace with `images` once the backend serves photos). */
export interface ProductArt {
  pattern: Pattern;
  silhouette: 'aline' | 'straight' | 'anarkali';
  bottom: 'pant' | 'sharara' | 'palazzo' | 'patiala';
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  date: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  fabric: Fabric;
  occasion: Occasion;
  price: number;
  mrp: number;
  /** Average of real customer reviews; 0 when there are none. */
  rating: number;
  reviewCount: number;
  colors: ColorOption[];
  sizes: Size[];
  stock: number;
  isNew: boolean;
  isBestseller: boolean;
  description: string;
  highlights: string[];
  includes: string[];
  care: string[];
  art: ProductArt;
  /** Photo URLs (first = card image). Missing files fall back to the illustration. */
  images?: string[];
  /** Optional product video (e.g. AI-generated from your photos) shown first in the gallery. */
  video?: string;
  reviews: Review[];
  createdAt: string;
}

export type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'rating' | 'discount';

export interface ProductFilters {
  q?: string;
  category?: CategorySlug[];
  fabric?: Fabric[];
  occasion?: Occasion[];
  size?: Size[];
  color?: string[];
  minPrice?: number;
  maxPrice?: number;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Cart lines keep a snapshot of the product so the cart renders without refetching; the backend re-prices on checkout. */
export interface CartItem {
  key: string;
  productId: string;
  slug: string;
  name: string;
  price: number;
  mrp: number;
  size: Size;
  color: ColorOption;
  art: ProductArt;
  image?: string;
  maxQty: number;
  qty: number;
}

export interface Address {
  fullName: string;
  phone: string;
  email: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cod';
export type ShippingMethod = 'standard' | 'express';

export interface Coupon {
  code: string;
  description: string;
  type: 'percent' | 'flat';
  value: number;
  minSubtotal: number;
}

export interface OrderLine {
  productId: string;
  name: string;
  slug: string;
  size: Size;
  color: string;
  qty: number;
  price: number;
}

export type OrderStatus = 'Placed' | 'Packed' | 'Shipped' | 'Delivered' | 'Cancelled';

export interface Order {
  id: string;
  userEmail?: string;
  lines: OrderLine[];
  address: Address;
  shipping: ShippingMethod;
  payment: PaymentMethod;
  subtotal: number;
  discount: number;
  shippingFee: number;
  codFee: number;
  total: number;
  coupon?: string;
  status: OrderStatus;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
}
