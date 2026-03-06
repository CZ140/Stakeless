import { db } from '../db/index.js';
import { users, gameLogs, adminLogs, refreshTokens } from '../db/schema.js';
import { eq, desc, ilike, sql, sum, count } from 'drizzle-orm';

// ─── Audit log helper ─────────────────────────────────────────────────────────
export async function logAdminAction(
  adminId: number,
  action: string,
  targetUserId: number | null,
  details: string,
): Promise<void> {
  await db.insert(adminLogs).values({ adminId, action, targetUserId, details });
}

// ─── Dashboard stats (ADMIN-02) ───────────────────────────────────────────────
export async function getDashboardStats() {
  const [totalUsersRow, totalBetsRow, coinCircRow, mostActive] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(gameLogs),
    db.select({ total: sum(users.balance) }).from(users),
    db
      .select({ userId: gameLogs.userId, username: users.username, bets: count() })
      .from(gameLogs)
      .innerJoin(users, eq(gameLogs.userId, users.id))
      .groupBy(gameLogs.userId, users.username)
      .orderBy(desc(count()))
      .limit(5),
  ]);
  return {
    totalUsers: Number(totalUsersRow[0]?.count ?? 0),
    totalBets: Number(totalBetsRow[0]?.count ?? 0),
    coinsInCirculation: Number(coinCircRow[0]?.total ?? 0),
    mostActiveUsers: mostActive.map(r => ({ userId: r.userId, username: r.username, bets: Number(r.bets) })),
  };
}

// ─── Player search (ADMIN-03) ─────────────────────────────────────────────────
export async function searchPlayer(query: string) {
  return db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      balance: users.balance,
      totalWagered: users.totalWagered,
      role: users.role,
      isBanned: users.isBanned,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(ilike(users.username, `%${query}%`))
    .limit(20);
}

// ─── Player game history (ADMIN-03) ──────────────────────────────────────────
export async function getPlayerHistory(userId: number) {
  return db
    .select({
      id: gameLogs.id,
      gameType: gameLogs.gameType,
      betAmount: gameLogs.betAmount,
      outcome: gameLogs.outcome,
      profit: gameLogs.profit,
      createdAt: gameLogs.createdAt,
    })
    .from(gameLogs)
    .where(eq(gameLogs.userId, userId))
    .orderBy(desc(gameLogs.createdAt))
    .limit(50);
}

// ─── Ban user (ADMIN-04) ──────────────────────────────────────────────────────
export async function banUser(targetUserId: number): Promise<void> {
  // Set isBanned=true and increment tokenVersion atomically
  await db
    .update(users)
    .set({
      isBanned: true,
      tokenVersion: sql`${users.tokenVersion} + 1`,
    })
    .where(eq(users.id, targetUserId));

  // Delete all refresh token rows so the banned user cannot obtain a new access token.
  // refreshToken() in authService.ts only queries refresh_tokens — if the row is gone it
  // returns null, which causes the auth route to send 401, forcing re-login.
  // Re-login is then rejected by the isBanned check in login(). (ADMIN-04 gap closure)
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, targetUserId));
}

// ─── Unban user ───────────────────────────────────────────────────────────────
export async function unbanUser(targetUserId: number): Promise<void> {
  await db.update(users).set({ isBanned: false }).where(eq(users.id, targetUserId));
}
