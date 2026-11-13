/**
 * Client for the Aribas backend (backend/ folder). Active when VITE_API_URL is set;
 * without it the storefront keeps running on the in-browser demo data.
 *
 * Auth: a short-lived access token kept in memory + a refresh token in localStorage.
 * Any 401 triggers one silent refresh and a retry.
 */
import type { Product, Size, User } from '@/types';
import { storage } from './storage';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const LIVE = !!API_URL;

export class BackendError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

const REFRESH_KEY = 'aribas.session';
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<(u: LiveUser | null) => void>();

export interface LiveUser extends User {
  role: 'customer' | 'admin';
  phone: string;
}

export function onSessionChange(fn: (u: LiveUser | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setSession(s: { accessToken: string; refreshToken: string; user: LiveUser } | null) {
  accessToken = s?.accessToken ?? null;
  if (s) storage.set(REFRESH_KEY, s.refreshToken);
  else localStorage.removeItem(REFRESH_KEY);
  listeners.forEach((fn) => fn(s?.user ?? null));
}

async function refresh(): Promise<boolean> {
  const refreshToken = storage.get<string | null>(REFRESH_KEY, null);
  if (!refreshToken) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        if (res.status === 401) setSession(null);
        return false;
      }
      setSession(await res.json());
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function req<T>(method: string, path: string, body?: unknown, opts: { headers?: Record<string, string>; retry?: boolean } = {}): Promise<T> {
  if (!accessToken && storage.get<string | null>(REFRESH_KEY, null) && !path.startsWith('/api/auth/')) await refresh();
  const res = await fetch(API_URL + path, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...opts.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && opts.retry !== false && !path.startsWith('/api/auth/') && (await refresh())) return req<T>(method, path, body, { ...opts, retry: false });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new BackendError(res.status, e.code ?? 'error', e.message ?? `Request failed (${res.status})`, e.details);
  }
  return data as T;
}

/** Downloads a PDF (receipt) with auth and opens it in a new tab. */
export async function openPdf(path: string, filename: string) {
  const win = window.open('', '_blank');
  const go = async (): Promise<Response> => {
    const r = await fetch(API_URL + path, { headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {} });
    if (r.status === 401 && (await refresh())) return go();
    return r;
  };
  const res = await go();
  if (!res.ok) {
    win?.close();
    const data = await res.json().catch(() => null);
    throw new BackendError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? 'Could not open the receipt.');
  }
  const url = URL.createObjectURL(await res.blob());
  if (win) win.location.href = url;
  else {
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ───────────────────────── auth ─────────────────────────
export const auth = {
  requestOtp: (phone: string) => req<{ ok: true; resendIn: number; devCode?: string }>('POST', '/api/auth/otp/request', { phone }),
  async verifyOtp(phone: string, code: string, name?: string) {
    const s = await req<{ accessToken: string; refreshToken: string; user: LiveUser; isNew: boolean }>('POST', '/api/auth/otp/verify', { phone, code, name });
    setSession(s);
    return s;
  },
  /** Restores the session on page load. undefined = couldn't reach the server (keep what we have). */
  async restore(): Promise<LiveUser | null | undefined> {
    if (!storage.get<string | null>(REFRESH_KEY, null)) return null;
    if (!(await refresh())) return storage.get<string | null>(REFRESH_KEY, null) ? undefined : null;
    return req<LiveUser>('GET', '/api/me');
  },
  async logout() {
    const refreshToken = storage.get<string | null>(REFRESH_KEY, null);
    setSession(null);
    await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }) }).catch(() => {});
  },
  updateMe: (patch: { name?: string; email?: string }) => req<LiveUser>('PATCH', '/api/me', patch),
};

// ───────────────────────── addresses ─────────────────────────
export interface SavedAddress {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}
export const addresses = {
  list: () => req<{ items: SavedAddress[] }>('GET', '/api/me/addresses').then((r) => r.items),
  create: (a: Omit<SavedAddress, 'id' | 'isDefault'> & { isDefault?: boolean }) => req<SavedAddress>('POST', '/api/me/addresses', a),
  remove: (id: string) => req('DELETE', `/api/me/addresses/${id}`),
};

// ───────────────────────── cart & checkout ─────────────────────────
export interface ServerCart {
  items: { id: string; productId: string; name: string; size: string; color: string | null; qty: number; price: number; problem: string | null }[];
  coupon: string | null;
  couponError: string | null;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
}
export interface CheckoutPayment {
  provider: 'razorpay' | 'mock';
  keyId: string;
  providerOrderId: string;
  amountPaise: number;
  currency: 'INR';
  name: string;
  description: string;
  prefill: { name: string; contact: string; email?: string };
}
export const cart = {
  replace: (items: { productId: string; size: string; color: string; qty: number }[], coupon: string | null, shipping: 'standard' | 'express') =>
    req<ServerCart>('PUT', `/api/cart?shipping=${shipping}`, { items, coupon }),
};

