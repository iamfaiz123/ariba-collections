import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import { config } from '../../config.js';
import { query, one, tx } from '../../lib/db.js';
import { requireAdmin, requireInternal, requireUser } from '../../lib/auth.js';
import { badRequest, conflict, forbidden, notFound, unavailable } from '../../lib/errors.js';
import { enqueue, Q, queue, work, type PaymentCapturedJob, type RefundedJob, type RefundJob } from '../../lib/queue.js';
import { rupees, sha256 } from '../../lib/util.js';
import { GatewayRejected, mockGateway, provider, type GatewayPayment, type GatewayRefund } from './provider.js';

/**
 * Payment service. Fault-tolerance rules:
 *  1. Our database is the source of truth; the gateway is asked, never trusted blindly
 *     (browser callbacks are signature-checked, webhooks are signature-checked).
 *  2. Three independent paths can confirm a payment — browser callback, webhook, reconciliation
 *     poll — and all funnel into recordCapture(), which is idempotent.
 *  3. Follow-up work (confirm order, refunds) is queued in the same transaction as the state
 *     change, so a crash can never leave "captured but nobody told the order service".
 */

const log = (msg: string, extra?: object) => console.log(`[payments] ${msg}`, extra ? JSON.stringify(extra) : '');

interface PaymentRow {
  id: string;
  order_id: string;
  order_number: string;
  user_id: string;
  provider_order_id: string;
  amount_paise: number;
  status: 'created' | 'captured' | 'attention';
  provider_payment_id: string | null;
}

/** The single place a gateway payment becomes "captured" in our books. Safe to call any number of times. */
export async function recordCapture(gp: GatewayPayment): Promise<'captured' | 'duplicate' | 'already' | 'mismatch' | 'unknown'> {
  return tx(async (client) => {
    const pay = await one<PaymentRow>('SELECT * FROM payments.payments WHERE provider_order_id = $1 FOR UPDATE', [gp.orderId], client);
    if (!pay) return 'unknown';
    const seen = await one('SELECT status FROM payments.transactions WHERE provider_payment_id = $1', [gp.id], client);
    if (seen?.status === 'captured') return 'already';
    await client.query(
      `INSERT INTO payments.transactions (provider_payment_id, payment_id, amount_paise, status, method) VALUES ($1, $2, $3, 'captured', $4)
       ON CONFLICT (provider_payment_id) DO UPDATE SET status = 'captured', method = EXCLUDED.method, updated_at = now()`,
      [gp.id, pay.id, gp.amountPaise, gp.method],
    );

    if (gp.amountPaise !== pay.amount_paise) {
      await client.query(`UPDATE payments.payments SET status = 'attention', last_error = $2, updated_at = now() WHERE id = $1`, [
        pay.id,
        `Amount mismatch: paid ${gp.amountPaise}, expected ${pay.amount_paise} (payment ${gp.id})`,
      ]);
      log('amount mismatch — needs admin', { order: pay.order_number, payment: gp.id });
      return 'mismatch';
    }

    if (pay.status === 'captured' && pay.provider_payment_id !== gp.id) {
      // Customer paid twice for the same order: give the second payment back.
      await client.query('UPDATE payments.transactions SET is_duplicate = true WHERE provider_payment_id = $1', [gp.id]);
      await enqueue(Q.refund, { key: `duplicate:${gp.id}`, orderId: pay.order_id, amountPaise: gp.amountPaise, reason: 'Duplicate payment', providerPaymentId: gp.id } satisfies RefundJob, {
        client,
        singletonKey: `duplicate:${gp.id}`,
      });
      log('duplicate payment — refund queued', { order: pay.order_number, payment: gp.id });
      return 'duplicate';
    }
    if (pay.status === 'captured') return 'already';

    await client.query(
      `UPDATE payments.payments SET status = 'captured', provider_payment_id = $2, method = $3, captured_at = now(), last_error = NULL, updated_at = now() WHERE id = $1`,
      [pay.id, gp.id, gp.method],
    );
    await enqueue(Q.paymentCaptured, { orderId: pay.order_id, amountPaise: gp.amountPaise, method: gp.method, providerPaymentId: gp.id } satisfies PaymentCapturedJob, {
      client,
      singletonKey: `captured:${pay.order_id}`,
    });
    log('captured', { order: pay.order_number, payment: gp.id });
    return 'captured';
  });
}

