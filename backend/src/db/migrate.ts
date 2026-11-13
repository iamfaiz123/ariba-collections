import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../lib/db.js';

/** Applies src/db/migrations/*.sql in name order, each once, each in its own transaction. */
export async function migrate(log: (m: string) => void = console.log) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
  const client = await pool.connect();
  try {
    // Only one process migrates at a time (safe when several instances boot together).
    await client.query('SELECT pg_advisory_lock(726354)');
    await client.query('CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await client.query('SELECT name FROM public.schema_migrations')).rows.map((r) => r.name));
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      if (done.has(file)) continue;
      await client.query('BEGIN');
      try {
        await client.query(readFileSync(join(dir, file), 'utf8'));
        await client.query('INSERT INTO public.schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        log(`migrated ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(726354)').catch(() => {});
    client.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
