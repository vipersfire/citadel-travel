import { config as dotenv } from 'dotenv';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { drizzle as liteDrizzle } from 'drizzle-orm/pglite';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
export type Row = Record<string, any>;
export interface Connection {
  query<T extends Row = Row>(text: string, values?: unknown[]): Promise<T[]>;
}
// node-postgres leaves application-defined enum arrays as text; decode this fixed enum before API use.
const dietaryNeeds = new Set(['halal', 'vegetarian', 'vegan', 'no_pork', 'no_alcohol', 'other']);
function normalizeRows<T extends Row>(rows: T[]): T[] {
  return rows.map((row) => {
    if (typeof row.dietary !== 'string') return row;
    const value = row.dietary;
    if (!value.startsWith('{') || !value.endsWith('}'))
      throw new Error('PostgreSQL returned an invalid dietary_need array');
    const dietary = value === '{}' ? [] : value.slice(1, -1).split(',');
    if (dietary.some((need) => !dietaryNeeds.has(need)))
      throw new Error('PostgreSQL returned an unknown dietary_need value');
    return { ...row, dietary };
  });
}
const root = resolve(import.meta.dirname, '../../..');
dotenv({ path: resolve(root, '.env'), quiet: true });
if (process.env.APP_ENV === 'production' && !process.env.DATABASE_URL)
  throw new Error('DATABASE_URL is required in production');
const localPath = process.env.PGLITE_DIR || resolve(root, '.data/postgres');
await mkdir(localPath, { recursive: true });
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 8 })
  : null;
export const lite = pool ? null : new PGlite(localPath, { extensions: { citext } });
export const orm = pool ? pgDrizzle(pool) : liteDrizzle(lite!);
export const db: Connection = {
  async query<T extends Row>(text: string, values: unknown[] = []) {
    const result = pool ? await pool.query(text, values) : await lite!.query(text, values);
    return normalizeRows(result.rows as T[]);
  },
};
export async function transaction<T>(fn: (tx: Connection) => Promise<T>): Promise<T> {
  if (!pool)
    return lite!.transaction(async (tx) =>
      fn({
        query: async <R extends Row>(text: string, values: unknown[] = []) =>
          normalizeRows((await tx.query(text, values)).rows as R[]),
      }),
    );
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn({
      query: async <R extends Row>(text: string, values: unknown[] = []) =>
        normalizeRows((await client.query(text, values)).rows as R[]),
    });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export async function closeDb() {
  if (pool) await pool.end();
  else await lite!.close();
}
