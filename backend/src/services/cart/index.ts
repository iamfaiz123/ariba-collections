import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../../config.js';
import { query, one, tx } from '../../lib/db.js';
import { optionalAuth, requireAdmin, requireInternal } from '../../lib/auth.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { productsClient, type PricedCart } from '../../lib/clients.js';
import { Q, work } from '../../lib/queue.js';
import { rupees } from '../../lib/util.js';

/**
 * Cart service. Guests get a cart id (sent back as the X-Cart-Id header); logged-in users have one
 * cart that guest carts merge into on login. Prices are never taken from the browser: every read
 * re-prices from the product service, and checkout uses the same calculation.
 */

const uuid = z.string().uuid();
const MAX_QTY = 10;

interface CartRow {
  id: string;
  user_id: string | null;
  coupon_code: string | null;
}

async function findCart(req: FastifyRequest): Promise<CartRow | undefined> {
  if (req.user) return one<CartRow>('SELECT * FROM cart.carts WHERE user_id = $1', [req.user.id]);
  const id = uuid.safeParse(req.headers['x-cart-id']);
  if (!id.success) return undefined;
  return one<CartRow>('SELECT * FROM cart.carts WHERE id = $1 AND user_id IS NULL', [id.data]);
}

async function getOrCreateCart(req: FastifyRequest): Promise<CartRow> {
  const existing = await findCart(req);
  if (existing) return existing;
  if (req.user) {
    return (await one<CartRow>(
      `INSERT INTO cart.carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET updated_at = now() RETURNING *`,
      [req.user.id],
    ))!;
  }
  return (await one<CartRow>('INSERT INTO cart.carts DEFAULT VALUES RETURNING *'))!;
}

export function priceCoupon(coupon: any, subtotalPaise: number): { discountPaise: number; error: string | null } {
  if (!coupon || !coupon.active || (coupon.expires_at && new Date(coupon.expires_at) < new Date())) return { discountPaise: 0, error: 'This coupon is not valid.' };
  if (subtotalPaise < coupon.min_subtotal_paise)
    return { discountPaise: 0, error: `Add items worth ₹${rupees(coupon.min_subtotal_paise - subtotalPaise).toLocaleString('en-IN')} more to use ${coupon.code}.` };
  const discountPaise = coupon.kind === 'percent' ? Math.round((subtotalPaise * coupon.value) / 100 / 100) * 100 : Math.min(coupon.value, subtotalPaise);
  return { discountPaise, error: null };
}

export function shippingFor(method: 'standard' | 'express', subtotalPaise: number, discountPaise: number) {
  if (subtotalPaise === 0) return 0;
  if (method === 'express') return config.shipping.expressPaise;
  return subtotalPaise - discountPaise >= config.shipping.freeAbovePaise ? 0 : config.shipping.standardPaise;
}

async function price(cart: CartRow | undefined, shippingMethod: 'standard' | 'express'): Promise<PricedCart> {
  const items = cart ? await query('SELECT * FROM cart.items WHERE cart_id = $1 ORDER BY created_at', [cart.id]) : [];
  const quoted = items.length ? (await productsClient.quote(items.map((i) => ({ productId: i.product_id, size: i.size, qty: i.qty })))).items : [];
  const lines = items.map((i, idx) => {
    const q = quoted[idx];
    const problem = !q.found || !q.active ? 'This item is no longer available.' : q.available <= 0 ? 'Sold out in this size.' : q.available < i.qty ? `Only ${q.available} left in this size.` : null;
    return { ...q, itemId: i.id, color: i.color || null, qty: i.qty, linePaise: q.unitPricePaise * i.qty, problem };
  });
  const subtotalPaise = lines.filter((l) => l.found && l.active).reduce((s, l) => s + l.linePaise, 0);
  let discountPaise = 0;
  let couponError: string | null = null;
  if (cart?.coupon_code) {
    const coupon = await one('SELECT * FROM cart.coupons WHERE code = $1', [cart.coupon_code]);
    ({ discountPaise, error: couponError } = priceCoupon(coupon, subtotalPaise));
  }
  const shippingPaise = shippingFor(shippingMethod, subtotalPaise, discountPaise);
  return {
    cartId: cart?.id ?? null,
    lines,
    couponCode: cart?.coupon_code ?? null,
    couponError,
    shippingMethod,
    subtotalPaise,
    discountPaise,
    shippingPaise,
    totalPaise: subtotalPaise - discountPaise + shippingPaise,
  };
}

