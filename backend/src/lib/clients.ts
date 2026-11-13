import { config } from '../config.js';
import { AppError } from './errors.js';
import { fetchJson, HttpError, type FetchOptions } from './fetch.js';

/**
 * Typed service-to-service calls. Services only talk through these (or through queue events),
 * never through each other's tables, so any service can move to its own machine by setting its URL.
 */
async function call<T>(base: string, path: string, opts: FetchOptions = {}): Promise<T> {
  try {
    return await fetchJson<T>(base + path, {
      timeoutMs: 8000,
      ...opts,
      headers: { 'x-internal-token': config.INTERNAL_TOKEN, ...(opts.headers as any) },
    });
  } catch (err) {
    // Pass the other service's own error (e.g. 409 out of stock) through unchanged.
    if (err instanceof HttpError && err.body && typeof err.body === 'object' && 'error' in (err.body as any)) {
      const e = (err.body as any).error;
      throw new AppError(err.status, e.code, e.message, e.details);
    }
    throw new AppError(503, 'service_unavailable', 'A service is temporarily unavailable. Please try again.');
  }
}

export interface QuoteLine {
  productId: string;
  size: string;
  qty: number;
}
export interface QuotedLine extends QuoteLine {
  found: boolean;
  active: boolean;
  slug: string;
  name: string;
  image: string | null;
  category: string;
  unitPricePaise: number;
  mrpPaise: number;
  available: number;
}

export const productsClient = {
  quote: (items: QuoteLine[]) => call<{ items: QuotedLine[] }>(config.urls.products, '/internal/products/quote', { method: 'POST', body: { items }, retries: 2 }),
  reserve: (orderId: string, items: QuoteLine[], minutes: number) =>
    call<{ ok: true }>(config.urls.products, `/internal/reservations/${orderId}`, { method: 'POST', body: { items, minutes }, retries: 2 }),
  /** Turn the hold into a sale. If the hold already lapsed, tries to take the stock again. */
  commit: (orderId: string, items: QuoteLine[]) =>
    call<{ ok: boolean }>(config.urls.products, `/internal/reservations/${orderId}/commit`, { method: 'POST', body: { items }, retries: 2 }),
  release: (orderId: string) => call<{ ok: true }>(config.urls.products, `/internal/reservations/${orderId}/release`, { method: 'POST', body: {}, retries: 2 }),
  restock: (orderId: string) => call<{ ok: true }>(config.urls.products, `/internal/reservations/${orderId}/restock`, { method: 'POST', body: {}, retries: 2 }),
};

export interface PricedCart {
  cartId: string | null;
  lines: (QuotedLine & { itemId: string; color: string | null; linePaise: number; problem: string | null })[];
  couponCode: string | null;
  couponError: string | null;
  shippingMethod: 'standard' | 'express';
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
}

export const cartClient = {
  priced: (userId: string, shipping: 'standard' | 'express') =>
    call<PricedCart>(config.urls.cart, `/internal/carts/user/${userId}?shipping=${shipping}`, { retries: 2 }),
  merge: (userId: string, cartId: string) => call<{ ok: true }>(config.urls.cart, '/internal/carts/merge', { method: 'POST', body: { userId, cartId }, retries: 2 }),
};

export interface PaymentParams {
  provider: 'razorpay' | 'mock';
  keyId: string;
  providerOrderId: string;
  amountPaise: number;
  currency: 'INR';
}

export const paymentsClient = {
  create: (body: { orderId: string; orderNumber: string; userId: string; amountPaise: number; customer: { name: string; phone: string } }) =>
    call<PaymentParams>(config.urls.payments, '/internal/payments', { method: 'POST', body, timeoutMs: 15000, retries: 1 }),
  forOrder: (orderId: string) => call<{ payments: any[]; refunds: any[] }>(config.urls.payments, `/internal/payments/order/${orderId}`, { retries: 1 }),
};
