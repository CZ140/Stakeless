import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().min(1024).max(65535).default(3000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`[startup] Environment validation failed:\n${issues}`);
  console.error('[startup] Copy .env.example to .env and fill in the required values.');
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
