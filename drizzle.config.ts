import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // `generate` does not connect; `migrate`/`studio` need the real URL.
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://placeholder@localhost:5432/placeholder',
  },
  strict: true,
  verbose: true,
});
