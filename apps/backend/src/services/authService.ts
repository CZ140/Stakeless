import bcrypt from 'bcryptjs';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, emailVerificationTokens } from '../db/schema.js';
import { generateOpaqueToken, hashToken } from './tokenService.js';
import { sendVerificationEmail } from './emailService.js';
import { env } from '../env.js';

// Derive a unique username from email prefix + random suffix.
// Retries up to 5 times if collision — sufficient for a small platform.
async function deriveUsername(emailPrefix: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 7); // 5 random alphanumeric chars
    const candidate = `${emailPrefix.slice(0, 20)}_${suffix}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const existing = await db.select({ id: users.id }).from(users)
      .where(eq(users.username, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
  }
  // Fallback: timestamp suffix guarantees uniqueness
  return `user_${Date.now()}`;
}

export async function register(email: string, password: string): Promise<void> {
  // Check for duplicate email — return generic error to avoid email enumeration
  const existing = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  if (existing.length > 0) {
    // Simulate bcrypt delay to prevent timing attacks that reveal email existence
    await bcrypt.hash('timing-attack-prevention', 12);
    throw Object.assign(new Error('Registration failed'), { code: 'DUPLICATE_EMAIL' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const emailPrefix = email.split('@')[0] ?? 'user';
  const username = await deriveUsername(emailPrefix);

  const [newUser] = await db.insert(users).values({
    email: email.toLowerCase(),
    passwordHash,
    username,
  }).returning({ id: users.id });

  if (!newUser) throw new Error('Failed to create user');

  // Issue email verification token
  const rawToken = generateOpaqueToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.insert(emailVerificationTokens).values({
    userId: newUser.id,
    tokenHash,
    type: 'verify_email',
    expiresAt,
  });

  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;
  await sendVerificationEmail(email, verifyUrl);
}

export async function verifyEmail(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);

  const [record] = await db.select().from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        eq(emailVerificationTokens.type, 'verify_email'),
        isNull(emailVerificationTokens.usedAt),
      )
    )
    .limit(1);

  if (!record || record.expiresAt < new Date()) {
    throw Object.assign(new Error('Invalid or expired link'), { code: 'INVALID_TOKEN' });
  }

  // Mark token used (single-use enforcement — do not delete, so replayed links return an error)
  await db.update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokens.id, record.id));

  // Activate the account
  await db.update(users)
    .set({ isEmailVerified: true })
    .where(eq(users.id, record.userId));
}
