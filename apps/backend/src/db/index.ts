import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../env.js';
import * as schema from './schema.js';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Managed Postgres (Neon, Render, etc.) requires TLS in production. `rejectUnauthorized:false`
  // accepts the provider's chain without bundling a CA cert; pair with `?sslmode=require` in
  // DATABASE_URL. Local dev (plain Postgres) connects without SSL.
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle({ client: pool, schema });
