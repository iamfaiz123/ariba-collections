import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, one, tx } from '../../lib/db.js';
import { requireAdmin, requireInternal } from '../../lib/auth.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { Q, work, queue } from '../../lib/queue.js';
import { rupees } from '../../lib/util.js';
import type pg from 'pg';

/**
 * Product service: catalogue (public), product admin, and stock holds (internal).
 * Stock is per size. A hold subtracts stock immediately, so overselling is impossible
 * even when many people check out at once.
 */

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free'];
const SORTS: Record<string, string> = {
  featured: 'p.sort_order DESC, p.is_bestseller DESC, p.created_at DESC',
  newest: 'p.created_at DESC',
  'price-asc': 'p.price_paise ASC',
  'price-desc': 'p.price_paise DESC',
  discount: '(p.mrp_paise - p.price_paise)::float / p.mrp_paise DESC',
};

const SELECT = `
  SELECT p.*, COALESCE(json_agg(json_build_object('size', v.size, 'stock', v.stock)) FILTER (WHERE v.id IS NOT NULL), '[]') AS variants
  FROM products.products p LEFT JOIN products.variants v ON v.product_id = p.id`;

function toApi(p: any) {
  const variants = (p.variants as { size: string; stock: number }[]).sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    fabric: p.fabric,
    occasion: p.occasion,
    price: rupees(p.price_paise),
    mrp: rupees(p.mrp_paise),
    colors: p.colors,
    sizes: variants.filter((v) => v.stock > 0).map((v) => v.size),
    variants,
    stock: variants.reduce((s, v) => s + v.stock, 0),
    isNew: p.is_new,
    isBestseller: p.is_bestseller,
    description: p.description,
    highlights: p.highlights,
    includes: p.includes,
    care: p.care,
    images: p.images,
    video: p.video ?? undefined,
    active: p.active,
    createdAt: p.created_at,
  };
}

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined));

const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  ids: csv,
  flag: z.enum(['new', 'bestseller']).optional(),
  exclude: z.string().uuid().optional(),
  category: csv,
  fabric: csv,
  occasion: csv,
  size: csv,
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(['featured', 'newest', 'price-asc', 'price-desc', 'discount']).default('featured'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});

const colorSchema = z.object({ name: z.string(), hex: z.string(), accent: z.string().optional() });
const productBody = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase-words-with-dashes'),
  name: z.string().min(2).max(160),
  category: z.string().min(2),
  fabric: z.string().default(''),
  occasion: z.string().default(''),
  description: z.string().default(''),
  highlights: z.array(z.string()).default([]),
  includes: z.array(z.string()).default([]),
  care: z.array(z.string()).default([]),
  colors: z.array(colorSchema).default([]),
  images: z.array(z.string()).default([]),
  video: z.string().nullable().optional(),
  price: z.number().positive(),
  mrp: z.number().positive(),
  isNew: z.boolean().default(false),
  isBestseller: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  /** Stock per size, e.g. { "S": 4, "M": 6 }. */
  stock: z.record(z.string(), z.number().int().min(0)).default({}),
});

const lineSchema = z.object({ productId: z.string().uuid(), size: z.string(), qty: z.number().int().min(1).max(50) });
const linesSchema = z.object({ items: z.array(lineSchema).min(1).max(50) });

async function setStock(client: pg.PoolClient, productId: string, stock: Record<string, number>) {
  for (const [size, qty] of Object.entries(stock)) {
    await client.query(
      `INSERT INTO products.variants (product_id, size, stock) VALUES ($1, $2, $3)
       ON CONFLICT (product_id, size) DO UPDATE SET stock = EXCLUDED.stock`,
      [productId, size, qty],
    );
  }
}

