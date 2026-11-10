import 'server-only';

import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export type Database = NeonHttpDatabase<typeof schema>;

/** Thrown when DATABASE_URL is absent. Routes translate this to a 503. */
export class DbNotConfiguredError extends Error {
  constructor() {
    super('DATABASE_URL is not set');
    this.name = 'DbNotConfiguredError';
  }
}

let cached: Database | null = null;

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Lazily construct the client so `next build` never needs a live database.
 * Uses the HTTP driver — one round-trip per statement, no WebSocket pool.
 */
export function getDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DbNotConfiguredError();
  if (!cached) cached = drizzle(neon(url), { schema });
  return cached;
}
