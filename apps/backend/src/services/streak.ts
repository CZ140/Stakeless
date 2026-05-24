// Pure streak math, extracted so it can be unit-tested without pulling the
// profile router (and its db connection) into the test.

const DAY_MS = 86_400_000;

function toUTC(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
}

/**
 * Current consecutive active-day streak from a list of distinct 'YYYY-MM-DD'
 * days ordered most-recent first. Returns 0 unless the latest active day is
 * today or yesterday (so a lapsed streak reads as 0), then counts back while
 * each prior day is exactly one calendar day earlier.
 *
 * @param daysDesc distinct active days, newest first (e.g. ['2026-05-24', '2026-05-23'])
 * @param now      reference time (defaults to Date.now()); injectable for tests
 */
export function computeStreak(daysDesc: string[], now: number = Date.now()): number {
  if (daysDesc.length === 0) return 0;
  const n = new Date(now);
  const today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const latest = toUTC(daysDesc[0]!);
  if (latest !== today && latest !== today - DAY_MS) return 0;
  let streak = 1;
  for (let i = 1; i < daysDesc.length; i++) {
    if (toUTC(daysDesc[i - 1]!) - toUTC(daysDesc[i]!) === DAY_MS) streak++;
    else break;
  }
  return streak;
}
