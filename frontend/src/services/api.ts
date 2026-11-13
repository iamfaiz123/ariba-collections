/**
 * API layer.
 *
 * Every screen talks to the backend ONLY through these functions. Right now they are
 * backed by in-memory mock data + localStorage. When the real backend is ready, replace
 * each function body with an HTTP call (see `http()` below) — the signatures and return
 * types are the contract the UI depends on, so no component needs to change.
 */
import { COUPONS, SHIPPING } from '@/data/content';
import { PRODUCTS } from '@/data/products';
import type {
  Address, Coupon, Order, OrderLine, Paginated, PaymentMethod, Product, ProductFilters,
  ShippingMethod, User,
} from '@/types';
import { storage } from './storage';
import { catalogue, LIVE } from './backend';

export const API_BASE_URL = import.meta.env.VITE_API_URL as string | undefined;

/** Ready for phase 2: a thin fetch wrapper for the real backend. */
export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL ?? ''}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

// ---------- Catalogue ----------

const discountPct = (p: Product) => Math.round(((p.mrp - p.price) / p.mrp) * 100);

export async function getProducts(f: ProductFilters = {}): Promise<Paginated<Product>> {
  if (LIVE)
    return catalogue.list({
      q: f.q, category: f.category?.join(','), fabric: f.fabric?.join(','), occasion: f.occasion?.join(','), size: f.size?.join(','),
      minPrice: f.minPrice, maxPrice: f.maxPrice, sort: f.sort === 'rating' ? 'featured' : f.sort, page: f.page, pageSize: f.pageSize ?? 12,
    });
  await delay();
  const q = f.q?.trim().toLowerCase();
  let items = PRODUCTS.filter((p) => {
    if (q && ![p.name, p.category, p.fabric, p.occasion, p.description, ...p.colors.map((c) => c.name)].join(' ').toLowerCase().includes(q)) return false;
    if (f.category?.length && !f.category.includes(p.category)) return false;
    if (f.fabric?.length && !f.fabric.includes(p.fabric)) return false;
    if (f.occasion?.length && !f.occasion.includes(p.occasion)) return false;
    if (f.size?.length && !p.sizes.some((s) => f.size!.includes(s))) return false;
    if (f.color?.length && !p.colors.some((c) => f.color!.includes(c.name))) return false;
    if (f.minPrice != null && p.price < f.minPrice) return false;
    if (f.maxPrice != null && p.price > f.maxPrice) return false;
    return true;
  });

  switch (f.sort) {
    case 'newest': items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
    case 'price-asc': items = [...items].sort((a, b) => a.price - b.price); break;
    case 'price-desc': items = [...items].sort((a, b) => b.price - a.price); break;
    case 'rating': items = [...items].sort((a, b) => b.rating - a.rating); break;
    case 'discount': items = [...items].sort((a, b) => discountPct(b) - discountPct(a)); break;
    default: items = [...items].sort((a, b) => Number(b.isBestseller) - Number(a.isBestseller));
  }

  const pageSize = f.pageSize ?? 12;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, f.page ?? 1), totalPages);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, totalPages };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (LIVE) return catalogue.bySlug(slug);
  await delay(150);
  return PRODUCTS.find((p) => p.slug === slug) ?? null;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (LIVE) {
    const valid = ids.filter((id) => /^[0-9a-f-]{36}$/.test(id));
    if (!valid.length) return [];
    const { items } = await catalogue.list({ ids: valid.join(','), pageSize: 60 });
    return valid.map((id) => items.find((p) => p.id === id)).filter((p): p is Product => !!p);
  }
  await delay(80);
  return ids.map((id) => PRODUCTS.find((p) => p.id === id)).filter((p): p is Product => !!p);
}

export async function getRelated(product: Product, limit = 4): Promise<Product[]> {
  if (LIVE) return (await catalogue.list({ category: product.category, exclude: product.id, pageSize: limit })).items;
  await delay(120);
  return PRODUCTS.filter((p) => p.id !== product.id && (p.category === product.category || p.occasion === product.occasion)).slice(0, limit);
}

export async function getFeatured(kind: 'new' | 'bestseller', limit = 8): Promise<Product[]> {
  if (LIVE) {
    const flagged = (await catalogue.list({ flag: kind, pageSize: limit })).items;
    return flagged.length ? flagged : (await catalogue.list({ sort: kind === 'new' ? 'newest' : 'featured', pageSize: limit })).items;
  }
  await delay(150);
  const list = kind === 'new' ? PRODUCTS.filter((p) => p.isNew) : PRODUCTS.filter((p) => p.isBestseller);
  return list.slice(0, limit);
}

export async function searchSuggestions(q: string, limit = 6): Promise<Product[]> {
  if (!q.trim()) return [];
  const { items } = await getProducts({ q, pageSize: limit });
  return items;
}

// ---------- Pricing ----------

export async function validateCoupon(code: string, subtotal: number): Promise<Coupon> {
  await delay(300);
  const coupon = COUPONS.find((c) => c.code === code.trim().toUpperCase());
  if (!coupon) throw new ApiError(404, 'This coupon code is not valid.');
  if (subtotal < coupon.minSubtotal) throw new ApiError(422, `Add items worth ₹${(coupon.minSubtotal - subtotal).toLocaleString('en-IN')} more to use ${coupon.code}.`);
  return coupon;
}

