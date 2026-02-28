import { config } from 'dotenv';
import { resolve } from 'path';
import { defineConfig } from 'drizzle-kit';

// Load .env from repo root. drizzle-kit runs from apps/backend/ so resolve up two levels.
// Fallback: also check process.cwd() for flexibility.
config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') }); // also try local .env if present

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
  },
});