// ───────────────────────── orders ─────────────────────────
export type LiveOrderStatus = 'pending_payment' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
export interface LiveOrder {
  id: string;
  number: string;
  status: LiveOrderStatus;
  statusLabel: string;
  paymentStatus: 'unpaid' | 'paid' | 'refund_pending' | 'partially_refunded' | 'refunded';
  items: { id: string; productId: string; slug: string; name: string; image: string | null; size: string; color: string; qty: number; price: number }[];
  address: Omit<SavedAddress, 'id' | 'isDefault'>;
  shippingMethod: 'standard' | 'express';
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  refunded: number;
  coupon: string | null;
  paymentMethod: string | null;
  paymentRef: string | null;
  tracking: { courier?: string; awb?: string; url?: string } | null;
  cancelReason: string | null;
  expiresAt: string | null;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  receipt: { number: string; issuedAt: string; ready: boolean; url: string } | null;
  canCancel: boolean;
  canPay: boolean;
  canReturn: boolean;
  returnWindowEndsAt: string | null;
  returns?: LiveReturn[];
}
export interface LiveReturn {
  id: string;
  orderId: string;
  orderNumber?: string;
  status: string;
  statusLabel: string;
  reason: string;
  items: { itemId: string; name: string; size: string; qty: number; price: number }[];
  refund: number;
  adminNote: string | null;
  createdAt: string;
}
export const orders = {
  checkout: (addressId: string, shippingMethod: 'standard' | 'express', idempotencyKey: string) =>
    req<{ order: LiveOrder; payment: CheckoutPayment | null; paymentError?: string }>('POST', '/api/orders/checkout', { addressId, shippingMethod }, { headers: { 'idempotency-key': idempotencyKey } }),
  pay: (id: string) => req<{ payment: CheckoutPayment }>('POST', `/api/orders/${id}/pay`),
  list: () => req<{ items: LiveOrder[] }>('GET', '/api/orders').then((r) => r.items),
  get: (id: string) => req<LiveOrder>('GET', `/api/orders/${id}`),
  cancel: (id: string, reason?: string) => req<LiveOrder>('POST', `/api/orders/${id}/cancel`, { reason }),
  requestReturn: (id: string, items: { itemId: string; qty: number }[], reason: string) => req<LiveReturn>('POST', `/api/orders/${id}/returns`, { items, reason }),
  receipt: (o: Pick<LiveOrder, 'id' | 'number'>) => openPdf(`/api/orders/${o.id}/receipt`, `Aribas-Receipt-${o.number}.pdf`),
};

export const payments = {
  verify: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    req<{ orderId: string; status: 'paid' | 'processing' | 'failed' | 'attention'; message?: string }>('POST', '/api/payments/verify', r),
  mockPay: (providerOrderId: string, outcome: 'success' | 'failure') =>
    req<{ razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; status: string }>('POST', '/api/payments/mock/pay', { providerOrderId, outcome }),
};

export const reviews = {
  list: (productId: string) => req<{ items: { id: string; author: string; rating: number; title: string; body: string; date: string }[]; count: number; average: number }>('GET', `/api/reviews?productId=${productId}`),
  create: (r: { productId: string; rating: number; title: string; body: string }) => req('POST', '/api/reviews', r),
};

// ───────────────────────── catalogue ─────────────────────────
type ApiProduct = Omit<Product, 'art' | 'rating' | 'reviewCount' | 'reviews' | 'sizes'> & { sizes: string[]; variants: { size: string; stock: number }[] };

const ART: Record<string, Product['art']> = {
  anarkali: { pattern: 'booti', silhouette: 'anarkali', bottom: 'pant' },
  sharara: { pattern: 'booti', silhouette: 'aline', bottom: 'sharara' },
  palazzo: { pattern: 'booti', silhouette: 'aline', bottom: 'palazzo' },
  patiala: { pattern: 'booti', silhouette: 'straight', bottom: 'patiala' },
};

export const toProduct = (p: ApiProduct): Product => ({
  ...p,
  sizes: p.sizes as Size[],
  colors: p.colors.length ? p.colors.map((c) => ({ ...c, accent: c.accent ?? '#E3C48F' })) : [{ name: 'As shown', hex: '#6E0F1C', accent: '#E3C48F' }],
  art: ART[p.category] ?? { pattern: 'booti', silhouette: 'straight', bottom: 'pant' },
  rating: 0,
  reviewCount: 0,
  reviews: [],
});