export function computeTotals(subtotal: number, coupon: Coupon | null, shipping: ShippingMethod = 'standard', payment?: PaymentMethod) {
  const discount = !coupon ? 0 : coupon.type === 'percent' ? Math.round((subtotal * coupon.value) / 100) : Math.min(coupon.value, subtotal);
  const afterDiscount = subtotal - discount;
  const shippingFee = subtotal === 0 ? 0 : shipping === 'express' ? SHIPPING.expressFee : afterDiscount >= SHIPPING.freeAbove ? 0 : SHIPPING.standardFee;
  const codFee = payment === 'cod' ? SHIPPING.codFee : 0;
  return { subtotal, discount, shippingFee, codFee, total: afterDiscount + shippingFee + codFee };
}

// ---------- Orders ----------

const ORDERS_KEY = 'ariba.db.orders';

export interface PlaceOrderInput {
  lines: OrderLine[];
  address: Address;
  shipping: ShippingMethod;
  payment: PaymentMethod;
  coupon: Coupon | null;
  userEmail?: string;
}

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  await delay(900);
  // Re-check stock server-side (mock)
  for (const l of input.lines) {
    const p = PRODUCTS.find((x) => x.id === l.productId);
    if (!p) throw new ApiError(404, `${l.name} is no longer available.`);
    if (l.qty > p.stock) throw new ApiError(409, `Only ${p.stock} left of ${p.name}.`);
  }
  const subtotal = input.lines.reduce((s, l) => s + l.price * l.qty, 0);
  const totals = computeTotals(subtotal, input.coupon, input.shipping, input.payment);
  const order: Order = {
    id: `AC${Date.now().toString().slice(-8)}`,
    userEmail: input.userEmail ?? input.address.email,
    lines: input.lines,
    address: input.address,
    shipping: input.shipping,
    payment: input.payment,
    coupon: input.coupon?.code,
    status: 'Placed',
    createdAt: new Date().toISOString(),
    ...totals,
  };
  const all = storage.get<Order[]>(ORDERS_KEY, []);
  storage.set(ORDERS_KEY, [order, ...all]);
  return order;
}

export async function getOrder(id: string): Promise<Order | null> {
  await delay(150);
  return storage.get<Order[]>(ORDERS_KEY, []).find((o) => o.id === id) ?? null;
}

export async function getOrdersForUser(email: string): Promise<Order[]> {
  await delay(200);
  return storage.get<Order[]>(ORDERS_KEY, []).filter((o) => o.userEmail?.toLowerCase() === email.toLowerCase());
}

export async function cancelOrder(id: string): Promise<Order> {
  await delay(300);
  const all = storage.get<Order[]>(ORDERS_KEY, []);
  const o = all.find((x) => x.id === id);
  if (!o) throw new ApiError(404, 'Order not found');
  if (o.status !== 'Placed') throw new ApiError(409, 'Only orders that have not shipped can be cancelled.');
  o.status = 'Cancelled';
  storage.set(ORDERS_KEY, all);
  return o;
}

// ---------- Auth (mock — passwords stored in plain text locally; DO NOT ship) ----------

const USERS_KEY = 'ariba.db.users';
type StoredUser = User & { password: string };

export async function register(name: string, email: string, password: string): Promise<User> {
  await delay(400);
  const users = storage.get<StoredUser[]>(USERS_KEY, []);
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw new ApiError(409, 'An account with this email already exists.');
  const user: StoredUser = { id: `u${Date.now()}`, name, email, password, createdAt: new Date().toISOString() };
  storage.set(USERS_KEY, [...users, user]);
  const { password: _pw, ...safe } = user;
  void _pw;
  return safe;
}

export async function login(email: string, password: string): Promise<User> {
  await delay(400);
  const user = storage.get<StoredUser[]>(USERS_KEY, []).find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== password) throw new ApiError(401, 'Incorrect email or password.');
  const { password: _pw, ...safe } = user;
  void _pw;
  return safe;
}

export async function updateProfile(id: string, patch: Partial<Pick<User, 'name' | 'phone'>>): Promise<User> {
  await delay(300);
  const users = storage.get<StoredUser[]>(USERS_KEY, []);
  const u = users.find((x) => x.id === id);
  if (!u) throw new ApiError(404, 'User not found');
  Object.assign(u, patch);
  storage.set(USERS_KEY, users);
  const { password: _pw, ...safe } = u;
  void _pw;
  return safe;
}

export async function subscribeNewsletter(email: string): Promise<void> {
  await delay(300);
  const list = storage.get<string[]>('ariba.db.newsletter', []);
  if (!list.includes(email)) storage.set('ariba.db.newsletter', [...list, email]);
}

export async function sendContactMessage(msg: { name: string; email: string; message: string }): Promise<void> {
  await delay(500);
  const list = storage.get<unknown[]>('ariba.db.messages', []);
  storage.set('ariba.db.messages', [...list, { ...msg, at: new Date().toISOString() }]);
}
