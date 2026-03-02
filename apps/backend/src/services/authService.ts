import bcrypt from 'bcryptjs';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, emailVerificationTokens, refreshTokens } from '../db/schema.js';
import { generateOpaqueToken, hashToken, signAccessToken } from './tokenService.js';
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

export async function login(
  email: string,
  password: string
): Promise<{ accessToken: string; rawRefreshToken: string }> {
  const [user] = await db.select().from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  // Generic error for both "email not found" and "wrong password" — prevents email enumeration
  const invalidErr = Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' });

  if (!user) {
    // Run bcrypt anyway to prevent timing-based email enumeration
    await bcrypt.compare(password, '$2a$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    throw invalidErr;
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) throw invalidErr;

  if (!user.isEmailVerified) {
    throw Object.assign(new Error('Email not verified'), { code: 'EMAIL_NOT_VERIFIED' });
  }

  if (user.isBanned) {
    throw Object.assign(new Error('Account banned'), { code: 'ACCOUNT_BANNED' });
  }

  // Issue tokens
  const accessToken = await signAccessToken(user.id);
  const rawRefreshToken = generateOpaqueToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({ userId: user.id, tokenHash, expiresAt });

  // Update lastLoginAt
  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  return { accessToken, rawRefreshToken };
}

export async function refreshToken(
  rawToken: string
): Promise<{ accessToken: string; rawRefreshToken: string } | null> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [existing] = await db.select().from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        gt(refreshTokens.expiresAt, now),
      )
    )
    .limit(1);

  if (!existing) return null;

  // Rotate: delete old row, insert new one
  await db.delete(refreshTokens).where(eq(refreshTokens.id, existing.id));

  const newRawToken = generateOpaqueToken();
  const newTokenHash = hashToken(newRawToken);
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    userId: existing.userId,
    tokenHash: newTokenHash,
    expiresAt: newExpiresAt,
  });

  const accessToken = await signAccessToken(existing.userId);

  return { accessToken, rawRefreshToken: newRawToken };
}

export async function getProfile(userId: number) {
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    balance: users.balance,
    totalWagered: users.totalWagered,
    totalProfit: users.totalProfit,
    totalLoss: users.totalLoss,
    lastBonusClaimedAt: users.lastBonusClaimedAt,
    createdAt: users.createdAt,
    lastLoginAt: users.lastLoginAt,
  }).from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });

  return {
    id: user.id,
    email: user.email,
    balance: user.balance,
    totalWagered: user.totalWagered,
    totalProfit: user.totalProfit,
    totalLoss: user.totalLoss,
    dailyBonusTimestamp: user.lastBonusClaimedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}
