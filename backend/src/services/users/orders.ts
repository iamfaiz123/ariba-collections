import type { FastifyInstance, FastifyReply } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import { config } from '../../config.js';
import { query, one, tx } from '../../lib/db.js';
import { requireUser } from '../../lib/auth.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { cartClient, paymentsClient, productsClient, type PaymentParams } from '../../lib/clients.js';
import { enqueue, Q, queue, work, type NotifyJob, type PaymentCapturedJob, type RefundedJob, type RefundJob } from '../../lib/queue.js';
import { sendDocumentTemplate, sendTextTemplate } from '../../lib/whatsapp.js';
import { financialYear, formatInr, rupees } from '../../lib/util.js';
import { addressApi } from './auth.js';
import { renderReceipt } from './receipt.js';

const log = (msg: string, extra?: object) => console.log(`[orders] ${msg}`, extra ? JSON.stringify(extra) : '');

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export async function loadItems(orderIds: string[], db?: pg.PoolClient) {
  if (!orderIds.length) return new Map<string, any[]>();
  const rows = await query('SELECT * FROM users.order_items WHERE order_id = ANY($1) ORDER BY name, size', [orderIds], db);
  const map = new Map<string, any[]>();
  for (const r of rows) map.set(r.order_id, [...(map.get(r.order_id) ?? []), r]);
  return map;
}

const returnWindowEnds = (o: any) => (o.delivered_at ? new Date(new Date(o.delivered_at).getTime() + config.RETURN_WINDOW_DAYS * 86400_000) : null);

export function orderApi(o: any, items: any[], receipt?: { number: string; issued_at: string; pdf_ready?: boolean } | null) {
  const windowEnds = returnWindowEnds(o);
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    statusLabel: STATUS_LABEL[o.status],
    paymentStatus: o.payment_status,
    items: items.map((i) => ({ id: i.id, productId: i.product_id, slug: i.slug, name: i.name, image: i.image, size: i.size, color: i.color, qty: i.qty, price: rupees(i.unit_price_paise) })),
    address: o.address,
    shippingMethod: o.shipping_method,
    subtotal: rupees(o.subtotal_paise),
    discount: rupees(o.discount_paise),
    shippingFee: rupees(o.shipping_paise),
    total: rupees(o.total_paise),
    refunded: rupees(o.refunded_paise),
    coupon: o.coupon_code,
    paymentMethod: o.payment_method,
    paymentRef: o.payment_ref,
    tracking: o.tracking,
    cancelReason: o.cancel_reason,
    expiresAt: o.status === 'pending_payment' ? o.expires_at : null,
    createdAt: o.created_at,
    paidAt: o.paid_at,
    shippedAt: o.shipped_at,
    deliveredAt: o.delivered_at,
    cancelledAt: o.cancelled_at,
    receipt: receipt ? { number: receipt.number, issuedAt: receipt.issued_at, ready: receipt.pdf_ready !== false, url: `/api/orders/${o.id}/receipt` } : null,
    canCancel: ['pending_payment', 'confirmed', 'packed'].includes(o.status),
    canPay: o.status === 'pending_payment' && new Date(o.expires_at) > new Date(),
    canReturn: o.status === 'delivered' && !!windowEnds && windowEnds > new Date(),
    returnWindowEndsAt: windowEnds,
  };
}

export async function receiptMeta(orderId: string) {
  return one(`SELECT number, issued_at, pdf IS NOT NULL AS pdf_ready FROM users.receipts WHERE order_id = $1`, [orderId]);
}

export async function sendReceiptPdf(reply: FastifyReply, orderId: string) {
  const r = await one('SELECT r.number, r.pdf FROM users.receipts r WHERE r.order_id = $1', [orderId]);
  if (!r) throw notFound('Receipt');
  if (!r.pdf) throw conflict('receipt_pending', 'Your receipt is being prepared. Please try again in a minute.');
  reply.header('content-type', 'application/pdf');
  reply.header('content-disposition', `inline; filename="Aribas-Receipt-${r.number.replace(/\//g, '-')}.pdf"`);
  reply.header('cache-control', 'private, max-age=3600');
  return reply.send(r.pdf);
}

async function paymentParams(order: any, user: any): Promise<PaymentParams> {
  return paymentsClient.create({
    orderId: order.id,
    orderNumber: order.number,
    userId: order.user_id,
    amountPaise: order.total_paise,
    customer: { name: user.name || order.address.fullName, phone: user.phone },
  });
}

