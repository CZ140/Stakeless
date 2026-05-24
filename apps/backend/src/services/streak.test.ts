import { describe, it, expect } from 'vitest';
import { computeStreak } from './streak.js';

// Fixed reference "now" = 2026-05-24 12:00 UTC, so "today" is 2026-05-24.
const NOW = Date.UTC(2026, 4, 24, 12, 0, 0);

describe('computeStreak', () => {
  it('returns 0 for no active days', () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it('counts a single active day today as 1', () => {
    expect(computeStreak(['2026-05-24'], NOW)).toBe(1);
  });

  it('counts a single active day yesterday as 1 (streak not yet lapsed)', () => {
    expect(computeStreak(['2026-05-23'], NOW)).toBe(1);
  });

  it('returns 0 when the most recent activity is 2+ days ago (lapsed)', () => {
    expect(computeStreak(['2026-05-22'], NOW)).toBe(0);
    expect(computeStreak(['2026-05-20', '2026-05-19'], NOW)).toBe(0);
  });

  it('counts a full consecutive run ending today', () => {
    expect(computeStreak(['2026-05-24', '2026-05-23', '2026-05-22'], NOW)).toBe(3);
  });

  it('counts a consecutive run ending yesterday', () => {
    expect(computeStreak(['2026-05-23', '2026-05-22', '2026-05-21'], NOW)).toBe(3);
  });

  it('stops counting at the first gap', () => {
    // today, yesterday, then a gap (skips 2026-05-22)
    expect(computeStreak(['2026-05-24', '2026-05-23', '2026-05-21', '2026-05-20'], NOW)).toBe(2);
  });

  it('a lone today with an older cluster is just 1', () => {
    expect(computeStreak(['2026-05-24', '2026-05-20'], NOW)).toBe(1);
  });

  it('handles month boundaries correctly', () => {
    const june1 = Date.UTC(2026, 5, 1, 9, 0, 0);
    expect(computeStreak(['2026-06-01', '2026-05-31', '2026-05-30'], june1)).toBe(3);
  });

  it('handles a long unbroken streak', () => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 4, 24 - i));
      return d.toISOString().slice(0, 10);
    });
    expect(computeStreak(days, NOW)).toBe(30);
  });

  it('a future-only date does not count', () => {
    expect(computeStreak(['2026-05-26'], NOW)).toBe(0);
  });
});
