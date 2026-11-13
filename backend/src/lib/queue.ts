import { PgBoss, type Job, type SendOptions } from 'pg-boss';
import type pg from 'pg';
import { config } from '../config.js';
import { bossDb } from './db.js';

/**
 * Durable jobs and events between services, stored in Postgres (pg-boss).
 * A job is only removed once its handler succeeds; failures retry with exponential backoff,
 * and jobs that exhaust their retries land in the matching "<name>.dead" queue for admin review.
 */
export const Q = {
  /** payments → users: a payment was captured for an order. */
  paymentCaptured: 'payments.captured',
  /** anyone → payments: refund money for an order (idempotent by key). */
  refund: 'payments.refund',
  /** payments → users: a refund completed. */
  refunded: 'payments.refunded',
  /** payments: process a stored Razorpay webhook event. */
  webhook: 'payments.webhook',
  /** payments: poll the gateway for unfinished payments (schedule). */
  reconcile: 'payments.reconcile',
  /** users: build the PDF receipt for a confirmed order. */
  receipt: 'users.receipt',
  /** users: send a WhatsApp message about an order. */
  notify: 'users.notify',
  /** users: cancel unpaid orders past their hold time (schedule). */
  expireOrders: 'users.expire-orders',
  /** products: release stock holds whose time ran out (schedule). */
  releaseHolds: 'products.release-holds',
  /** cart: empty a user's cart after their order is confirmed. */
  clearCart: 'cart.clear',
} as const;
export type QueueName = (typeof Q)[keyof typeof Q];

export interface PaymentCapturedJob {
  orderId: string;
  amountPaise: number;
  method: string | null;
  providerPaymentId: string;
}
export interface RefundJob {
  key: string;
  orderId: string;
  amountPaise: number;
  reason: string;
  /** Refund this specific gateway payment (e.g. a duplicate); defaults to the order's captured payment. */
  providerPaymentId?: string;
}
export interface RefundedJob {
  key: string;
  orderId: string;
  amountPaise: number;
  status: 'processed' | 'failed';
}
export interface NotifyJob {
  orderId: string;
  kind: 'receipt' | 'refund' | 'shipped';
  /** Distinguishes several messages of the same kind (e.g. two refunds). */
  ref?: string;
  /** Force a resend even if already sent (admin "resend receipt"). */
  resend?: string;
}

const RETRY: SendOptions = { retryLimit: 12, retryDelay: 5, retryBackoff: true, retryDelayMax: 3600, expireInSeconds: 120 };

let boss: PgBoss | null = null;

export async function startQueue(): Promise<PgBoss> {
  if (boss) return boss;
  const b = new PgBoss({
    connectionString: config.DATABASE_URL,
    ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    max: 4,
    schema: 'pgboss',
  });
  b.on('error', (err) => console.error('[queue] error', err));
  await b.start();
  for (const name of Object.values(Q)) {
    const dead = `${name}.dead`;
    await b.createQueue(dead, { retentionSeconds: 60 * 60 * 24 * 30, deleteAfterSeconds: 60 * 60 * 24 * 90 });
    await b.createQueue(name, { ...RETRY, deadLetter: dead, deleteAfterSeconds: 60 * 60 * 24 * 14 });
  }
  boss = b;
  return b;
}

export function queue(): PgBoss {
  if (!boss) throw new Error('queue not started');
  return boss;
}

/** Enqueue; pass `client` to commit the job atomically with your own writes. */
export async function enqueue(name: QueueName, data: object, opts: SendOptions & { client?: pg.PoolClient } = {}) {
  const { client, ...rest } = opts;
  return queue().send(name, data, { ...rest, ...(client ? { db: bossDb(client) } : {}) });
}

/** Register a worker. Handlers must be idempotent: a job can run more than once. */
export async function work<T>(name: QueueName, handler: (data: T, job: Job<T>) => Promise<unknown>, opts: { concurrency?: number } = {}) {
  await queue().work<T>(name, { localConcurrency: opts.concurrency ?? 2, pollingIntervalSeconds: config.NODE_ENV === 'test' ? 0.5 : 2 }, async (jobs) => {
    for (const job of jobs) await handler(job.data, job);
  });
}

export async function stopQueue() {
  if (boss) await boss.stop({ graceful: true, timeout: 10_000 });
  boss = null;
}
