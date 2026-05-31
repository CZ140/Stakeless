import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { RAKEBACK_RATE } from '@gambling/shared';
import { apiClient } from '../../api/client';
import { useBalanceStore } from '../../stores/balanceStore';
import { CoinIcon, RefreshIcon } from './icons';

interface Props {
  // Coins of rakeback claimable right now (snapshot from the profile fetch).
  rakebackAvailable: number;
}

interface RakebackResponse {
  newBalance: number;
  amount: number;
}

const RATE_PCT = `${(RAKEBACK_RATE * 100).toFixed(0)}%`;

// Vault-styled rakeback banner. Rakeback is a flat fraction of everything wagered
// since the last claim — it builds as the player bets and can be claimed any time
// (no cooldown). The amount shown is a snapshot from the last profile load; the
// claim response is authoritative for the actual credit.
export function VaultRakeback({ rakebackAvailable }: Props) {
  const [available, setAvailable] = useState(rakebackAvailable);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    setAvailable(rakebackAvailable);
  }, [rakebackAvailable]);

  const claim = useCallback(async () => {
    setClaiming(true);
    try {
      const res = await apiClient.post<RakebackResponse>('/wallet/rakeback');
      useBalanceStore.getState().setBalance(res.data.newBalance);
      setAvailable(0); // watermark advanced server-side; only a sub-coin remainder carries over
      toast.success(`Rakeback claimed! +${res.data.amount.toLocaleString()} coins`);
    } catch (error: unknown) {
      const axiosError = error as { response?: { status: number } };
      if (axiosError.response?.status === 409) {
        toast.error('No rakeback available yet — keep playing to earn more.');
        setAvailable(0);
      } else {
        toast.error('Failed to claim rakeback. Try again.');
      }
    } finally {
      setClaiming(false);
    }
  }, []);

  const hasRakeback = available >= 1;

  return (
    <div className="bonus">
      <div className="bonus-coin">
        <CoinIcon size={42} />
      </div>
      <div className="bonus-content">
        <div className="bonus-eyebrow">Rakeback</div>
        <div className="bonus-title">
          {hasRakeback ? (
            <>
              <span className="bonus-amount">{available.toLocaleString()}</span> coins ready
            </>
          ) : (
            <>Earn {RATE_PCT} back on every bet</>
          )}
        </div>
        <div className="bonus-sub">
          {hasRakeback
            ? `${RATE_PCT} of your wagering since you last claimed · no cooldown`
            : `Place bets to build rakeback — ${RATE_PCT} of everything you wager`}
        </div>
      </div>
      <div className="bonus-cta">
        <button
          className="btn btn-primary"
          style={{ padding: '12px 28px' }}
          onClick={() => void claim()}
          disabled={claiming || !hasRakeback}
        >
          <RefreshIcon size={14} /> {claiming ? 'Claiming…' : 'Claim'}
        </button>
      </div>
    </div>
  );
}
