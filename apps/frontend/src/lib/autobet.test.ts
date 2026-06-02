import { describe, it, expect } from 'vitest';
import {
  type AutoBetConfig,
  DEFAULT_AUTOBET_CONFIG,
  checkStops,
  nextStake,
  stopMessage,
} from './autobet';

function cfg(over: Partial<AutoBetConfig> = {}): AutoBetConfig {
  return { ...DEFAULT_AUTOBET_CONFIG, baseBet: 10, ...over };
}

describe('nextStake', () => {
  it('resets to the base bet on the configured outcome', () => {
    const c = cfg({ baseBet: 25, onWin: { action: 'reset', pct: 0 } });
    expect(nextStake(400, c, true)).toBe(25); // a win → reset
  });

  it('increases the stake by the configured percent', () => {
    const c = cfg({ onLoss: { action: 'increase', pct: 100 } });
    expect(nextStake(10, c, false)).toBe(20); // classic martingale: double on loss
    expect(nextStake(20, c, false)).toBe(40);
  });

  it('rounds increased stakes to whole coins', () => {
    const c = cfg({ onLoss: { action: 'increase', pct: 50 } });
    expect(nextStake(15, c, false)).toBe(23); // 15 * 1.5 = 22.5 → 23
  });

  it('applies on-win vs on-loss based on the outcome', () => {
    const c = cfg({ onWin: { action: 'increase', pct: 20 }, onLoss: { action: 'reset', pct: 0 } });
    expect(nextStake(50, c, true)).toBe(60); // win → +20%
    expect(nextStake(50, c, false)).toBe(10); // loss → reset to base
  });

  it('never drops below 1', () => {
    const c = cfg({ baseBet: 1, onWin: { action: 'reset', pct: 0 } });
    expect(nextStake(100, c, true)).toBe(1);
  });

  it('clamps to maxBet when set', () => {
    const c = cfg({ onLoss: { action: 'increase', pct: 100 }, maxBet: 30 });
    expect(nextStake(20, c, false)).toBe(30); // 40 capped to 30
    expect(nextStake(30, c, false)).toBe(30); // stays capped
  });
});

describe('checkStops', () => {
  it('returns null when no thresholds are configured', () => {
    expect(checkStops(9999, cfg())).toBeNull();
    expect(checkStops(-9999, cfg())).toBeNull();
  });

  it('fires on profit once cumulative net reaches the target', () => {
    const c = cfg({ stopOnProfit: 100 });
    expect(checkStops(99, c)).toBeNull();
    expect(checkStops(100, c)).toBe('profit');
    expect(checkStops(150, c)).toBe('profit');
  });

  it('fires on loss once cumulative net falls to -limit', () => {
    const c = cfg({ stopOnLoss: 50 });
    expect(checkStops(-49, c)).toBeNull();
    expect(checkStops(-50, c)).toBe('loss');
    expect(checkStops(-75, c)).toBe('loss');
  });

  it('checks profit before loss when both could apply', () => {
    const c = cfg({ stopOnProfit: 10, stopOnLoss: 10 });
    expect(checkStops(20, c)).toBe('profit');
    expect(checkStops(-20, c)).toBe('loss');
  });
});

describe('stopMessage', () => {
  it('is silent for count/manual stops and speaks for the rest', () => {
    expect(stopMessage('count')).toBeNull();
    expect(stopMessage('manual')).toBeNull();
    expect(stopMessage('profit')).toMatch(/profit/i);
    expect(stopMessage('loss')).toMatch(/loss/i);
    expect(stopMessage('funds')).toMatch(/coins/i);
    expect(stopMessage('rate')).toMatch(/slow down/i);
    expect(stopMessage('error')).toMatch(/wrong/i);
  });
});
