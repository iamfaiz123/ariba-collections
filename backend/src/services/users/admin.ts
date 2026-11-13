import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, one, tx } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { paymentsClient } from '../../lib/clients.js';
import { enqueue, Q, type NotifyJob, type RefundJob } from '../../lib/queue.js';
import { rupees } from '../../lib/util.js';
import { addressApi, userApi } from './auth.js';
import { cancelOrder, loadItems, orderApi, receiptMeta, returnApi, sendReceiptPdf } from './orders.js';

/** Admin: customers, their orders and receipts, order fulfilment, returns. */

const page = z.coerce.number().int().min(1).default(1);
const PAGE = 50;

const NEXT: Record<string, string[]> = {
  confirmed: ['packed', 'shipped', 'delivered'],
  packed: ['shipped', 'delivered'],
  shipped: ['delivered'],
};

export async function adminRoutes(app: FastifyInstance) {
  app.register(async (r) => {
    r.addHook('preHandler', requireAdmin);

    r.get('/api/admin/overview', async () => {
      const o = await one(`
        SELECT
          (SELECT count(*) FROM users.orders WHERE paid_at > now() - interval '1 day')::int AS orders_today,
          (SELECT COALESCE(sum(total_paise - refunded_paise), 0) FROM users.orders WHERE paid_at > now() - interval '30 days')::bigint AS revenue_30d_paise,
          (SELECT count(*) FROM users.orders WHERE status IN ('confirmed', 'packed'))::int AS to_ship,
          (SELECT count(*) FROM users.orders WHERE needs_attention IS NOT NULL)::int AS needs_attention,
          (SELECT count(*) FROM users.returns WHERE status IN ('requested', 'approved', 'received', 'refund_pending'))::int AS open_returns,
          (SELECT count(*) FROM users.notifications WHERE status = 'failed')::int AS failed_messages,
          (SELECT count(*) FROM users.users)::int AS customers`);
      return { ...o, revenue30d: rupees(o.revenue_30d_paise), revenue_30d_paise: undefined };
    });

    // ── customers ──
    r.get('/api/admin/users', async (req) => {
      const q = z.object({ q: z.string().trim().max(80).optional(), page }).parse(req.query);
      const term = q.q ? `%${q.q.replace(/\s+/g, '')}%` : null;
      const rows = await query(
        `SELECT u.*, count(o.id) FILTER (WHERE o.paid_at IS NOT NULL)::int AS orders,
                COALESCE(sum(o.total_paise - o.refunded_paise) FILTER (WHERE o.paid_at IS NOT NULL), 0)::bigint AS spent_paise
         FROM users.users u LEFT JOIN users.orders o ON o.user_id = u.id
         WHERE $1::text IS NULL OR u.phone LIKE $1 OR replace(u.name, ' ', '') ILIKE $1 OR u.email ILIKE $1
         GROUP BY u.id ORDER BY u.created_at DESC LIMIT ${PAGE} OFFSET $2`,
        [term, (q.page - 1) * PAGE],
      );
      return { items: rows.map((u) => ({ ...userApi(u), orders: u.orders, spent: rupees(u.spent_paise), lastLoginAt: u.last_login_at })) };
    });

    r.get('/api/admin/users/:id', async (req) => {
      const id = (req.params as any).id;
      const u = await one('SELECT * FROM users.users WHERE id = $1', [id]);
      if (!u) throw notFound('Customer');
      const orders = await query('SELECT * FROM users.orders WHERE user_id = $1 ORDER BY created_at DESC', [id]);
      const items = await loadItems(orders.map((o) => o.id));
      const receipts = new Map(
        (await query(`SELECT order_id, number, issued_at, pdf IS NOT NULL AS pdf_ready FROM users.receipts WHERE order_id = ANY($1)`, [orders.map((o) => o.id)])).map((x) => [x.order_id, x]),
      );
      const addresses = await query('SELECT * FROM users.addresses WHERE user_id = $1 AND deleted_at IS NULL ORDER BY is_default DESC', [id]);
      const returns = await query('SELECT r.*, o.number AS order_number FROM users.returns r JOIN users.orders o ON o.id = r.order_id WHERE r.user_id = $1 ORDER BY r.created_at DESC', [id]);
      return {
        user: { ...userApi(u), lastLoginAt: u.last_login_at },
        addresses: addresses.map(addressApi),
        orders: orders.map((o) => adminOrder(o, items.get(o.id) ?? [], receipts.get(o.id))),
        returns: returns.map(returnApi),
      };
    });

    // ── orders ──
    r.get('/api/admin/orders', async (req) => {
      const q = z
        .object({ status: z.string().optional(), q: z.string().trim().max(80).optional(), attention: z.enum(['1', 'true']).optional(), page })
        .parse(req.query);
      const rows = await query(
        `SELECT o.*, u.phone AS user_phone, u.name AS user_name FROM users.orders o JOIN users.users u ON u.id = o.user_id
         WHERE ($1::text IS NULL OR o.status = $1)
           AND ($2::text IS NULL OR o.number ILIKE $2 OR u.phone LIKE $2 OR o.address->>'fullName' ILIKE $2)
           AND (NOT $3 OR o.needs_attention IS NOT NULL)
         ORDER BY o.created_at DESC LIMIT ${PAGE} OFFSET $4`,
        [q.status ?? null, q.q ? `%${q.q}%` : null, !!q.attention, (q.page - 1) * PAGE],
      );
      const items = await loadItems(rows.map((o) => o.id));
      return { items: rows.map((o) => adminOrder(o, items.get(o.id) ?? [])) };
    });

    r.get('/api/admin/orders/:id', async (req) => {
      const o = await one('SELECT o.*, u.phone AS user_phone, u.name AS user_name FROM users.orders o JOIN users.users u ON u.id = o.user_id WHERE o.id = $1', [(req.params as any).id]);
      if (!o) throw notFound('Order');
      const items = (await loadItems([o.id])).get(o.id) ?? [];
      const [notifications, returns, payments] = await Promise.all([
        query('SELECT kind, status, attempts, last_error, sent_at, created_at FROM users.notifications WHERE order_id = $1 ORDER BY created_at', [o.id]),
        query('SELECT r.*, $2::text AS order_number FROM users.returns r WHERE r.order_id = $1 ORDER BY r.created_at', [o.id, o.number]),
        paymentsClient.forOrder(o.id).catch(() => null),
      ]);
      return {
        ...adminOrder(o, items, await receiptMeta(o.id)),
        notifications: notifications.map((n) => ({ kind: n.kind, status: n.status, attempts: n.attempts, error: n.last_error, sentAt: n.sent_at, createdAt: n.created_at })),
        returns: returns.map(returnApi),
        payments: payments?.payments ?? null,
        refunds: payments?.refunds ?? null,
      };
    });

    r.get('/api/admin/orders/:id/receipt', async (req, reply) => sendReceiptPdf(reply, (req.params as any).id));

    r.post('/api/admin/orders/:id/resend-receipt', async (req) => {
      const id = (req.params as any).id;
      const rec = await one('SELECT pdf IS NOT NULL AS ready FROM users.receipts WHERE order_id = $1', [id]);
      if (!rec) throw notFound('Receipt');
      if (!rec.ready) await enqueue(Q.receipt, { orderId: id });
      else await enqueue(Q.notify, { orderId: id, kind: 'receipt', resend: String(Date.now()) } satisfies NotifyJob);
      return { ok: true };
    });

    r.patch('/api/admin/orders/:id/status', async (req) => {
      const b = z
        .object({
          status: z.enum(['packed', 'shipped', 'delivered']),
          tracking: z.object({ courier: z.string().max(60).optional(), awb: z.string().max(60).optional(), url: z.string().url().optional() }).optional(),
        })
        .parse(req.body);
      const o = await tx(async (client) => {
        const cur = await one('SELECT * FROM users.orders WHERE id = $1 FOR UPDATE', [(req.params as any).id], client);
        if (!cur) throw notFound('Order');
        if (!(NEXT[cur.status] ?? []).includes(b.status)) throw conflict('bad_transition', `Can't move an order from ${cur.status} to ${b.status}.`);
        const updated = await one(
          `UPDATE users.orders SET status = $2, tracking = COALESCE($3, tracking),
             shipped_at = CASE WHEN $2 IN ('shipped', 'delivered') THEN COALESCE(shipped_at, now()) ELSE shipped_at END,
             delivered_at = CASE WHEN $2 = 'delivered' THEN now() ELSE delivered_at END, updated_at = now()
           WHERE id = $1 RETURNING *`,
          [cur.id, b.status, b.tracking ? JSON.stringify(b.tracking) : null],
          client,
        );
        if (b.status === 'shipped') await enqueue(Q.notify, { orderId: cur.id, kind: 'shipped' } satisfies NotifyJob, { client, singletonKey: `notify:shipped:${cur.id}` });
        return updated;
      });
      return adminOrder(o, (await loadItems([o.id])).get(o.id) ?? [], await receiptMeta(o.id));
    });

    r.post('/api/admin/orders/:id/cancel', async (req) => {
      const { reason } = z.object({ reason: z.string().trim().min(3).max(200) }).parse(req.body);
      const o = await cancelOrder((req.params as any).id, reason, {});
      return adminOrder(o, (await loadItems([o.id])).get(o.id) ?? [], await receiptMeta(o.id));
    });

    /** Mark an "needs attention" flag as handled. */
    r.post('/api/admin/orders/:id/resolve', async (req) => {
      const o = await one('UPDATE users.orders SET needs_attention = NULL, updated_at = now() WHERE id = $1 RETURNING *', [(req.params as any).id]);
      if (!o) throw notFound('Order');
      return { ok: true };
    });

    // ── returns ──
    r.get('/api/admin/returns', async (req) => {
      const q = z.object({ status: z.string().optional(), page }).parse(req.query);
      const rows = await query(
        `SELECT r.*, o.number AS order_number, u.phone AS user_phone, u.name AS user_name FROM users.returns r
         JOIN users.orders o ON o.id = r.order_id JOIN users.users u ON u.id = r.user_id
         WHERE $1::text IS NULL OR r.status = $1 ORDER BY r.created_at DESC LIMIT ${PAGE} OFFSET $2`,
        [q.status ?? null, (q.page - 1) * PAGE],
      );
      return { items: rows.map((x) => ({ ...returnApi(x), customer: { phone: x.user_phone, name: x.user_name } })) };
    });

    /**
     * approve → customer ships it back / pickup; reject (with note);
     * received → item checked in, refund starts automatically to the original payment method.
     */
    r.patch('/api/admin/returns/:id', async (req) => {
      const b = z.object({ action: z.enum(['approve', 'reject', 'received']), note: z.string().trim().max(500).optional() }).parse(req.body);
      const ret = await tx(async (client) => {
        const cur = await one('SELECT * FROM users.returns WHERE id = $1 FOR UPDATE', [(req.params as any).id], client);
        if (!cur) throw notFound('Return');
        const allowed: Record<string, string[]> = { approve: ['requested'], reject: ['requested', 'approved'], received: ['approved', 'requested'] };
        if (!allowed[b.action].includes(cur.status)) throw conflict('bad_transition', `Can't ${b.action} a return that is ${cur.status}.`);
        if (b.action === 'reject' && !b.note) throw badRequest('Add a note telling the customer why.');
        const status = b.action === 'approve' ? 'approved' : b.action === 'reject' ? 'rejected' : 'refund_pending';
        const updated = await one(`UPDATE users.returns SET status = $2, admin_note = COALESCE($3, admin_note), updated_at = now() WHERE id = $1 RETURNING *`, [cur.id, status, b.note ?? null], client);
        if (b.action === 'received') {
          await enqueue(Q.refund, { key: `return:${cur.id}`, orderId: cur.order_id, amountPaise: cur.refund_paise, reason: `Return: ${cur.reason}`.slice(0, 200) } satisfies RefundJob, {
            client,
            singletonKey: `return:${cur.id}`,
          });
          await client.query(`UPDATE users.orders SET payment_status = 'refund_pending', updated_at = now() WHERE id = $1`, [cur.order_id]);
        }
        return updated;
      });
      return returnApi(ret);
    });
  });
}

function adminOrder(o: any, items: any[], receipt?: any) {
  return {
    ...orderApi(o, items, receipt),
    customer: o.user_phone ? { id: o.user_id, phone: o.user_phone, name: o.user_name } : { id: o.user_id },
    needsAttention: o.needs_attention,
  };
}