const checkoutParams = (p: PaymentParams, order: any, user: any) => ({
  ...p,
  name: config.BUSINESS_NAME,
  description: `Order ${order.number}`,
  prefill: { name: user.name || order.address.fullName, contact: user.phone, email: user.email || undefined },
});

/** Cancel an order. Paid orders are refunded in full (minus anything already refunded) and their stock restocked. */
export async function cancelOrder(orderId: string, reason: string, by: { userId?: string }) {
  const result = await tx(async (client) => {
    const o = await one('SELECT * FROM users.orders WHERE id = $1 FOR UPDATE', [orderId], client);
    if (!o || (by.userId && o.user_id !== by.userId)) throw notFound('Order');
    if (o.status === 'cancelled') return { o, release: null };
    if (!['pending_payment', 'confirmed', 'packed'].includes(o.status)) throw conflict('cannot_cancel', 'This order has already shipped. You can request a return after delivery.');
    const paid = !!o.paid_at;
    const refundPaise = o.total_paise - o.refunded_paise;
    const updated = await one(
      `UPDATE users.orders SET status = 'cancelled', cancel_reason = $2, cancelled_at = now(), updated_at = now(),
         payment_status = CASE WHEN $3 THEN 'refund_pending' ELSE payment_status END
       WHERE id = $1 RETURNING *`,
      [orderId, reason, paid && refundPaise > 0],
      client,
    );
    if (paid && refundPaise > 0)
      await enqueue(Q.refund, { key: `cancel:${orderId}`, orderId, amountPaise: refundPaise, reason: `Order cancelled: ${reason}` } satisfies RefundJob, { client, singletonKey: `cancel:${orderId}` });
    return { o: updated, release: paid ? 'restock' : 'release' };
  });
  if (result.release === 'restock') await productsClient.restock(orderId).catch((err) => log('restock failed (admin can adjust stock)', { orderId, err: String(err) }));
  if (result.release === 'release') await productsClient.release(orderId).catch(() => {}); // products' own expiry is the backstop
  return result.o;
}

// ───────────────────────── queue handlers ─────────────────────────

async function nextReceiptNumber(client: pg.PoolClient) {
  const fy = financialYear();
  const r = await one(
    `INSERT INTO users.receipt_counters (fy, last) VALUES ($1, 1) ON CONFLICT (fy) DO UPDATE SET last = users.receipt_counters.last + 1 RETURNING last`,
    [fy],
    client,
  );
  return `ARB/${fy}/${String(r.last).padStart(5, '0')}`;
}

/** payments → users: money is in. Confirm the order (or refund if it can't be fulfilled). Idempotent. */
async function onPaymentCaptured(d: PaymentCapturedJob) {
  const order = await one('SELECT * FROM users.orders WHERE id = $1', [d.orderId]);
  if (!order) throw new Error(`order ${d.orderId} not found`);
  if (order.paid_at) return; // already handled

  const refundAll = async (key: string, reason: string, attention: string | null) =>
    tx(async (client) => {
      const o = await one('SELECT * FROM users.orders WHERE id = $1 FOR UPDATE', [d.orderId], client);
      if (o.paid_at) return;
      await client.query(
        `UPDATE users.orders SET paid_at = now(), payment_method = $2, payment_ref = $3, payment_status = 'refund_pending',
           status = 'cancelled', cancelled_at = COALESCE(cancelled_at, now()), cancel_reason = COALESCE($4, cancel_reason), needs_attention = $5, updated_at = now()
         WHERE id = $1`,
        [d.orderId, d.method, d.providerPaymentId, reason, attention],
      );
      await enqueue(Q.refund, { key, orderId: d.orderId, amountPaise: d.amountPaise, reason } satisfies RefundJob, { client, singletonKey: key });
    });

  // The customer cancelled the unpaid order, then paid anyway (e.g. an old payment tab): give it back.
  if (order.status === 'cancelled' && order.cancel_reason !== 'payment_timeout') {
    await refundAll(`paid-after-cancel:${order.id}`, 'Paid after the order was cancelled', null);
    log('paid after cancel → refund', { order: order.number });
    return;
  }

  const items = (await loadItems([order.id])).get(order.id) ?? [];
  const { ok } = await productsClient.commit(
    order.id,
    items.map((i) => ({ productId: i.product_id, size: i.size, qty: i.qty })),
  );
  if (!ok) {
    await refundAll(`sold-out:${order.id}`, 'sold_out_after_payment', 'Paid after the stock hold expired and the item sold out. Refund issued automatically.');
    log('paid but sold out → refund', { order: order.number });
    return;
  }

  await tx(async (client) => {
    const o = await one('SELECT * FROM users.orders WHERE id = $1 FOR UPDATE', [d.orderId], client);
    if (o.paid_at) return;
    await client.query(
      `UPDATE users.orders SET status = 'confirmed', payment_status = 'paid', paid_at = now(), payment_method = $2, payment_ref = $3,
         cancel_reason = NULL, cancelled_at = NULL, updated_at = now() WHERE id = $1`,
      [d.orderId, d.method, d.providerPaymentId],
    );
    await client.query('INSERT INTO users.receipts (order_id, number) VALUES ($1, $2) ON CONFLICT (order_id) DO NOTHING', [d.orderId, await nextReceiptNumber(client)]);
    await enqueue(Q.receipt, { orderId: d.orderId }, { client, singletonKey: `receipt:${d.orderId}` });
    await enqueue(
      Q.clearCart,
      { userId: o.user_id, coupon: o.coupon_code, items: items.map((i) => ({ productId: i.product_id, size: i.size, color: i.color, qty: i.qty })) },
      { client, singletonKey: `clear:${d.orderId}` },
    );
  });
  log('confirmed', { order: order.number });
}

