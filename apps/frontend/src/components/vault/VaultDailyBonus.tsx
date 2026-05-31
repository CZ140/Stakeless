import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { tierByLevel, streakBonusAmount, STREAK_RESET_MS } from '@gambling/shared';
import { apiClient } from '../../api/client';
import { useBalanceStore } from '../../stores/balanceStore';
import { CoinIcon, ZapIcon } from './icons';

interface Props {
  dailyBonusTimestamp: string | null;
  // Consecutive-day streak of the player's last claim (0 if never claimed).
  bonusStreak?: number;
}

interface BonusClaimResponse {
  newBalance: number;
  nextClaimAt: string;
  amount: number;
  streak: number;
}

interface BonusErrorResponse {
  error: string;
  msUntilNext: number;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function computeNextClaimAt(timestamp: string | null): string | null {
  if (!timestamp) return null;
  const nextAt = Date.parse(timestamp) + 24 * 60 * 60 * 1000;
  return nextAt > Date.now() ? new Date(nextAt).toISOString() : null;
}

// Vault-styled daily bonus banner. Visual is ported from the design; the claim
// flow, amount (+100) and 24h cooldown are the real backend behaviour.
// The streak the next claim will earn, given the stored streak and when the last
// claim happened: continue (+1) if still inside the reset window, else restart at
// 1. Mirrors the backend's nextStreak() so the preview matches what's credited.
function previewStreak(storedStreak: number, dailyBonusTimestamp: string | null): number {
  if (!dailyBonusTimestamp) return 1;
  const since = Date.now() - Date.parse(dailyBonusTimestamp);
  return since > STREAK_RESET_MS ? 1 : storedStreak + 1;
}

export function VaultDailyBonus({ dailyBonusTimestamp, bonusStreak = 0 }: Props) {
  const [claiming, setClaiming] = useState(false);
  const [nextClaimAt, setNextClaimAt] = useState<string | null>(() => computeNextClaimAt(dailyBonusTimestamp));
  const [countdown, setCountdown] = useState('');
  // The streak the next claim will earn (drives the previewed amount); replaced by
  // the authoritative value from the claim response once claimed.
  const [streak, setStreak] = useState<number>(() => previewStreak(bonusStreak, dailyBonusTimestamp));
  // The banner previews the player's tier-scaled, streak-multiplied amount; the
  // claim response is authoritative for the actual credit (and the toast).
  const tierLevel = useBalanceStore((s) => s.tierLevel);
  const baseAmount = tierByLevel(tierLevel ?? 0).dailyBonus;
  const bonusAmount = streakBonusAmount(baseAmount, streak);

  // Keep local cooldown + streak in sync once the profile fetch resolves.
  useEffect(() => {
    setNextClaimAt(computeNextClaimAt(dailyBonusTimestamp));
    setStreak(previewStreak(bonusStreak, dailyBonusTimestamp));
  }, [dailyBonusTimestamp, bonusStreak]);

  useEffect(() => {
    if (!nextClaimAt) {
      setCountdown('');
      return;
    }
    const update = () => {
      const remaining = Date.parse(nextClaimAt) - Date.now();
      if (remaining <= 0) {
        setNextClaimAt(null);
        setCountdown('');
      } else {
        setCountdown(formatCountdown(remaining));
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextClaimAt]);

  const claim = useCallback(async () => {
    setClaiming(true);
    try {
      const res = await apiClient.post<BonusClaimResponse>('/wallet/bonus');
      useBalanceStore.getState().setBalance(res.data.newBalance);
      setNextClaimAt(res.data.nextClaimAt);
      setStreak(res.data.streak);
      const streakNote = res.data.streak > 1 ? ` · ${res.data.streak}-day streak 🔥` : '';
      toast.success(`Bonus claimed! +${res.data.amount.toLocaleString()} coins${streakNote}`);
    } catch (error: unknown) {
      const axiosError = error as { response?: { status: number; data?: BonusErrorResponse } };
      if (axiosError.response?.status === 429 && axiosError.response.data?.msUntilNext) {
        const ms = axiosError.response.data.msUntilNext;
        setNextClaimAt(new Date(Date.now() + ms).toISOString());
        toast.error(`Next bonus in ${formatCountdown(ms)}`);
      } else {
        toast.error('Failed to claim bonus. Try again.');
      }
    } finally {
      setClaiming(false);
    }
  }, []);

  const onCooldown = nextClaimAt !== null;

  return (
    <div className="bonus">
      <div className="bonus-coin">
        <CoinIcon size={42} />
      </div>
      <div className="bonus-content">
        <div className="bonus-eyebrow">Daily Bonus</div>
        <div className="bonus-title">
          Claim your <span className="bonus-amount">{bonusAmount.toLocaleString()}</span> daily coins
        </div>
        <div className="bonus-sub">
          {tierByLevel(tierLevel ?? 0).name} tier · resets every 24 hours
          {streak > 1 && (
            <> · <span style={{ color: 'var(--gold)' }}>🔥 {streak}-day streak ({streak}×)</span></>
          )}
        </div>
      </div>
      <div className="bonus-cta">
        {onCooldown ? (
          <div className="cooldown">
            <small>Next in</small>
            {countdown}
          </div>
        ) : (
          <button className="btn btn-primary" style={{ padding: '12px 28px' }} onClick={() => void claim()} disabled={claiming}>
            <ZapIcon size={14} /> {claiming ? 'Claiming…' : 'Claim now'}
          </button>
        )}
      </div>
    </div>
  );
}
