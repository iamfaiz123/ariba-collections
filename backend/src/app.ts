import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { ZodError } from 'zod';
import { config, type ServiceName } from './config.js';
import { AppError } from './lib/errors.js';
import { pool } from './lib/db.js';
import { productsService } from './services/products/index.js';
import { cartService } from './services/cart/index.js';
import { usersService } from './services/users/index.js';
import { paymentsService } from './services/payments/index.js';

const SERVICES: Record<ServiceName, (app: FastifyInstance, opts: { workers: boolean }) => Promise<void>> = {
  products: productsService,
  cart: cartService,
  users: usersService,
  payments: paymentsService,
};

export async function buildApp(opts: { services: ServiceName[]; workers: boolean; logger?: boolean }) {
  const app = Fastify({
    logger: opts.logger === false ? false : { level: config.isProd ? 'info' : 'warn', redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-internal-token"]'] },
    trustProxy: true,
    bodyLimit: 1_000_000,
  });

  // Keep the exact bytes: webhook signatures are computed over the raw body.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body: Buffer, done) => {
    req.rawBody = body;
    if (!body.length) return done(null, undefined);
    try {
      done(null, JSON.parse(body.toString('utf8')));
    } catch {
      done(new AppError(400, 'bad_json', 'Invalid JSON body.'), undefined);
    }
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : !config.isProd,
    credentials: true,
    allowedHeaders: ['content-type', 'authorization', 'x-cart-id', 'idempotency-key'],
    exposedHeaders: ['x-cart-id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return reply.code(400).send({ error: { code: 'invalid_input', message: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input.', details: err.issues } });
    }
    if (err instanceof AppError) return reply.code(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: { code: err.code ?? 'bad_request', message: err.message } });
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'internal', message: 'Something went wrong. Please try again.' } });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: { code: 'not_found', message: 'Route not found.' } }));

  app.get('/health', async () => ({ ok: true, services: opts.services }));
  app.get('/health/ready', async (_req, reply) => {
    try {
      await pool.query('SELECT 1');
      return { ok: true };
    } catch {
      return reply.code(503).send({ ok: false });
    }
  });

  for (const name of opts.services) await SERVICES[name](app, { workers: opts.workers });
  return app;
}
