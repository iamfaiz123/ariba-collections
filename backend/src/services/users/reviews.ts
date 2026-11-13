import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, one } from '../../lib/db.js';
import { requireAdmin, requireUser } from '../../lib/auth.js';
import { conflict, notFound } from '../../lib/errors.js';

/** Reviews: only customers whose order with that product was delivered can write one (one per product, editable). */

const reviewApi = (r: any) => ({ id: r.id, productId: r.product_id, author: r.author, rating: r.rating, title: r.title, body: r.body, date: r.created_at, verified: true, status: r.status });

export async function reviewRoutes(app: FastifyInstance) {
  app.get('/api/reviews', async (req) => {
    const { productId } = z.object({ productId: z.string().uuid() }).parse(req.query);
    const rows = await query(`SELECT * FROM users.reviews WHERE product_id = $1 AND status = 'published' ORDER BY created_at DESC LIMIT 200`, [productId]);
    const count = rows.length;
    const average = count ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    return { items: rows.map(reviewApi), count, average };
  });

  /** Ratings for product cards: ?productIds=a,b,c → { [id]: { average, count } } */
  app.get('/api/reviews/summary', async (req) => {
    const ids = z.string().parse((req.query as any).productIds ?? '').split(',').filter((s) => z.string().uuid().safeParse(s).success).slice(0, 100);
    if (!ids.length) return {};
    const rows = await query(
      `SELECT product_id, round(avg(rating)::numeric, 1)::float AS average, count(*)::int AS count FROM users.reviews
       WHERE product_id = ANY($1) AND status = 'published' GROUP BY product_id`,
      [ids],
    );
    return Object.fromEntries(rows.map((r) => [r.product_id, { average: r.average, count: r.count }]));
  });

  app.post('/api/reviews', { preHandler: requireUser }, async (req, reply) => {
    const b = z
      .object({ productId: z.string().uuid(), rating: z.number().int().min(1).max(5), title: z.string().trim().max(120).default(''), body: z.string().trim().max(2000).default('') })
      .parse(req.body);
    const bought = await one(
      `SELECT o.id FROM users.orders o JOIN users.order_items i ON i.order_id = o.id
       WHERE o.user_id = $1 AND i.product_id = $2 AND o.status = 'delivered' ORDER BY o.delivered_at DESC LIMIT 1`,
      [req.user!.id, b.productId],
    );
    if (!bought) throw conflict('not_verified_buyer', 'You can review a product after it has been delivered to you.');
    const user = await one('SELECT name, phone FROM users.users WHERE id = $1', [req.user!.id]);
    const author = user.name ? user.name.split(' ')[0] : 'Aribas customer';
    const r = await one(
      `INSERT INTO users.reviews (product_id, user_id, order_id, author, rating, title, body) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (product_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, title = EXCLUDED.title, body = EXCLUDED.body, author = EXCLUDED.author
       RETURNING *, (xmax = 0) AS created`,
      [b.productId, req.user!.id, bought.id, author, b.rating, b.title, b.body],
    );
    reply.code(r.created ? 201 : 200);
    return reviewApi(r);
  });

  app.get('/api/admin/reviews', { preHandler: requireAdmin }, async () => ({
    items: (await query('SELECT * FROM users.reviews ORDER BY created_at DESC LIMIT 200')).map(reviewApi),
  }));

  app.patch('/api/admin/reviews/:id', { preHandler: requireAdmin }, async (req) => {
    const { status } = z.object({ status: z.enum(['published', 'hidden']) }).parse(req.body);
    const r = await one('UPDATE users.reviews SET status = $2 WHERE id = $1 RETURNING *', [(req.params as any).id, status]);
    if (!r) throw notFound('Review');
    return reviewApi(r);
  });
}
