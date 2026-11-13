import { randomBytes } from 'node:crypto';
import { config } from '../../config.js';
import { fetchJson, HttpError } from '../../lib/fetch.js';
import { hmacHex, safeEqualHex } from '../../lib/util.js';

/** What the payment service needs from a gateway. Razorpay today; another gateway would implement the same. */
export interface GatewayPayment {
  id: string;
  orderId: string;
  amountPaise: number;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  method: string | null;
  error: string | null;
}
export interface GatewayRefund {
  id: string;
  paymentId: string;
  amountPaise: number;
  status: 'pending' | 'processed' | 'failed';
  notes: Record<string, string>;
}
export interface PaymentProvider {
  name: 'razorpay' | 'mock';
  keyId: string;
  createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<{ id: string }>;
  orderPayments(providerOrderId: string): Promise<GatewayPayment[]>;
  getPayment(paymentId: string): Promise<GatewayPayment>;
  capture(paymentId: string, amountPaise: number): Promise<GatewayPayment>;
  refund(paymentId: string, amountPaise: number, notes: Record<string, string>): Promise<GatewayRefund>;
  listRefunds(paymentId: string): Promise<GatewayRefund[]>;
  getRefund(paymentId: string, refundId: string): Promise<GatewayRefund>;
  /** Checks the signature Razorpay Checkout returns to the browser after payment. */
  verifyCheckoutSignature(providerOrderId: string, paymentId: string, signature: string): boolean;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}

/** Thrown when the gateway rejected the request itself (4xx) — retrying won't help. */
export class GatewayRejected extends Error {}

/**
 * Circuit breaker: after 5 straight failures, fail fast for 30s instead of making every
 * customer wait for a timeout. One success closes it again.
 */
function breaker<T extends object>(target: T): T {
  let failures = 0;
  let openUntil = 0;
  return new Proxy(target, {
    get(obj, prop, recv) {
      const v = Reflect.get(obj, prop, recv);
      if (typeof v !== 'function' || String(prop).startsWith('verify')) return v;
      return async (...args: unknown[]) => {
        if (Date.now() < openUntil) throw new Error('Payment gateway temporarily unavailable (circuit open)');
        try {
          const out = await v.apply(obj, args);
          failures = 0;
          return out;
        } catch (err) {
          if (!(err instanceof GatewayRejected) && ++failures >= 5) openUntil = Date.now() + 30_000;
          throw err;
        }
      };
    },
  });
}

// ───────────────────────── Razorpay ─────────────────────────
const mapPayment = (p: any): GatewayPayment => ({
  id: p.id,
  orderId: p.order_id,
  amountPaise: p.amount,
  status: p.status,
  method: p.method ?? null,
  error: p.error_description ?? null,
});
const mapRefund = (r: any): GatewayRefund => ({ id: r.id, paymentId: r.payment_id, amountPaise: r.amount, status: r.status, notes: r.notes ?? {} });

