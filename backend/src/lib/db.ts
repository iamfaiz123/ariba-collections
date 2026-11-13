import pg from 'pg';
import { config } from '../config.js';

// bigint/numeric come back as strings by default; amounts here are paise and fit in a JS number.
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: config.DATABASE_POOL_MAX,
  ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
});
pool.on('error', (err) => console.error('postgres pool error', err));

export type Db = pg.Pool | pg.PoolClient;

export async function query<T = any>(text: string, values?: unknown[], db: Db = pool): Promise<T[]> {
  const res = await db.query(text, values as any[]);
  return res.rows as T[];
}

export async function one<T = any>(text: string, values?: unknown[], db: Db = pool): Promise<T | undefined> {
  const rows = await query<T>(text, values, db);
  return rows[0];
}

/** Runs fn inside a transaction. Rolls back on any thrown error. */
export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Adapter so pg-boss can enqueue jobs inside our transaction (transactional outbox). */
export const bossDb = (client: pg.PoolClient) => ({
  executeSql: (text: string, values?: unknown[]) => client.query(text, values as any[]).then((r) => ({ rows: r.rows })),
});