/** Groups lines by variant (the same size in two colours is one stock pool). Sorted to avoid deadlocks. */
async function resolveVariants(client: pg.PoolClient, items: { productId: string; size: string; qty: number }[]) {
  const byKey = new Map<string, { productId: string; size: string; qty: number }>();
  for (const i of items) {
    const k = `${i.productId}|${i.size}`;
    const prev = byKey.get(k);
    byKey.set(k, { ...i, qty: (prev?.qty ?? 0) + i.qty });
  }
  const out: { variantId: string; productId: string; size: string; qty: number }[] = [];
  for (const i of byKey.values()) {
    const v = await one<{ id: string }>(
      `SELECT v.id FROM products.variants v JOIN products.products p ON p.id = v.product_id
       WHERE v.product_id = $1 AND v.size = $2`,
      [i.productId, i.size],
      client,
    );
    if (!v) throw conflict('out_of_stock', 'An item in your bag is no longer available.', { productId: i.productId, size: i.size });
    out.push({ variantId: v.id, ...i });
  }
  return out.sort((a, b) => a.variantId.localeCompare(b.variantId));
}

async function take(client: pg.PoolClient, variantId: string, qty: number) {
  const r = await client.query('UPDATE products.variants SET stock = stock - $2 WHERE id = $1 AND stock >= $2 RETURNING id', [variantId, qty]);
  return r.rowCount === 1;
}

async function giveBack(orderId: string, from: 'held' | 'committed', to: 'released' | 'restocked') {
  return tx(async (client) => {
    const rows = await query<{ variant_id: string; qty: number }>(
      `UPDATE products.reservations SET status = $3, updated_at = now()
       WHERE order_id = $1 AND status = $2 RETURNING variant_id, qty`,
      [orderId, from, to],
      client,
    );
    for (const r of rows) await client.query('UPDATE products.variants SET stock = stock + $2 WHERE id = $1', [r.variant_id, r.qty]);
    return rows.length;
  });
}