async function recordFailure(gp: GatewayPayment) {
  const pay = await one<PaymentRow>('SELECT * FROM payments.payments WHERE provider_order_id = $1', [gp.orderId]);
  if (!pay) return;
  await query(
    `INSERT INTO payments.transactions (provider_payment_id, payment_id, amount_paise, status, method, error) VALUES ($1, $2, $3, 'failed', $4, $5)
     ON CONFLICT (provider_payment_id) DO NOTHING`,
    [gp.id, pay.id, gp.amountPaise, gp.method, gp.error],
  );
}

/** Ask the gateway about one gateway order and record whatever happened. */
async function syncOrder(providerOrderId: string) {
  const payments = await provider.orderPayments(providerOrderId);
  let captured = false;
  for (let gp of payments) {
    if (gp.status === 'authorized') gp = await provider.capture(gp.id, gp.amountPaise);
    if (gp.status === 'captured' || gp.status === 'refunded') {
      await recordCapture({ ...gp, status: 'captured' });
      captured = true;
    } else if (gp.status === 'failed') await recordFailure(gp);
  }
  await query('UPDATE payments.payments SET last_checked_at = now() WHERE provider_order_id = $1', [providerOrderId]);
  return captured;
}

async function applyRefundState(client: pg.PoolClient, refundRowId: string, r: GatewayRefund | { status: 'failed'; error: string }) {
  const row = await one('SELECT * FROM payments.refunds WHERE id = $1 FOR UPDATE', [refundRowId], client);
  if (!row || row.status !== 'pending') return;
  if (r.status === 'pending') {
    await client.query('UPDATE payments.refunds SET provider_refund_id = $2, updated_at = now() WHERE id = $1', [row.id, (r as GatewayRefund).id]);
    return;
  }
  const failed = r.status === 'failed';
  await client.query(
    `UPDATE payments.refunds SET status = $2, provider_refund_id = COALESCE($3, provider_refund_id), last_error = $4, updated_at = now() WHERE id = $1`,
    [row.id, r.status, 'id' in r ? r.id : null, failed ? ('error' in r ? r.error : 'Refund failed at gateway') : null],
  );
  await enqueue(Q.refunded, { key: row.key, orderId: row.order_id, amountPaise: row.amount_paise, status: failed ? 'failed' : 'processed' } satisfies RefundedJob, {
    client,
    singletonKey: `refunded:${row.key}`,
  });
  log(failed ? 'refund failed — needs admin' : 'refund processed', { key: row.key });
}

async function processRefund(d: RefundJob) {
  let row = await one('SELECT * FROM payments.refunds WHERE key = $1', [d.key]);
  if (!row) {
    const pay = await one<PaymentRow>('SELECT * FROM payments.payments WHERE order_id = $1', [d.orderId]);
    const paymentId = d.providerPaymentId ?? pay?.provider_payment_id;
    if (!paymentId) throw new Error(`No captured payment yet for order ${d.orderId}; will retry`);
    row = await one(
      `INSERT INTO payments.refunds (key, order_id, provider_payment_id, amount_paise, reason) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO UPDATE SET updated_at = now() RETURNING *`,
      [d.key, d.orderId, paymentId, d.amountPaise, d.reason],
    );
  }
  if (row.status !== 'pending') return;
  await query('UPDATE payments.refunds SET attempts = attempts + 1, updated_at = now() WHERE id = $1', [row.id]);

  let r: GatewayRefund | undefined;
  if (row.provider_refund_id) r = await provider.getRefund(row.provider_payment_id, row.provider_refund_id);
  // A previous attempt may have reached the gateway and crashed before saving: look for our key first.
  r ??= (await provider.listRefunds(row.provider_payment_id)).find((x) => x.notes?.refund_key === row.key);
  if (!r) {
    try {
      r = await provider.refund(row.provider_payment_id, row.amount_paise, { refund_key: row.key, order_id: row.order_id });
    } catch (err) {
      if (err instanceof GatewayRejected) {
        await tx((c) => applyRefundState(c, row.id, { status: 'failed', error: err.message }));
        return;
      }
      await query('UPDATE payments.refunds SET last_error = $2 WHERE id = $1', [row.id, String((err as Error).message)]);
      throw err; // network/5xx: retry with backoff
    }
  }
  await tx((c) => applyRefundState(c, row.id, r!));
}