export const catalogue = {
  list: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
    return req<{ items: ApiProduct[]; total: number; page: number; pageSize: number; totalPages: number }>('GET', `/api/products?${qs}`).then((r) => ({ ...r, items: r.items.map(toProduct) }));
  },
  bySlug: (slug: string) =>
    req<ApiProduct>('GET', `/api/products/${encodeURIComponent(slug)}`)
      .then(toProduct)
      .catch((e) => {
        if (e instanceof BackendError && e.status === 404) return null;
        throw e;
      }),
};

// ───────────────────────── admin ─────────────────────────
export interface AdminOrder extends LiveOrder {
  customer: { id: string; phone?: string; name?: string };
  needsAttention: string | null;
}
export interface AdminOrderDetail extends AdminOrder {
  notifications: { kind: string; status: string; attempts: number; error: string | null; sentAt: string | null; createdAt: string }[];
  returns: LiveReturn[];
  payments:
    | { id: string; providerOrderId: string; providerPaymentId: string | null; amount: number; status: string; method: string | null; lastError: string | null; capturedAt: string | null;
        attempts: { providerPaymentId: string; amount: number; status: string; method: string | null; duplicate: boolean; error: string | null; at: string }[] }[]
    | null;
  refunds: { id: string; key: string; amount: number; reason: string; status: string; providerRefundId: string | null; lastError: string | null; createdAt: string }[] | null;
}
export interface AdminProduct {
  id: string; slug: string; name: string; category: string; fabric: string; occasion: string; price: number; mrp: number;
  colors: { name: string; hex: string; accent?: string }[]; images: string[]; video?: string; description: string;
  highlights: string[]; includes: string[]; care: string[]; variants: { size: string; stock: number }[]; stock: number;
  isNew: boolean; isBestseller: boolean; active: boolean;
}
const qs = (o: Record<string, string | number | undefined>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();

export const admin = {
  overview: () => req<{ orders_today: number; revenue30d: number; to_ship: number; needs_attention: number; open_returns: number; failed_messages: number; customers: number }>('GET', '/api/admin/overview'),
  orders: (f: { status?: string; q?: string; attention?: boolean; page?: number }) =>
    req<{ items: AdminOrder[] }>('GET', `/api/admin/orders?${qs({ ...f, attention: f.attention ? '1' : undefined })}`).then((r) => r.items),
  order: (id: string) => req<AdminOrderDetail>('GET', `/api/admin/orders/${id}`),
  setStatus: (id: string, status: 'packed' | 'shipped' | 'delivered', tracking?: { courier?: string; awb?: string; url?: string }) => req<AdminOrder>('PATCH', `/api/admin/orders/${id}/status`, { status, tracking }),
  cancel: (id: string, reason: string) => req<AdminOrder>('POST', `/api/admin/orders/${id}/cancel`, { reason }),
  resolve: (id: string) => req('POST', `/api/admin/orders/${id}/resolve`),
  resendReceipt: (id: string) => req('POST', `/api/admin/orders/${id}/resend-receipt`),
  receipt: (o: { id: string; number: string }) => openPdf(`/api/admin/orders/${o.id}/receipt`, `Aribas-Receipt-${o.number}.pdf`),
  checkPayment: (paymentId: string) => req('POST', `/api/admin/payments/${paymentId}/check`),
  retryRefund: (refundId: string) => req('POST', `/api/admin/refunds/${refundId}/retry`),
  users: (q?: string, page?: number) => req<{ items: (LiveUser & { orders: number; spent: number; lastLoginAt: string | null })[] }>('GET', `/api/admin/users?${qs({ q, page })}`).then((r) => r.items),
  user: (id: string) => req<{ user: LiveUser & { lastLoginAt: string | null }; addresses: SavedAddress[]; orders: AdminOrder[]; returns: LiveReturn[] }>('GET', `/api/admin/users/${id}`),
  returns: (status?: string) => req<{ items: (LiveReturn & { customer: { phone: string; name: string } })[] }>('GET', `/api/admin/returns?${qs({ status })}`).then((r) => r.items),
  returnAction: (id: string, action: 'approve' | 'reject' | 'received', note?: string) => req<LiveReturn>('PATCH', `/api/admin/returns/${id}`, { action, note }),
  products: () => req<{ items: AdminProduct[] }>('GET', '/api/admin/products').then((r) => r.items),
  saveProduct: (id: string | null, body: Record<string, unknown>) => (id ? req<AdminProduct>('PATCH', `/api/admin/products/${id}`, body) : req<AdminProduct>('POST', '/api/admin/products', body)),
  failedRefunds: () => req<{ items: { id: string; key: string; orderId: string; amount: number; lastError: string | null }[] }>('GET', '/api/admin/refunds?status=failed').then((r) => r.items),
};