/** Build and store the PDF, then queue the WhatsApp message. */
async function onReceipt(d: { orderId: string }) {
  const r = await one('SELECT * FROM users.receipts WHERE order_id = $1', [d.orderId]);
  if (!r) return;
  if (!r.pdf) {
    const order = await one('SELECT o.*, u.phone AS user_phone FROM users.orders o JOIN users.users u ON u.id = o.user_id WHERE o.id = $1', [d.orderId]);
    const items = (await loadItems([d.orderId])).get(d.orderId) ?? [];
    const pdf = await renderReceipt({ receiptNumber: r.number, issuedAt: r.issued_at, order, items, customerPhone: order.user_phone });
    await query('UPDATE users.receipts SET pdf = $2 WHERE order_id = $1 AND pdf IS NULL', [d.orderId, pdf]);
  }
  await enqueue(Q.notify, { orderId: d.orderId, kind: 'receipt' } satisfies NotifyJob, { singletonKey: `notify:receipt:${d.orderId}` });
}

/** One WhatsApp message per (order, kind, ref) — retries never double-send. */
async function onNotify(d: NotifyJob, retryCount: number) {
  const key = `${d.kind}:${d.orderId}:${d.ref ?? ''}${d.resend ? `:resend-${d.resend}` : ''}`;
  await query(`INSERT INTO users.notifications (order_id, kind, dedupe_key) VALUES ($1, $2, $3) ON CONFLICT (dedupe_key) DO NOTHING`, [d.orderId, d.kind, key]);
  const n = await one('SELECT * FROM users.notifications WHERE dedupe_key = $1', [key]);
  if (n.status === 'sent' || n.status === 'skipped') return;

  const order = await one('SELECT o.*, u.phone AS user_phone, u.name AS user_name FROM users.orders o JOIN users.users u ON u.id = o.user_id WHERE o.id = $1', [d.orderId]);
  const name = (order.user_name || order.address.fullName || 'there').split(' ')[0];
  await query('UPDATE users.notifications SET attempts = attempts + 1 WHERE id = $1', [n.id]);
  try {
    let messageId: string | null = null;
    if (d.kind === 'receipt') {
      const r = await one('SELECT number, pdf FROM users.receipts WHERE order_id = $1', [d.orderId]);
      if (!r?.pdf) throw new Error('receipt PDF not ready yet');
      messageId = await sendDocumentTemplate(order.user_phone, config.WHATSAPP_RECEIPT_TEMPLATE, [name, order.number, formatInr(order.total_paise)], r.pdf, `Aribas-Receipt-${order.number}.pdf`);
    } else if (d.kind === 'refund' && config.WHATSAPP_REFUND_TEMPLATE) {
      const amount = d.ref ? (await one('SELECT amount_paise FROM users.applied_refunds WHERE key = $1', [d.ref]))?.amount_paise : order.refunded_paise;
      messageId = await sendTextTemplate(order.user_phone, config.WHATSAPP_REFUND_TEMPLATE, [name, formatInr(amount ?? order.refunded_paise), order.number]);
    } else if (d.kind === 'shipped' && config.WHATSAPP_SHIPPED_TEMPLATE) {
      const t = order.tracking ?? {};
      messageId = await sendTextTemplate(order.user_phone, config.WHATSAPP_SHIPPED_TEMPLATE, [name, order.number, [t.courier, t.awb].filter(Boolean).join(' ') || 'our courier partner', t.url || config.SITE_URL + '/account']);
    }
    await query(`UPDATE users.notifications SET status = $2, provider_message_id = $3, sent_at = now(), last_error = NULL WHERE id = $1`, [n.id, messageId ? 'sent' : 'skipped', messageId]);
  } catch (err) {
    const final = retryCount >= 12;
    await query('UPDATE users.notifications SET last_error = $2, status = $3 WHERE id = $1', [n.id, String((err as Error).message).slice(0, 500), final ? 'failed' : 'pending']);
    throw err;
  }
}