async function handleWebhook(eventId: string) {
  const ev = await one('SELECT * FROM payments.webhook_events WHERE id = $1', [eventId]);
  if (!ev || ev.processed_at) return;
  const p = ev.payload?.payload ?? {};
  const pe = p.payment?.entity;
  const gp: GatewayPayment | null = pe
    ? { id: pe.id, orderId: pe.order_id, amountPaise: pe.amount, status: pe.status, method: pe.method ?? null, error: pe.error_description ?? null }
    : null;
  try {
    switch (ev.event) {
      case 'payment.captured':
      case 'order.paid':
        if (gp) await recordCapture({ ...gp, status: 'captured' });
        break;
      case 'payment.authorized':
        if (gp) {
          const captured = await provider.capture(gp.id, gp.amountPaise);
          if (captured.status === 'captured') await recordCapture(captured);
        }
        break;
      case 'payment.failed':
        if (gp) await recordFailure(gp);
        break;
      case 'refund.processed':
      case 'refund.failed': {
        const re = p.refund?.entity;
        if (!re) break;
        const row = await one('SELECT id FROM payments.refunds WHERE provider_refund_id = $1 OR key = $2', [re.id, re.notes?.refund_key ?? '']);
        if (row)
          await tx((c) =>
            applyRefundState(c, row.id, ev.event === 'refund.failed' ? { status: 'failed', error: 'Refund failed at gateway' } : { id: re.id, paymentId: re.payment_id, amountPaise: re.amount, status: 'processed', notes: re.notes ?? {} }),
          );
        break;
      }
    }
    await query('UPDATE payments.webhook_events SET processed_at = now(), error = NULL WHERE id = $1', [eventId]);
  } catch (err) {
    await query('UPDATE payments.webhook_events SET error = $2 WHERE id = $1', [eventId, String((err as Error).message)]);
    throw err;
  }
}

/** Polls the gateway for anything unfinished. Catches every missed webhook and closed browser tab. */
export async function reconcile(onlyPaymentId?: string) {
  const pending = onlyPaymentId
    ? await query<PaymentRow>(`SELECT * FROM payments.payments WHERE id = $1 AND status = 'created'`, [onlyPaymentId])
    : await query<PaymentRow>(
        `SELECT * FROM payments.payments WHERE status = 'created'
           AND created_at > now() - interval '48 hours' AND created_at < now() - interval '1 minute'
           AND (last_checked_at IS NULL OR last_checked_at < now() - interval '3 minutes')
         ORDER BY created_at LIMIT 100`,
      );
  for (const p of pending) {
    try {
      await syncOrder(p.provider_order_id);
    } catch (err) {
      log('reconcile failed for order', { order: p.order_number, error: String((err as Error).message) });
    }
  }
  if (onlyPaymentId) return;
  // Refunds that started but haven't finished.
  const refunds = await query(`SELECT * FROM payments.refunds WHERE status = 'pending' AND updated_at < now() - interval '10 minutes' LIMIT 100`);
  for (const r of refunds) {
    await enqueue(Q.refund, { key: r.key, orderId: r.order_id, amountPaise: r.amount_paise, reason: r.reason, providerPaymentId: r.provider_payment_id } satisfies RefundJob, {
      singletonKey: r.key,
    });
  }
}

const paymentApi = (p: any) => ({
  id: p.id,
  orderId: p.order_id,
  orderNumber: p.order_number,
  provider: p.provider,
  providerOrderId: p.provider_order_id,
  providerPaymentId: p.provider_payment_id,
  amount: rupees(p.amount_paise),
  status: p.status,
  method: p.method,
  lastError: p.last_error,
  capturedAt: p.captured_at,
  createdAt: p.created_at,
});
const refundApi = (r: any) => ({
  id: r.id,
  key: r.key,
  orderId: r.order_id,
  providerPaymentId: r.provider_payment_id,
  providerRefundId: r.provider_refund_id,
  amount: rupees(r.amount_paise),
  reason: r.reason,
  status: r.status,
  attempts: r.attempts,
  lastError: r.last_error,
  createdAt: r.created_at,
});

