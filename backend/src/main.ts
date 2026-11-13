import { config } from './config.js';
import { buildApp } from './app.js';
import { migrate } from './db/migrate.js';
import { pool } from './lib/db.js';
import { startQueue, stopQueue } from './lib/queue.js';

/**
 * Starts the services listed in SERVICES (default: all four in this one process).
 * To split later: run this same build on another machine with e.g. SERVICES=payments,
 * and point the others at it with PAYMENTS_URL.
 */
async function main() {
  await migrate((m) => console.log(m));
  await startQueue();
  const app = await buildApp({ services: config.services, workers: config.RUN_WORKERS });
  await app.listen({ port: config.PORT, host: config.HOST });
  console.log(
    `Aribas API on :${config.PORT} · services: ${config.services.join(', ')} · workers: ${config.RUN_WORKERS ? 'on' : 'off'} · payments: ${config.PAYMENT_PROVIDER} · whatsapp: ${config.WHATSAPP_PROVIDER}`,
  );

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal}: shutting down`);
    const force = setTimeout(() => process.exit(1), 20_000).unref();
    await app.close().catch(() => {});
    await stopQueue().catch(() => {});
    await pool.end().catch(() => {});
    clearTimeout(force);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});