/** payments → users: a refund finished (or failed for good). */
async function onRefunded(d: RefundedJob) {
  await tx(async (client) => {
    const o = await one('SELECT * FROM users.orders WHERE id = $1 FOR UPDATE', [d.orderId], client);
    if (!o) return;
    if (d.status === 'failed') {
      await client.query(`UPDATE users.orders SET needs_attention = $2, updated_at = now() WHERE id = $1`, [o.id, `Refund ${d.key} failed at the gateway — retry it from Payments → Refunds.`]);
      return;
    }
    const applied = await client.query('INSERT INTO users.applied_refunds (key, order_id, amount_paise) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [d.key, o.id, d.amountPaise]);
    if (!applied.rowCount) return;
    const refunded = o.refunded_paise + d.amountPaise;
    // A duplicate payment's refund doesn't touch the order's own payment status.
    const own = !d.key.startsWith('duplicate:');
    await client.query(
      `UPDATE users.orders SET refunded_paise = $2, payment_status = $3, updated_at = now() WHERE id = $1`,
      [o.id, own ? refunded : o.refunded_paise, own ? (refunded >= o.total_paise ? 'refunded' : 'partially_refunded') : o.payment_status],
    );
    if (d.key.startsWith('return:')) await client.query(`UPDATE users.returns SET status = 'refunded', updated_at = now() WHERE id = $1`, [d.key.slice(7)]);
    await enqueue(Q.notify, { orderId: o.id, kind: 'refund', ref: d.key } satisfies NotifyJob, { client, singletonKey: `notify:refund:${d.key}` });
  });
}

/** Unpaid orders past their hold: cancel and free the stock. A late payment still confirms (or refunds) them. */
async function expireOrders() {
  const rows = await query(`SELECT id FROM users.orders WHERE status = 'pending_payment' AND expires_at < now() ORDER BY expires_at LIMIT 200`);
  for (const r of rows) {
    const done = await query(
      `UPDATE users.orders SET status = 'cancelled', cancel_reason = 'payment_timeout', cancelled_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'pending_payment' AND paid_at IS NULL RETURNING id`,
      [r.id],
    );
    if (done.length) await productsClient.release(r.id).catch(() => {});
  }
}

// ───────────────────────── routes ─────────────────────────

export async function orderRoutes(app: FastifyInstance, opts: { workers: boolean }) {
  app.register(async (r) => {
    r.addHook('preHandler', requireUser);

    /** Create an order from the cart and get Razorpay Checkout parameters. */
    r.post('/api/orders/checkout', async (req, reply) => {
      const b = z.object({ addressId: z.string().uuid(), shippingMethod: z.enum(['standard', 'express']).default('standard') }).parse(req.body);
      const idemKey = z.string().min(8).max(100).optional().parse(req.headers['idempotency-key'] || undefined);
      const user = await one('SELECT * FROM users.users WHERE id = $1', [req.user!.id]);

      if (idemKey) {
        const prev = await one('SELECT * FROM users.orders WHERE user_id = $1 AND idempotency_key = $2', [user.id, idemKey]);
        if (prev) {
          const items = (await loadItems([prev.id])).get(prev.id) ?? [];
          const payment = prev.status === 'pending_payment' ? checkoutParams(await paymentParams(prev, user), prev, user) : null;
          return { order: orderApi(prev, items), payment };
        }
      }

      const address = await one('SELECT * FROM users.addresses WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [b.addressId, user.id]);
      if (!address) throw notFound('Address');
      const cart = await cartClient.priced(user.id, b.shippingMethod);
      if (!cart.lines.length) throw badRequest('Your bag is empty.');
      const problems = cart.lines.filter((l) => l.problem);
      if (problems.length) throw conflict('cart_changed', 'Some items in your bag changed. Please review it.', problems.map((p) => ({ itemId: p.itemId, problem: p.problem })));
      if (cart.couponCode && cart.couponError) throw conflict('coupon_invalid', cart.couponError);

      const order = await tx(async (client) => {
        const num = (await one(`SELECT nextval('users.order_number_seq') AS n`, [], client)).n;
        const o = await one(
          `INSERT INTO users.orders (number, user_id, idempotency_key, address, shipping_method, subtotal_paise, discount_paise, shipping_paise, total_paise, coupon_code, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now() + make_interval(mins => $11)) RETURNING *`,
          [`ARB-${num}`, user.id, idemKey ?? null, JSON.stringify(addressApi(address)), b.shippingMethod, cart.subtotalPaise, cart.discountPaise, cart.shippingPaise, cart.totalPaise, cart.couponCode, config.ORDER_HOLD_MINUTES],
          client,
        );
        for (const l of cart.lines) {
          await client.query(
            `INSERT INTO users.order_items (order_id, product_id, slug, name, image, size, color, qty, unit_price_paise) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [o.id, l.productId, l.slug, l.name, l.image, l.size, l.color ?? '', l.qty, l.unitPricePaise],
          );
        }
        return o;
      });

      try {
        await productsClient.reserve(order.id, cart.lines.map((l) => ({ productId: l.productId, size: l.size, qty: l.qty })), config.ORDER_HOLD_MINUTES);
      } catch (err) {
        await query(`UPDATE users.orders SET status = 'cancelled', cancel_reason = 'out_of_stock', cancelled_at = now() WHERE id = $1`, [order.id]);
        throw err;
      }

      const items = (await loadItems([order.id])).get(order.id) ?? [];
      reply.code(201);
      try {
        return { order: orderApi(order, items), payment: checkoutParams(await paymentParams(order, user), order, user) };
      } catch (err: any) {
        // The order and stock hold are saved; the customer can press "Pay" again (POST /api/orders/:id/pay).
        return { order: orderApi(order, items), payment: null, paymentError: err?.message ?? 'Payments are temporarily unavailable.' };
      }
    });

    /** Retry payment for an unpaid order (e.g. the popup was closed). */
    r.post('/api/orders/:id/pay', async (req) => {
      const user = await one('SELECT * FROM users.users WHERE id = $1', [req.user!.id]);
      const order = await one('SELECT * FROM users.orders WHERE id = $1 AND user_id = $2', [(req.params as any).id, user.id]);
      if (!order) throw notFound('Order');
      if (order.status !== 'pending_payment') throw conflict('not_payable', order.paid_at ? 'This order is already paid.' : 'This order can no longer be paid. Please check out again.');
      if (new Date(order.expires_at) < new Date()) throw conflict('order_expired', 'This order expired. Please check out again.');
      return { payment: checkoutParams(await paymentParams(order, user), order, user) };
    });

    r.get('/api/orders', async (req) => {
      const rows = await query('SELECT * FROM users.orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [req.user!.id]);
      const items = await loadItems(rows.map((o) => o.id));
      const receipts = new Map(
        (await query(`SELECT order_id, number, issued_at, pdf IS NOT NULL AS pdf_ready FROM users.receipts WHERE order_id = ANY($1)`, [rows.map((o) => o.id)])).map((r) => [r.order_id, r]),
      );
      return { items: rows.map((o) => orderApi(o, items.get(o.id) ?? [], receipts.get(o.id))) };
    });

    r.get('/api/orders/:id', async (req) => {
      const o = await one('SELECT * FROM users.orders WHERE id = $1 AND user_id = $2', [(req.params as any).id, req.user!.id]);
      if (!o) throw notFound('Order');
      const items = (await loadItems([o.id])).get(o.id) ?? [];
      const returns = await query('SELECT * FROM users.returns WHERE order_id = $1 ORDER BY created_at', [o.id]);
      return { ...orderApi(o, items, await receiptMeta(o.id)), returns: returns.map(returnApi) };
    });

    r.get('/api/orders/:id/receipt', async (req, reply) => {
      const o = await one('SELECT id FROM users.orders WHERE id = $1 AND user_id = $2', [(req.params as any).id, req.user!.id]);
      if (!o) throw notFound('Order');
      return sendReceiptPdf(reply, o.id);
    });

    r.post('/api/orders/:id/cancel', async (req) => {
      const { reason } = z.object({ reason: z.string().trim().max(200).default('Cancelled by customer') }).parse(req.body ?? {});
      const o = await cancelOrder((req.params as any).id, reason || 'Cancelled by customer', { userId: req.user!.id });
      return orderApi(o, (await loadItems([o.id])).get(o.id) ?? [], await receiptMeta(o.id));
    });

    // ── returns ──
    r.post('/api/orders/:id/returns', async (req, reply) => {
      const b = z.object({ items: z.array(z.object({ itemId: z.string().uuid(), qty: z.number().int().min(1) })).min(1), reason: z.string().trim().min(3).max(500) }).parse(req.body);
      const ret = await tx(async (client) => {
        const o = await one('SELECT * FROM users.orders WHERE id = $1 AND user_id = $2 FOR UPDATE', [(req.params as any).id, req.user!.id], client);
        if (!o) throw notFound('Order');
        const ends = returnWindowEnds(o);
        if (o.status !== 'delivered' || !ends) throw conflict('not_returnable', 'Returns open once your order is delivered.');
        if (ends < new Date()) throw conflict('return_window_closed', `Returns are accepted within ${config.RETURN_WINDOW_DAYS} days of delivery.`);
        const items = (await loadItems([o.id], client)).get(o.id) ?? [];
        const open = await query(`SELECT items FROM users.returns WHERE order_id = $1 AND status <> 'rejected'`, [o.id], client);
        const alreadyReturned = new Map<string, number>();
        for (const r of open) for (const i of r.items) alreadyReturned.set(i.itemId, (alreadyReturned.get(i.itemId) ?? 0) + i.qty);
        let valuePaise = 0;
        const lines = b.items.map((ri) => {
          const it = items.find((i) => i.id === ri.itemId);
          if (!it) throw badRequest('Item is not part of this order.');
          if (ri.qty + (alreadyReturned.get(it.id) ?? 0) > it.qty) throw badRequest(`You can return at most ${it.qty - (alreadyReturned.get(it.id) ?? 0)} of ${it.name}.`);
          valuePaise += it.unit_price_paise * ri.qty;
          return { itemId: it.id, productId: it.product_id, name: it.name, size: it.size, qty: ri.qty, unitPricePaise: it.unit_price_paise };
        });
        // Refund what was actually paid for these items: the coupon discount is shared proportionally; shipping isn't refunded.
        const refundPaise = Math.floor((valuePaise * (o.subtotal_paise - o.discount_paise)) / o.subtotal_paise);
        return one(
          `INSERT INTO users.returns (order_id, user_id, reason, items, refund_paise) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [o.id, req.user!.id, b.reason, JSON.stringify(lines), Math.min(refundPaise, o.total_paise - o.refunded_paise)],
          client,
        );
      });
      reply.code(201);
      return returnApi(ret);
    });

    r.get('/api/returns', async (req) => ({
      items: (await query('SELECT r.*, o.number AS order_number FROM users.returns r JOIN users.orders o ON o.id = r.order_id WHERE r.user_id = $1 ORDER BY r.created_at DESC', [req.user!.id])).map(returnApi),
    }));
  });

  if (opts.workers) {
    await work<PaymentCapturedJob>(Q.paymentCaptured, onPaymentCaptured, { concurrency: 4 });
    await work<RefundedJob>(Q.refunded, onRefunded);
    await work<{ orderId: string }>(Q.receipt, onReceipt);
    await work<NotifyJob>(Q.notify, (d, job) => onNotify(d, job.retryCount), { concurrency: 4 });
    await work(Q.expireOrders, expireOrders);
    await queue().schedule(Q.expireOrders, '* * * * *');
  }
}

export const RETURN_LABEL: Record<string, string> = {
  requested: 'Requested',
  approved: 'Approved — awaiting pickup',
  rejected: 'Rejected',
  received: 'Received',
  refund_pending: 'Refund in progress',
  refunded: 'Refunded',
};

export const returnApi = (r: any) => ({
  id: r.id,
  orderId: r.order_id,
  orderNumber: r.order_number,
  status: r.status,
  statusLabel: RETURN_LABEL[r.status],
  reason: r.reason,
  items: (r.items as any[]).map((i) => ({ ...i, price: rupees(i.unitPricePaise) })),
  refund: rupees(r.refund_paise),
  adminNote: r.admin_note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