function razorpay(): PaymentProvider {
  const auth = 'Basic ' + Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64');
  const api = async <T>(method: string, path: string, body?: unknown, retries = 2): Promise<T> => {
    try {
      return await fetchJson<T>(config.RAZORPAY_API_URL + path, { method, body, headers: { authorization: auth }, timeoutMs: 10_000, retries });
    } catch (err) {
      if (err instanceof HttpError && err.status >= 400 && err.status < 500 && err.status !== 429)
        throw new GatewayRejected(`Razorpay ${method} ${path}: ${JSON.stringify((err.body as any)?.error?.description ?? err.body)}`);
      throw err;
    }
  };
  return {
    name: 'razorpay',
    keyId: config.RAZORPAY_KEY_ID,
    async createOrder({ amountPaise, receipt, notes }) {
      // Creating an extra unpaid Razorpay order on a retry is harmless (it simply never gets paid).
      return api<{ id: string }>('POST', '/orders', { amount: amountPaise, currency: 'INR', receipt, notes }, 1);
    },
    async orderPayments(id) {
      const r = await api<{ items: any[] }>('GET', `/orders/${id}/payments`);
      return r.items.map(mapPayment);
    },
    async getPayment(id) {
      return mapPayment(await api('GET', `/payments/${id}`));
    },
    async capture(id, amountPaise) {
      try {
        return mapPayment(await api('POST', `/payments/${id}/capture`, { amount: amountPaise, currency: 'INR' }, 0));
      } catch (err) {
        // Already captured (e.g. auto-capture won the race) → just read it.
        if (err instanceof GatewayRejected) return mapPayment(await api('GET', `/payments/${id}`));
        throw err;
      }
    },
    async refund(paymentId, amountPaise, notes) {
      // Not retried here: the refund job checks listRefunds() for our key before any new attempt.
      return mapRefund(await api('POST', `/payments/${paymentId}/refund`, { amount: amountPaise, speed: 'normal', notes }, 0));
    },
    async listRefunds(paymentId) {
      const r = await api<{ items: any[] }>('GET', `/payments/${paymentId}/refunds?count=100`);
      return r.items.map(mapRefund);
    },
    async getRefund(paymentId, refundId) {
      return mapRefund(await api('GET', `/payments/${paymentId}/refunds/${refundId}`));
    },
    verifyCheckoutSignature(orderId, paymentId, signature) {
      return safeEqualHex(hmacHex(config.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`), signature);
    },
    verifyWebhookSignature(rawBody, signature) {
      return !!config.RAZORPAY_WEBHOOK_SECRET && safeEqualHex(hmacHex(config.RAZORPAY_WEBHOOK_SECRET, rawBody), signature);
    },
  };
}

// ───────────────────────── Mock (local dev & tests) ─────────────────────────
export const MOCK_KEY_SECRET = 'mock_key_secret';
export const MOCK_WEBHOOK_SECRET = 'mock_webhook_secret';

/** In-memory stand-in for Razorpay. `down = true` simulates an outage. */
export const mockGateway = {
  down: false,
  orders: new Map<string, { id: string; amountPaise: number; receipt: string }>(),
  payments: new Map<string, GatewayPayment>(),
  refunds: new Map<string, GatewayRefund>(),
  /** Simulates a customer completing checkout. Returns what Razorpay Checkout hands the browser. */
  pay(providerOrderId: string, opts: { fail?: boolean; method?: string; amountPaise?: number } = {}) {
    const order = this.orders.get(providerOrderId);
    if (!order) throw new Error('unknown mock order');
    const id = 'pay_mock_' + randomBytes(6).toString('hex');
    const p: GatewayPayment = {
      id,
      orderId: providerOrderId,
      amountPaise: opts.amountPaise ?? order.amountPaise,
      status: opts.fail ? 'failed' : 'captured',
      method: opts.method ?? 'upi',
      error: opts.fail ? 'Payment declined by bank (mock)' : null,
    };
    this.payments.set(id, p);
    return { payment: p, signature: hmacHex(MOCK_KEY_SECRET, `${providerOrderId}|${id}`) };
  },
  /** Builds a Razorpay-shaped webhook body + signature for a payment or refund. */
  webhook(event: string, entity: { payment?: GatewayPayment; refund?: GatewayRefund }) {
    const payload: any = {};
    if (entity.payment) payload.payment = { entity: { id: entity.payment.id, order_id: entity.payment.orderId, amount: entity.payment.amountPaise, status: entity.payment.status, method: entity.payment.method, error_description: entity.payment.error } };
    if (entity.refund) payload.refund = { entity: { id: entity.refund.id, payment_id: entity.refund.paymentId, amount: entity.refund.amountPaise, status: entity.refund.status, notes: entity.refund.notes } };
    const body = JSON.stringify({ entity: 'event', event, payload, created_at: Math.floor(Date.now() / 1000) });
    return { body, signature: hmacHex(MOCK_WEBHOOK_SECRET, body), eventId: 'evt_mock_' + randomBytes(6).toString('hex') };
  },
  reset() {
    this.down = false;
    this.orders.clear();
    this.payments.clear();
    this.refunds.clear();
  },
};

function mock(): PaymentProvider {
  const g = mockGateway;
  const check = () => {
    if (g.down) throw new Error('mock gateway is down');
  };
  const payment = (id: string) => {
    const p = g.payments.get(id);
    if (!p) throw new GatewayRejected('unknown payment');
    return p;
  };
  return {
    name: 'mock',
    keyId: 'rzp_test_mock',
    async createOrder({ amountPaise, receipt }) {
      check();
      const id = 'order_mock_' + randomBytes(6).toString('hex');
      g.orders.set(id, { id, amountPaise, receipt });
      return { id };
    },
    async orderPayments(id) {
      check();
      return [...g.payments.values()].filter((p) => p.orderId === id);
    },
    async getPayment(id) {
      check();
      return payment(id);
    },
    async capture(id) {
      check();
      const p = payment(id);
      if (p.status === 'authorized') p.status = 'captured';
      return p;
    },
    async refund(paymentId, amountPaise, notes) {
      check();
      const p = payment(paymentId);
      const already = [...g.refunds.values()].filter((r) => r.paymentId === paymentId).reduce((s, r) => s + r.amountPaise, 0);
      if (already + amountPaise > p.amountPaise) throw new GatewayRejected('refund amount exceeds payment');
      const r: GatewayRefund = { id: 'rfnd_mock_' + randomBytes(6).toString('hex'), paymentId, amountPaise, status: 'processed', notes };
      g.refunds.set(r.id, r);
      return r;
    },
    async listRefunds(paymentId) {
      check();
      return [...g.refunds.values()].filter((r) => r.paymentId === paymentId);
    },
    async getRefund(_p, refundId) {
      check();
      const r = g.refunds.get(refundId);
      if (!r) throw new GatewayRejected('unknown refund');
      return r;
    },
    verifyCheckoutSignature(orderId, paymentId, signature) {
      return safeEqualHex(hmacHex(MOCK_KEY_SECRET, `${orderId}|${paymentId}`), signature);
    },
    verifyWebhookSignature(rawBody, signature) {
      return safeEqualHex(hmacHex(MOCK_WEBHOOK_SECRET, rawBody), signature);
    },
  };
}

export const provider: PaymentProvider = breaker(config.PAYMENT_PROVIDER === 'razorpay' ? razorpay() : mock());
