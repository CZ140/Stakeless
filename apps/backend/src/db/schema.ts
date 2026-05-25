import {
  pgTable,
  serial,
  varchar,
  bigint,
  timestamp,
  integer,
  text,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  // Null for accounts created via a social provider (e.g. Google) — they have no
  // local password. A password can still be added later via the reset flow.
  passwordHash: varchar('password_hash', { length: 255 }),
  // Google subject id ('sub' claim). Set when a user signs in with Google, whether
  // a fresh social signup or an existing email account being linked. Unique.
  googleId: varchar('google_id', { length: 255 }).unique(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  balance: bigint('balance', { mode: 'number' }).notNull().default(0),
  totalWagered: bigint('total_wagered', { mode: 'number' }).notNull().default(0),
  totalProfit: bigint('total_profit', { mode: 'number' }).notNull().default(0),
  totalLoss: bigint('total_loss', { mode: 'number' }).notNull().default(0),
  role: varchar('role', { length: 20 }).notNull().default('player'),
  // Avatar customization. avatarColor tints the letter-monogram (hex like
  // '#5aa9ff'); null falls back to a colour derived from the username. avatarImage
  // holds a small client-resized data URL (no object storage yet); null → monogram.
  avatarColor: varchar('avatar_color', { length: 7 }),
  avatarImage: text('avatar_image'),
  // Highest tier reached, derived from totalWagered but persisted so a one-time
  // tier-up reward fires exactly once when a player crosses each threshold.
  tierLevel: integer('tier_level').notNull().default(0),
  lastBonusClaimedAt: timestamp('last_bonus_claimed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
  tokenVersion: integer('token_version').notNull().default(0),
  isBanned: boolean('is_banned').notNull().default(false),
  isEmailVerified: boolean('is_email_verified').notNull().default(false),
});

export const gameLogs = pgTable('game_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  gameType: varchar('game_type', { length: 50 }).notNull(),
  betAmount: bigint('bet_amount', { mode: 'number' }).notNull(),
  outcome: varchar('outcome', { length: 50 }).notNull(),
  profit: bigint('profit', { mode: 'number' }).notNull(),
  balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const gameSessions = pgTable(
  'game_sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    gameType: varchar('game_type', { length: 50 }).notNull(),
    state: text('state').notNull(), // JSON-encoded game state
    betAmount: bigint('bet_amount', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (t) => ({
    // At most one live Crash round per user. Crash deducts the stake at start and
    // settles seconds later, so two concurrent /crash/start requests could both
    // deduct and arm a round; this partial unique index makes the second insert
    // fail (handled as 409). Scoped to crash + unsettled rows so it never touches
    // other games or completed rounds.
    oneActiveCrashPerUser: uniqueIndex('one_active_crash_per_user')
      .on(t.userId)
      .where(sql`${t.gameType} = 'crash' AND ${t.completedAt} IS NULL`),
  }),
);

export const dailyBonusClaims = pgTable('daily_bonus_claims', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  claimedAt: timestamp('claimed_at').notNull().defaultNow(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
});

export const adminLogs = pgTable('admin_logs', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id')
    .notNull()
    .references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  targetUserId: integer('target_user_id').references(() => users.id),
  details: text('details'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  type: varchar('type', { length: 20 }).notNull(), // 'verify_email' | 'password_reset'
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Social: friendships ────────────────────────────────────────────────────
// Directed pair (requester → addressee) gives incoming vs outgoing for free.
// Friends of U = accepted rows where U is on either side; the friend is the
// other column. A decline DELETEs the row (lets them re-ask); a remove also
// DELETEs; a block sets status='blocked' (requester = the blocker). The
// reverse-direction duplicate (B→A while A→B exists) is prevented in the
// service layer, and a mutual pending request auto-accepts.
export const friendships = pgTable(
  'friendships',
  {
    id: serial('id').primaryKey(),
    requesterId: integer('requester_id').notNull().references(() => users.id),
    addresseeId: integer('addressee_id').notNull().references(() => users.id),
    // 'pending' | 'accepted' | 'blocked'
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    respondedAt: timestamp('responded_at'),
  },
  (t) => ({
    // One row per ordered pair.
    uniquePair: uniqueIndex('friendship_unique_pair').on(t.requesterId, t.addresseeId),
  }),
);