/** Public shape: rupees, like the rest of the API. */
function toApi(c: PricedCart) {
  return {
    cartId: c.cartId,
    items: c.lines.map((l) => ({
      id: l.itemId,
      productId: l.productId,
      slug: l.slug,
      name: l.name,
      image: l.image,
      size: l.size,
      color: l.color,
      qty: l.qty,
      price: rupees(l.unitPricePaise),
      mrp: rupees(l.mrpPaise),
      maxQty: Math.min(MAX_QTY, l.available),
      problem: l.problem,
    })),
    coupon: c.couponCode,
    couponError: c.couponError,
    shipping: c.shippingMethod,
    subtotal: rupees(c.subtotalPaise),
    discount: rupees(c.discountPaise),
    shippingFee: rupees(c.shippingPaise),
    total: rupees(c.totalPaise),
  };
}

const shippingQuery = z.object({ shipping: z.enum(['standard', 'express']).default('standard') });

export async function cartService(app: FastifyInstance, opts: { workers: boolean }) {
  app.register(async (r) => {
    r.addHook('preHandler', optionalAuth);

    r.get('/api/cart', async (req) => toApi(await price(await findCart(req), shippingQuery.parse(req.query).shipping)));

    r.post('/api/cart/items', async (req) => {
      const b = z.object({ productId: uuid, size: z.string().min(1), color: z.string().max(60).default(''), qty: z.number().int().min(1).max(MAX_QTY).default(1) }).parse(req.body);
      const [q] = (await productsClient.quote([{ productId: b.productId, size: b.size, qty: b.qty }])).items;
      if (!q.found || !q.active) throw notFound('Product');
      if (q.available <= 0) throw badRequest('This size is sold out.');
      const cart = await getOrCreateCart(req);
      await query(
        `INSERT INTO cart.items (cart_id, product_id, size, color, qty) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (cart_id, product_id, size, color) DO UPDATE SET qty = LEAST($6, cart.items.qty + EXCLUDED.qty)`,
        [cart.id, b.productId, b.size, b.color, Math.min(b.qty, q.available, MAX_QTY), Math.min(MAX_QTY, q.available)],
      );
      await query('UPDATE cart.carts SET updated_at = now() WHERE id = $1', [cart.id]);
      return toApi(await price(cart, 'standard'));
    });

    /** Replace the whole bag (the storefront keeps its bag locally and syncs it before checkout). */
    r.put('/api/cart', async (req) => {
      const b = z
        .object({
          items: z.array(z.object({ productId: uuid, size: z.string().min(1), color: z.string().max(60).default(''), qty: z.number().int().min(1).max(MAX_QTY) })).max(50),
          coupon: z.string().trim().max(40).nullable().optional(),
        })
        .parse(req.body);
      const cart = await getOrCreateCart(req);
      const code = b.coupon ? b.coupon.toUpperCase() : null;
      await tx(async (client) => {
        await client.query('DELETE FROM cart.items WHERE cart_id = $1', [cart.id]);
        for (const i of b.items) {
          await client.query(
            `INSERT INTO cart.items (cart_id, product_id, size, color, qty) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (cart_id, product_id, size, color) DO UPDATE SET qty = LEAST(${MAX_QTY}, cart.items.qty + EXCLUDED.qty)`,
            [cart.id, i.productId, i.size, i.color, i.qty],
          );
        }
        await client.query('UPDATE cart.carts SET coupon_code = $2, updated_at = now() WHERE id = $1', [cart.id, code]);
      });
      return toApi(await price({ ...cart, coupon_code: code }, shippingQuery.parse(req.query).shipping));
    });

    r.patch('/api/cart/items/:itemId', async (req) => {
      const { qty } = z.object({ qty: z.number().int().min(1).max(MAX_QTY) }).parse(req.body);
      const cart = await findCart(req);
      if (!cart) throw notFound('Cart');
      const res = await query('UPDATE cart.items SET qty = $3 WHERE id = $1 AND cart_id = $2 RETURNING id', [(req.params as any).itemId, cart.id, qty]);
      if (!res.length) throw notFound('Cart item');
      return toApi(await price(cart, 'standard'));
    });

    r.delete('/api/cart/items/:itemId', async (req) => {
      const cart = await findCart(req);
      if (!cart) throw notFound('Cart');
      await query('DELETE FROM cart.items WHERE id = $1 AND cart_id = $2', [(req.params as any).itemId, cart.id]);
      return toApi(await price(cart, 'standard'));
    });

    r.post('/api/cart/coupon', async (req) => {
      const { code } = z.object({ code: z.string().trim().min(1).max(40) }).parse(req.body);
      const cart = await getOrCreateCart(req);
      const coupon = await one('SELECT * FROM cart.coupons WHERE code = $1', [code.toUpperCase()]);
      const priced = await price(cart, 'standard');
      const { error } = priceCoupon(coupon, priced.subtotalPaise);
      if (error) throw badRequest(error);
      await query('UPDATE cart.carts SET coupon_code = $2, updated_at = now() WHERE id = $1', [cart.id, coupon.code]);
      return toApi(await price({ ...cart, coupon_code: coupon.code }, 'standard'));
    });

    r.delete('/api/cart/coupon', async (req) => {
      const cart = await findCart(req);
      if (cart) await query('UPDATE cart.carts SET coupon_code = NULL WHERE id = $1', [cart.id]);
      return toApi(await price(cart && { ...cart, coupon_code: null }, 'standard'));
    });
  });

  // ── admin: coupons ──
  const couponBody = z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,30}$/),
    description: z.string().default(''),
    kind: z.enum(['percent', 'flat']),
    /** percent: 1–90; flat: rupees */
    value: z.number().positive(),
    minSubtotal: z.number().min(0).default(0),
    active: z.boolean().default(true),
    expiresAt: z.string().datetime().nullable().optional(),
  });
  const couponApi = (c: any) => ({
    code: c.code, description: c.description, kind: c.kind, value: c.kind === 'flat' ? rupees(c.value) : c.value,
    minSubtotal: rupees(c.min_subtotal_paise), active: c.active, expiresAt: c.expires_at,
  });

  app.get('/api/admin/coupons', { preHandler: requireAdmin }, async () => ({ items: (await query('SELECT * FROM cart.coupons ORDER BY created_at DESC')).map(couponApi) }));

  app.put('/api/admin/coupons/:code', { preHandler: requireAdmin }, async (req) => {
    const b = couponBody.parse({ ...(req.body as object), code: (req.params as any).code });
    if (b.kind === 'percent' && b.value > 90) throw badRequest('Percent coupons can be at most 90%.');
    const value = b.kind === 'flat' ? Math.round(b.value * 100) : Math.round(b.value);
    const c = await one(
      `INSERT INTO cart.coupons (code, description, kind, value, min_subtotal_paise, active, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (code) DO UPDATE SET description = $2, kind = $3, value = $4, min_subtotal_paise = $5, active = $6, expires_at = $7 RETURNING *`,
      [b.code, b.description, b.kind, value, Math.round(b.minSubtotal * 100), b.active, b.expiresAt ?? null],
    );
    return couponApi(c);
  });

  // ── internal ──
  app.register(async (internal) => {
    internal.addHook('preHandler', requireInternal);

    internal.get('/internal/carts/user/:userId', async (req) => {
      const cart = await one<CartRow>('SELECT * FROM cart.carts WHERE user_id = $1', [(req.params as any).userId]);
      return price(cart, shippingQuery.parse(req.query).shipping);
    });

    /** On login: move the guest cart's items into the user's cart. */
    internal.post('/internal/carts/merge', async (req) => {
      const { userId, cartId } = z.object({ userId: uuid, cartId: uuid }).parse(req.body);
      await tx(async (client) => {
        const guest = await one<CartRow>('SELECT * FROM cart.carts WHERE id = $1 AND user_id IS NULL FOR UPDATE', [cartId], client);
        if (!guest) return;
        const mine = (await one<CartRow>(
          `INSERT INTO cart.carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET updated_at = now() RETURNING *`,
          [userId],
          client,
        ))!;
        await client.query(
          `INSERT INTO cart.items (cart_id, product_id, size, color, qty)
           SELECT $2, product_id, size, color, qty FROM cart.items WHERE cart_id = $1
           ON CONFLICT (cart_id, product_id, size, color) DO UPDATE SET qty = LEAST(${MAX_QTY}, cart.items.qty + EXCLUDED.qty)`,
          [guest.id, mine.id],
        );
        if (!mine.coupon_code && guest.coupon_code) await client.query('UPDATE cart.carts SET coupon_code = $2 WHERE id = $1', [mine.id, guest.coupon_code]);
        await client.query('DELETE FROM cart.carts WHERE id = $1', [guest.id]);
      });
      return { ok: true };
    });
  });

  if (opts.workers) {
    /** After an order is confirmed, remove exactly what was bought (items added since stay). */
    await work<{ userId: string; items: { productId: string; size: string; color: string; qty: number }[]; coupon: string | null }>(Q.clearCart, async (d) => {
      await tx(async (client) => {
        const cart = await one<CartRow>('SELECT * FROM cart.carts WHERE user_id = $1 FOR UPDATE', [d.userId], client);
        if (!cart) return;
        for (const i of d.items) {
          const args = [cart.id, i.productId, i.size, i.color ?? '', i.qty];
          await client.query('DELETE FROM cart.items WHERE cart_id = $1 AND product_id = $2 AND size = $3 AND color = $4 AND qty <= $5', args);
          await client.query('UPDATE cart.items SET qty = qty - $5 WHERE cart_id = $1 AND product_id = $2 AND size = $3 AND color = $4 AND qty > $5', args);
        }
        if (d.coupon && cart.coupon_code === d.coupon) await client.query('UPDATE cart.carts SET coupon_code = NULL WHERE id = $1', [cart.id]);
      });
    });
    // Guest carts nobody touched in 60 days.
    await query(`DELETE FROM cart.carts WHERE user_id IS NULL AND updated_at < now() - interval '60 days'`).catch(() => {});
  }
}