export async function productsService(app: FastifyInstance, opts: { workers: boolean }) {
  // ── public ──
  app.get('/api/products', async (req) => {
    const f = listQuery.parse(req.query);
    const where = ['p.active'];
    const vals: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      vals.push(v);
      where.push(sql.replace('?', `$${vals.length}`));
    };
    if (f.q) add(`(p.name ILIKE ? OR p.description ILIKE $${vals.length + 1} OR p.fabric ILIKE $${vals.length + 1})`, `%${f.q}%`);
    if (f.ids) add('p.id::text = ANY(?)', f.ids);
    if (f.flag === 'new') where.push('p.is_new');
    if (f.flag === 'bestseller') where.push('p.is_bestseller');
    if (f.exclude) add('p.id <> ?', f.exclude);
    if (f.category) add('p.category = ANY(?)', f.category);
    if (f.fabric) add('p.fabric = ANY(?)', f.fabric);
    if (f.occasion) add('p.occasion = ANY(?)', f.occasion);
    if (f.minPrice !== undefined) add('p.price_paise >= ?', Math.round(f.minPrice * 100));
    if (f.maxPrice !== undefined) add('p.price_paise <= ?', Math.round(f.maxPrice * 100));
    if (f.size) add('EXISTS (SELECT 1 FROM products.variants sv WHERE sv.product_id = p.id AND sv.stock > 0 AND sv.size = ANY(?))', f.size);
    const whereSql = where.join(' AND ');
    const total = (await one<{ n: number }>(`SELECT count(*)::int AS n FROM products.products p WHERE ${whereSql}`, vals))!.n;
    vals.push(f.pageSize, (f.page - 1) * f.pageSize);
    const rows = await query(
      `${SELECT} WHERE ${whereSql} GROUP BY p.id ORDER BY ${SORTS[f.sort]} LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
      vals,
    );
    return { items: rows.map(toApi), total, page: f.page, pageSize: f.pageSize, totalPages: Math.max(1, Math.ceil(total / f.pageSize)) };
  });

  app.get('/api/products/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const p = await one(`${SELECT} WHERE p.slug = $1 AND p.active GROUP BY p.id`, [slug]);
    if (!p) throw notFound('Product');
    return toApi(p);
  });

  // ── admin ──
  app.get('/api/admin/products', { preHandler: requireAdmin }, async () => {
    const rows = await query(`${SELECT} GROUP BY p.id ORDER BY p.created_at DESC`);
    return { items: rows.map(toApi) };
  });

  app.post('/api/admin/products', { preHandler: requireAdmin }, async (req, reply) => {
    const b = productBody.parse(req.body);
    if (b.mrp < b.price) throw badRequest('MRP cannot be lower than the price.');
    const id = await tx(async (client) => {
      const exists = await one('SELECT 1 FROM products.products WHERE slug = $1', [b.slug], client);
      if (exists) throw conflict('slug_taken', 'A product with this slug already exists.');
      const p = (await one<{ id: string }>(
        `INSERT INTO products.products (slug, name, category, fabric, occasion, description, highlights, includes, care, colors, images, video,
           price_paise, mrp_paise, is_new, is_bestseller, active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
        [b.slug, b.name, b.category, b.fabric, b.occasion, b.description, JSON.stringify(b.highlights), JSON.stringify(b.includes), JSON.stringify(b.care),
          JSON.stringify(b.colors), JSON.stringify(b.images), b.video ?? null, Math.round(b.price * 100), Math.round(b.mrp * 100), b.isNew, b.isBestseller, b.active, b.sortOrder],
        client,
      ))!;
      await setStock(client, p.id, b.stock);
      return p.id;
    });
    reply.code(201);
    return toApi(await one(`${SELECT} WHERE p.id = $1 GROUP BY p.id`, [id]));
  });

  app.patch('/api/admin/products/:id', { preHandler: requireAdmin }, async (req) => {
    const { id } = req.params as { id: string };
    const b = productBody.partial().parse(req.body);
    const cols: Record<string, unknown> = {
      slug: b.slug, name: b.name, category: b.category, fabric: b.fabric, occasion: b.occasion, description: b.description,
      highlights: b.highlights && JSON.stringify(b.highlights), includes: b.includes && JSON.stringify(b.includes), care: b.care && JSON.stringify(b.care),
      colors: b.colors && JSON.stringify(b.colors), images: b.images && JSON.stringify(b.images), video: b.video,
      price_paise: b.price && Math.round(b.price * 100), mrp_paise: b.mrp && Math.round(b.mrp * 100),
      is_new: b.isNew, is_bestseller: b.isBestseller, active: b.active, sort_order: b.sortOrder,
    };
    const set = Object.entries(cols).filter(([, v]) => v !== undefined);
    await tx(async (client) => {
      if (!(await one('SELECT 1 FROM products.products WHERE id = $1 FOR UPDATE', [id], client))) throw notFound('Product');
      if (set.length) {
        await client.query(
          `UPDATE products.products SET ${set.map(([k], i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() WHERE id = $1`,
          [id, ...set.map(([, v]) => v)],
        );
      }
      if (b.stock) await setStock(client, id, b.stock);
      const p = await one('SELECT price_paise, mrp_paise FROM products.products WHERE id = $1', [id], client);
      if (p.mrp_paise < p.price_paise) throw badRequest('MRP cannot be lower than the price.');
    });
    return toApi(await one(`${SELECT} WHERE p.id = $1 GROUP BY p.id`, [id]));
  });

  /** Hide from the shop. Products are never hard-deleted: past orders and reviews point at them. */
  app.delete('/api/admin/products/:id', { preHandler: requireAdmin }, async (req) => {
    const { id } = req.params as { id: string };
    const r = await query('UPDATE products.products SET active = false, updated_at = now() WHERE id = $1 RETURNING id', [id]);
    if (!r.length) throw notFound('Product');
    return { ok: true };
  });

  // ── internal ──
  app.register(async (internal) => {
    internal.addHook('preHandler', requireInternal);

    internal.post('/internal/products/quote', async (req) => {
      const { items } = linesSchema.parse(req.body);
      const ids = [...new Set(items.map((i) => i.productId))];
      const rows = await query(`${SELECT} WHERE p.id = ANY($1) GROUP BY p.id`, [ids]);
      const byId = new Map(rows.map((r) => [r.id, r]));
      return {
        items: items.map((i) => {
          const p = byId.get(i.productId);
          const v = p?.variants.find((x: any) => x.size === i.size);
          return {
            ...i,
            found: !!p,
            active: !!p?.active,
            slug: p?.slug ?? '',
            name: p?.name ?? 'Unavailable item',
            image: p?.images?.[0] ?? null,
            category: p?.category ?? '',
            unitPricePaise: p?.price_paise ?? 0,
            mrpPaise: p?.mrp_paise ?? 0,
            available: v?.stock ?? 0,
          };
        }),
      };
    });

    /** Hold stock for an unpaid order. Calling it again for the same order is a no-op. */
    internal.post('/internal/reservations/:orderId', async (req) => {
      const { orderId } = req.params as { orderId: string };
      const { items, minutes } = linesSchema.extend({ minutes: z.number().int().min(1).max(24 * 60) }).parse(req.body);
      await tx(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [orderId]);
        if (await one('SELECT 1 FROM products.reservations WHERE order_id = $1', [orderId], client)) return;
        for (const v of await resolveVariants(client, items)) {
          if (!(await take(client, v.variantId, v.qty)))
            throw conflict('out_of_stock', 'Some items just sold out. Please review your bag.', { productId: v.productId, size: v.size });
          // Small grace period so the order service's own expiry runs first.
          await client.query(
            `INSERT INTO products.reservations (order_id, variant_id, qty, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
            [orderId, v.variantId, v.qty, minutes + 5],
          );
        }
      });
      return { ok: true };
    });

    /** Paid: turn holds into sales. Lapsed holds are re-taken from stock if still available. */
    internal.post('/internal/reservations/:orderId/commit', async (req) => {
      const { orderId } = req.params as { orderId: string };
      const { items } = linesSchema.parse(req.body);
      try {
        await tx(async (client) => {
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [orderId]);
          for (const v of await resolveVariants(client, items)) {
            const r = await one<{ status: string }>(
              'SELECT status FROM products.reservations WHERE order_id = $1 AND variant_id = $2 FOR UPDATE',
              [orderId, v.variantId],
              client,
            );
            if (r?.status === 'committed') continue;
            if (r?.status === 'held') {
              await client.query(`UPDATE products.reservations SET status = 'committed', updated_at = now() WHERE order_id = $1 AND variant_id = $2`, [orderId, v.variantId]);
              continue;
            }
            if (!(await take(client, v.variantId, v.qty))) throw conflict('out_of_stock', 'Sold out');
            await client.query(
              `INSERT INTO products.reservations (order_id, variant_id, qty, status, expires_at) VALUES ($1, $2, $3, 'committed', now())
               ON CONFLICT (order_id, variant_id) DO UPDATE SET status = 'committed', qty = EXCLUDED.qty, updated_at = now()`,
              [orderId, v.variantId, v.qty],
            );
          }
        });
        return { ok: true };
      } catch (err: any) {
        if (err?.code === 'out_of_stock') return { ok: false };
        throw err;
      }
    });

    internal.post('/internal/reservations/:orderId/release', async (req) => {
      await giveBack((req.params as any).orderId, 'held', 'released');
      return { ok: true };
    });

    /** A paid order was cancelled before shipping: put its stock back. */
    internal.post('/internal/reservations/:orderId/restock', async (req) => {
      await giveBack((req.params as any).orderId, 'committed', 'restocked');
      return { ok: true };
    });
  });

  if (opts.workers) {
    // Backstop for orders the order service never expired (e.g. it was down).
    await work(Q.releaseHolds, async () => {
      const orders = await query<{ order_id: string }>(
        `SELECT DISTINCT order_id FROM products.reservations WHERE status = 'held' AND expires_at < now() LIMIT 500`,
      );
      for (const o of orders) await giveBack(o.order_id, 'held', 'released');
    });
    await queue().schedule(Q.releaseHolds, '*/5 * * * *');
  }
}
