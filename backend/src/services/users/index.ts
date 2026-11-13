import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { orderRoutes } from './orders.js';
import { reviewRoutes } from './reviews.js';
import { adminRoutes } from './admin.js';

/** Users service: login, profile, addresses, orders, receipts, returns, reviews, admin. */
export async function usersService(app: FastifyInstance, opts: { workers: boolean }) {
  await authRoutes(app);
  await orderRoutes(app, opts);
  await reviewRoutes(app);
  await adminRoutes(app);
}
