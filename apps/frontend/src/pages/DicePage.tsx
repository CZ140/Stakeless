import { useState } from 'react';
import { diceWinChance, diceMultiplier, type DiceDirection } from '@gambling/shared';
import { AppShell } from '../components/vault/AppShell';
import { BetPanel } from '../components/vault/BetPanel';
import { useDiceStore } from '../stores/diceStore';
import { useBalanceStore } from '../stores/balanceStore';
import { useGameSounds } from '../hooks/useGameSounds';
import { apiClient } from '../api/client';

interface DiceResponse {
  roll: number;
  target: number;
  direction: DiceDirection;
  win: boolean;
  multiplier: number;
  winChance: number;
  profit: number;
  newBalance: number;
}

const WIN = 'var(--win, #00E082)';
const LOSE = 'rgba(240, 68, 90, 0.30)';

export function DicePage() {
  const {
    betAmount, target, direction, isMuted, rolling, lastResult,
    setBetAmount, setTarget, setDirection, toggleMute, setRolling, setLastResult,
  } = useDiceStore();
  const { playWin, playLoss } = useGameSounds(isMuted);
  const balance = useBalanceStore((s) => s.balance);
  const [error, setError] = useState<string | null>(null);

  // Live (pre-roll) odds for the current target + direction.
  const winChance = diceWinChance(target, direction);
  const multiplier = diceMultiplier(target, direction);
  const profitOnWin = Math.max(0, Math.floor(betAmount * multiplier) - betAmount);

  async function handleRoll() {
    if (rolling) return;
    setError(null);
    setRolling(true);
    localStorage.setItem('lastBet_dice', String(betAmount));
    try {
      const res = await apiClient.post<DiceResponse>('/games/dice/bet', { betAmount, target, direction });
      const d = res.data;
      useBalanceStore.getState().setBalance(d.newBalance);
      setLastResult({
        roll: d.roll, win: d.win, multiplier: d.multiplier, profit: d.profit, target: d.target, direction: d.direction,
      });
      if (d.win) playWin();
      else playLoss();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string }; status?: number } };
      if (ax.response?.status === 402) setError('Insufficient funds.');
      else if (ax.response?.status === 429) setError('Too many rolls too fast — slow down.');
      else setError(ax.response?.data?.error ?? 'Something went wrong. Please try again.');
    } finally {
      setRolling(false);
    }
  }

  // Slider win zone: green on the winning side of the target, muted-red on the other.
  const t = target;
  const trackGradient =
    direction === 'under'
      ? `linear-gradient(to right, ${WIN} 0%, ${WIN} ${t}%, ${LOSE} ${t}%, ${LOSE} 100%)`
      : `linear-gradient(to right, ${LOSE} 0%, ${LOSE} ${t}%, ${WIN} ${t}%, ${WIN} 100%)`;

  const rollValue = lastResult ? lastResult.roll.toFixed(2) : '00.00';
  const rollColor = lastResult ? (lastResult.win ? 'var(--win)' : 'var(--loss)') : 'var(--text-muted)';

  return (
    <AppShell>
      <div className="crumb">
        <span>HOME</span><span className="crumb-sep">/</span><span>GAMES</span>
        <span className="crumb-sep">/</span><span style={{ color: 'var(--text-secondary)' }}>DICE</span>
      </div>
      <div className="game-page-head">
        <h1 className="h-title">Dice</h1>
        <div className="game-meta-spec">
          <span>0.00–99.99</span><span className="dot">·</span><span>PROVABLY-FAIR STYLE</span>
          <button className="icon-btn" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'} style={{ fontSize: 14 }}>
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {error && <div className="notice loss" style={{ marginBottom: 16, textAlign: 'left' }}>{error}</div>}

      <div className="game-layout">
        <div className="game-stage">
          <div className="dice-stage">
            {/* Rolled value */}
            <div className="dice-result" style={{ color: rollColor }}>
              {rollValue}
              {lastResult && (
                <div className="dice-result-label" style={{ color: rollColor }}>
                  {lastResult.win ? `WON · +${lastResult.profit}` : `LOST · ${lastResult.profit}`}
                </div>
              )}
            </div>

            {/* Direction toggle */}
            <div className="opt-grid dice-dir" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <button type="button" className={direction === 'under' ? 'active' : ''} onClick={() => setDirection('under')}>
                Roll under
              </button>
              <button type="button" className={direction === 'over' ? 'active' : ''} onClick={() => setDirection('over')}>
                Roll over
              </button>
            </div>

            {/* Slider */}
            <div className="dice-slider-wrap">
              <input
                className="dice-slider"
                type="range"
                min={0}
                max={100}
                step={1}
                value={target}
                onChange={(e) => setTarget(+e.target.value)}
                style={{ background: trackGradient }}
                aria-label="Dice target"
              />
              {lastResult && (
                <div className="dice-roll-marker" style={{ left: `${lastResult.roll}%` }}>
                  <span className="dice-roll-flag">{lastResult.roll.toFixed(2)}</span>
                </div>
              )}
              <div className="dice-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
            </div>

            {/* Live stats */}
            <div className="dice-stats">
              <div className="col">
                <div className="section-title">Target</div>
                <div className="num v">{direction === 'under' ? '<' : '>'} {target.toFixed(2)}</div>
              </div>
              <div className="divider" />
              <div className="col">
                <div className="section-title">Win chance</div>
                <div className="num v">{(winChance * 100).toFixed(2)}%</div>
              </div>
              <div className="divider" />
              <div className="col">
                <div className="section-title">Multiplier</div>
                <div className="num v" style={{ color: 'var(--accent)' }}>{multiplier.toFixed(2)}×</div>
              </div>
            </div>
          </div>
        </div>

        <BetPanel
          amount={betAmount}
          onAmountChange={setBetAmount}
          balance={balance}
          multiplier={multiplier.toFixed(2)}
          profitOnWin={profitOnWin}
          summary={[{ label: 'Win chance', value: `${(winChance * 100).toFixed(2)}%` }]}
          primaryLabel={rolling ? 'Rolling…' : 'Roll dice'}
          onPrimary={() => { void handleRoll(); }}
          primaryDisabled={rolling}
        />
      </div>
    </AppShell>
  );
}

export default DicePage;