export async function paymentsService(app: FastifyInstance, opts: { workers: boolean }) {
  /** Browser callback after Razorpay Checkout succeeds. Fast path; the webhook and poller back it up. */
  app.post('/api/payments/verify', { preHandler: requireUser }, async (req) => {
    const b = z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }).parse(req.body);
    const pay = await one<PaymentRow>('SELECT * FROM payments.payments WHERE provider_order_id = $1', [b.razorpay_order_id]);
    if (!pay) throw notFound('Payment');
    if (pay.user_id !== req.user!.id) throw forbidden();
    if (!provider.verifyCheckoutSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) throw badRequest('Payment signature is invalid.');
    try {
      let gp = await provider.getPayment(b.razorpay_payment_id);
      if (gp.orderId !== b.razorpay_order_id) throw badRequest('Payment does not belong to this order.');
      if (gp.status === 'authorized') gp = await provider.capture(gp.id, gp.amountPaise);
      if (gp.status === 'captured') {
        const r = await recordCapture(gp);
        return { orderId: pay.order_id, status: r === 'mismatch' ? 'attention' : 'paid' };
      }
      if (gp.status === 'failed') return { orderId: pay.order_id, status: 'failed', message: gp.error ?? 'Payment failed.' };
    } catch (err) {
      if ((err as any)?.statusCode === 400 || (err as any)?.status === 400) throw err;
      // Gateway unreachable: the signature already proves the customer paid; the poller will finish it.
      await enqueue(Q.reconcile, { paymentId: pay.id }, { startAfter: 20 });
    }
    return { orderId: pay.order_id, status: 'processing' };
  });

  /**
   * Razorpay webhooks. We only verify, store and acknowledge here (fast 200);
   * processing happens in a queued job. If the database is down we return 500 and Razorpay retries.
   */
  app.post('/api/payments/webhook', async (req, reply) => {
    const raw = req.rawBody ?? Buffer.from('');
    if (!provider.verifyWebhookSignature(raw, String(req.headers['x-razorpay-signature'] ?? ''))) {
      reply.code(400);
      return { error: { code: 'bad_signature', message: 'Invalid signature' } };
    }
    const body = req.body as any;
    const eventId = String(req.headers['x-razorpay-event-id'] ?? '') || 'sha_' + sha256(raw.toString('utf8'));
    await query(`INSERT INTO payments.webhook_events (id, event, payload) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`, [eventId, String(body?.event ?? ''), body]);
    await enqueue(Q.webhook, { eventId }, { singletonKey: eventId });
    return { ok: true };
  });

  // ── admin ──
  app.get('/api/admin/payments', { preHandler: requireAdmin }, async (req) => {
    const q = z.object({ status: z.enum(['created', 'captured', 'attention']).optional(), page: z.coerce.number().int().min(1).default(1) }).parse(req.query);
    const rows = await query(
      `SELECT * FROM payments.payments WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC LIMIT 50 OFFSET $2`,
      [q.status ?? null, (q.page - 1) * 50],
    );
    return { items: rows.map(paymentApi) };
  });

  app.get('/api/admin/refunds', { preHandler: requireAdmin }, async (req) => {
    const q = z.object({ status: z.enum(['pending', 'processed', 'failed']).optional() }).parse(req.query);
    const rows = await query(`SELECT * FROM payments.refunds WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC LIMIT 100`, [q.status ?? null]);
    return { items: rows.map(refundApi) };
  });

  /** "Check with Razorpay now" button. */
  app.post('/api/admin/payments/:id/check', { preHandler: requireAdmin }, async (req) => {
    const pay = await one<PaymentRow>('SELECT * FROM payments.payments WHERE id = $1', [(req.params as any).id]);
    if (!pay) throw notFound('Payment');
    await syncOrder(pay.provider_order_id);
    return paymentApi(await one('SELECT * FROM payments.payments WHERE id = $1', [pay.id]));
  });

  /** Retry a refund that failed at the gateway (after fixing the cause). */
  app.post('/api/admin/refunds/:id/retry', { preHandler: requireAdmin }, async (req) => {
    const r = await one(`UPDATE payments.refunds SET status = 'pending', last_error = NULL, updated_at = now() WHERE id = $1 AND status = 'failed' RETURNING *`, [(req.params as any).id]);
    if (!r) throw conflict('not_failed', 'Only failed refunds can be retried.');
    await enqueue(Q.refund, { key: r.key, orderId: r.order_id, amountPaise: r.amount_paise, reason: r.reason, providerPaymentId: r.provider_payment_id } satisfies RefundJob);
    return refundApi(r);
  });

  // ── internal ──
  app.register(async (internal) => {
    internal.addHook('preHandler', requireInternal);

    /** Create (or return the existing) gateway order for a shop order. */
    internal.post('/internal/payments', async (req) => {
      const b = z
        .object({ orderId: z.string().uuid(), orderNumber: z.string(), userId: z.string().uuid(), amountPaise: z.number().int().positive(), customer: z.object({ name: z.string(), phone: z.string() }) })
        .parse(req.body);
      const params = (p: PaymentRow) => ({ provider: provider.name, keyId: provider.keyId, providerOrderId: p.provider_order_id, amountPaise: p.amount_paise, currency: 'INR' as const });
      const existing = await one<PaymentRow>('SELECT * FROM payments.payments WHERE order_id = $1', [b.orderId]);
      if (existing) {
        if (existing.status !== 'created') throw conflict('already_paid', 'This order has already been paid.');
        if (existing.amount_paise !== b.amountPaise) throw conflict('amount_changed', 'Order amount changed; please check out again.');
        return params(existing);
      }
      let gwOrder: { id: string };
      try {
        gwOrder = await provider.createOrder({ amountPaise: b.amountPaise, receipt: b.orderNumber, notes: { order_id: b.orderId, order_number: b.orderNumber } });
      } catch (err) {
        log('createOrder failed', { order: b.orderNumber, error: String((err as Error).message) });
        throw unavailable('Payments are temporarily unavailable. Your order is saved — please try paying again in a minute.');
      }
      const row =
        (await one<PaymentRow>(
          `INSERT INTO payments.payments (order_id, order_number, user_id, provider, provider_order_id, amount_paise) VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (order_id) DO NOTHING RETURNING *`,
          [b.orderId, b.orderNumber, b.userId, provider.name, gwOrder.id, b.amountPaise],
        )) ?? (await one<PaymentRow>('SELECT * FROM payments.payments WHERE order_id = $1', [b.orderId]))!;
      return params(row);
    });

    internal.get('/internal/payments/order/:orderId', async (req) => {
      const orderId = (req.params as any).orderId;
      const payments = await query('SELECT * FROM payments.payments WHERE order_id = $1', [orderId]);
      const transactions = payments.length
        ? await query('SELECT * FROM payments.transactions WHERE payment_id = $1 ORDER BY created_at', [payments[0].id])
        : [];
      const refunds = await query('SELECT * FROM payments.refunds WHERE order_id = $1 ORDER BY created_at', [orderId]);
      return {
        payments: payments.map((p) => ({
          ...paymentApi(p),
          attempts: transactions.map((t) => ({ providerPaymentId: t.provider_payment_id, amount: rupees(t.amount_paise), status: t.status, method: t.method, duplicate: t.is_duplicate, error: t.error, at: t.created_at })),
        })),
        refunds: refunds.map(refundApi),
      };
    });
  });

  // ── local testing only: pretend to be the customer + Razorpay ──
  if (config.PAYMENT_PROVIDER === 'mock' && !config.isProd) {
    app.post('/api/payments/mock/pay', async (req) => {
      const b = z.object({ providerOrderId: z.string(), outcome: z.enum(['success', 'failure']).default('success'), sendWebhook: z.boolean().default(true), method: z.string().default('upi') }).parse(req.body);
      const { payment, signature } = mockGateway.pay(b.providerOrderId, { fail: b.outcome === 'failure', method: b.method });
      if (b.sendWebhook) {
        const wh = mockGateway.webhook(payment.status === 'captured' ? 'payment.captured' : 'payment.failed', { payment });
        await app.inject({ method: 'POST', url: '/api/payments/webhook', payload: wh.body, headers: { 'content-type': 'application/json', 'x-razorpay-signature': wh.signature, 'x-razorpay-event-id': wh.eventId } });
      }
      return { razorpay_order_id: b.providerOrderId, razorpay_payment_id: payment.id, razorpay_signature: signature, status: payment.status };
    });
  }

  if (opts.workers) {
    await work<{ eventId: string }>(Q.webhook, (d) => handleWebhook(d.eventId), { concurrency: 4 });
    await work<RefundJob>(Q.refund, processRefund);
    await work<{ paymentId?: string }>(Q.reconcile, (d) => reconcile(d?.paymentId));
    await queue().schedule(Q.reconcile, '*/5 * * * *');
  }
}
