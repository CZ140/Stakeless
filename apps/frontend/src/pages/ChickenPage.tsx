import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  CHICKEN_DIFFICULTY_IDS,
  CHICKEN_DIFFICULTIES,
  chickenDeathChance,
  chickenMultiplier,
  chickenMaxLanes,
  type ChickenDifficulty,
} from '@gambling/shared';
import { AppShell } from '../components/vault/AppShell';
import { BetPanel } from '../components/vault/BetPanel';
import { useChickenStore } from '../stores/chickenStore';
import { useBalanceStore } from '../stores/balanceStore';
import { useAudioStore } from '../stores/audioStore';
import { sound } from '../lib/sound';
import { celebrate, winTier } from '../lib/juice';
import { prefersReducedMotion } from '../hooks/useReducedMotion';
import { apiClient } from '../api/client';

interface StartResponse { sessionId: number; difficulty: ChickenDifficulty; lane: number; multiplier: number; maxLanes: number; newBalance: number }
interface StepResponse { dead: boolean; lane: number; multiplier: number; crossed: boolean; newBalance?: number }
interface CashoutResponse { payout: number; newBalance: number; multiplier: number; lane: number }
interface ActiveSessionResponse {
  session: null | { sessionId: number; difficulty: ChickenDifficulty; lane: number; multiplier: number; maxLanes: number; betAmount: number };
}

export function ChickenPage() {
  const {
    betAmount, difficulty, phase, sessionId, lane, multiplier, maxLanes, crossed, deadLane, result,
    setBetAmount, setDifficulty, startRound, applyAdvance, applyDeath, applyCashout, restoreSession, reset,
  } = useChickenStore();
  const { muted, toggleMute } = useAudioStore();
  const balance = useBalanceStore((s) => s.balance);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const roadRef = useRef<HTMLDivElement>(null);
  const chickenRef = useRef<HTMLSpanElement>(null);

  // The number of lanes to render — fixed by difficulty even in the betting phase
  // so the road previews the climb the player is about to take.
  const roadLanes = phase === 'betting' ? chickenMaxLanes(difficulty) : maxLanes;
  // The lane the chicken is about to step into (1-based); null once across/ended.
  const targetTile = phase === 'active' && !crossed ? lane + 1 : null;

  const resume = useCallback(async () => {
    try {
      const res = await apiClient.get<ActiveSessionResponse>('/games/chicken/active-session');
      if (res.data.session) restoreSession(res.data.session);
    } catch {
      /* no active round */
    }
  }, [restoreSession]);

  useEffect(() => { void resume(); }, [resume]);

  // Keep the chicken's lane scrolled into view, and hop it forward on each step.
  useEffect(() => {
    if (!roadRef.current) return;
    const focus = roadRef.current.querySelector('.chk-lane.is-current') ?? roadRef.current.querySelector('.chk-lane.is-dead');
    focus?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    if (phase === 'active' && lane > 0 && chickenRef.current && !prefersReducedMotion()) {
      gsap.fromTo(chickenRef.current, { y: -14 }, { y: 0, duration: 0.34, ease: 'bounce.out' });
    }
  }, [lane, phase, crossed]);

  // Auto-clear the result back to betting after a short pause.
  useEffect(() => {
    if (phase !== 'result') return;
    const t = window.setTimeout(() => reset(), 3600);
    return () => window.clearTimeout(t);
  }, [phase, reset]);

  function handleError(err: unknown) {
    sound.error();
    const ax = err as { response?: { data?: { error?: string }; status?: number } };
    const status = ax.response?.status;
    if (status === 402) setError('Insufficient funds.');
    else if (status === 409) { setError('You already have a round in progress.'); void resume(); }
    else if (status === 429) setError('Too fast — slow down.');
    else setError(ax.response?.data?.error ?? 'Something went wrong. Please try again.');
  }

  async function handleStart() {
    if (busy) return;
    sound.unlock();
    sound.cardDeal();
    setError(null);
    setBusy(true);
    localStorage.setItem('lastBet_chicken', String(betAmount));
    try {
      const res = await apiClient.post<StartResponse>('/games/chicken/start', { betAmount, difficulty });
      useBalanceStore.getState().setBalance(res.data.newBalance);
      startRound({ sessionId: res.data.sessionId, maxLanes: res.data.maxLanes });
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleStep() {
    if (busy || phase !== 'active' || sessionId == null || crossed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post<StepResponse>('/games/chicken/step', { sessionId });
      const d = res.data;
      if (d.dead) {
        applyDeath({ lane: d.lane, multiplier: d.multiplier });
        if (d.newBalance != null) useBalanceStore.getState().setBalance(d.newBalance);
        if (!prefersReducedMotion() && stageRef.current) {
          gsap.fromTo(stageRef.current, { x: -8 }, { x: 0, duration: 0.05, repeat: 5, yoyo: true, clearProps: 'x' });
        }
        celebrate('none'); // loss stinger
      } else {
        applyAdvance({ lane: d.lane, multiplier: d.multiplier, crossed: d.crossed });
        sound.tick();
      }
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleCashout() {
    if (busy || phase !== 'active' || sessionId == null || lane < 1) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post<CashoutResponse>('/games/chicken/cashout', { sessionId });
      const d = res.data;
      useBalanceStore.getState().setBalance(d.newBalance);
      applyCashout({ payout: d.payout, multiplier: d.multiplier, lane: d.lane });
      celebrate(winTier(d.payout - betAmount, betAmount), { shakeEl: stageRef.current, originEl: chickenRef.current });
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  const isActive = phase === 'active';
  const isBetting = phase === 'betting';
  const profit = Math.max(0, Math.floor(betAmount * multiplier) - betAmount);
  const cfg = CHICKEN_DIFFICULTIES[difficulty];
  const nextMultiplier = targetTile != null ? chickenMultiplier(difficulty, targetTile) : null;
  const deathPct = Math.round(chickenDeathChance(difficulty) * 100);

  let primaryLabel = busy ? 'Starting…' : 'Place bet';
  let onPrimary: () => void = () => { void handleStart(); };
  let primaryDisabled = busy;
  if (isActive) {
    if (lane > 0) {
      primaryLabel = `Cash out · ${Math.floor(betAmount * multiplier).toLocaleString()} V`;
      onPrimary = () => { void handleCashout(); };
      primaryDisabled = busy;
    } else {
      primaryLabel = 'Cross to begin';
      onPrimary = () => {};
      primaryDisabled = true;
    }
  } else if (phase === 'result') {
    primaryLabel = 'Play again';
    onPrimary = () => { reset(); };
    primaryDisabled = false;
  }

  return (
    <AppShell>
      <div className="crumb">
        <span>HOME</span><span className="crumb-sep">/</span><span>GAMES</span>
        <span className="crumb-sep">/</span><span style={{ color: 'var(--text-secondary)' }}>CHICKEN</span>
      </div>
      <div className="game-page-head">
        <h1 className="h-title">Chicken</h1>
        <div className="game-meta-spec">
          <span>CROSS THE ROAD</span><span className="dot">·</span><span>{cfg.label.toUpperCase()} · {deathPct}% / LANE</span><span className="dot">·</span><span>97% RTP</span>
          <button className="icon-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'} style={{ fontSize: 14 }}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {error && <div className="notice loss" style={{ marginBottom: 16, textAlign: 'left' }}>{error}</div>}

      <div className="game-layout">
        <div className="game-stage">
          <div className="chk-stage" ref={stageRef}>
            <div className="dice-stats">
              <div className="col">
                <div className="section-title">Multiplier</div>
                <div className="num v" style={{ color: 'var(--accent)' }}>{multiplier.toFixed(2)}×</div>
              </div>
              <div className="divider" />
              <div className="col">
                <div className="section-title">Lane</div>
                <div className="num v">{lane}{roadLanes > 0 ? `/${roadLanes}` : ''}</div>
              </div>
              <div className="divider" />
              <div className="col">
                <div className="section-title">Profit</div>
                <div className="num v" style={{ color: 'var(--win)' }}>+{profit.toLocaleString()}</div>
              </div>
            </div>

            <div className="chk-road" ref={roadRef}>
              <div className="chk-curb start" />
              {Array.from({ length: roadLanes }, (_, i) => {
                const tile = i + 1; // 1-based display lane
                const isCrossed = isActive && tile <= lane;
                const isCurrent = targetTile === tile;
                const isDead = deadLane != null && tile === deadLane + 1;
                const cls = 'chk-lane' + (isCrossed ? ' is-crossed' : '') + (isCurrent ? ' is-current' : '') + (isDead ? ' is-dead' : '');
                return (
                  <div key={tile} className={cls}>
                    <span className="chk-mult">{chickenMultiplier(difficulty, tile).toFixed(2)}×</span>
                    {(isCurrent || (isDead && phase === 'result')) && (
                      <span className="chk-chicken" ref={isCurrent ? chickenRef : undefined}>{isDead ? '💥' : '🐔'}</span>
                    )}
                    {isCrossed && !isDead && <span className="chk-tick">✓</span>}
                  </div>
                );
              })}
              <div className="chk-curb finish" />
            </div>

            <div className="hilo-hint">
              {isBetting && 'Pick a difficulty and place a bet to start crossing'}
              {isActive && !crossed && (lane > 0 ? 'Step to the next lane — or cash out before a car hits.' : 'Step onto the road to start the climb.')}
              {isActive && crossed && 'You made it across — cash out!'}
              {phase === 'result' && result && (result.won
                ? `Cashed out ${result.payout.toLocaleString()} V · ${result.lane} lane${result.lane === 1 ? '' : 's'}`
                : `💥 Hit on lane ${result.lane + 1} — lost ${betAmount.toLocaleString()} V`)}
            </div>

            <div className="pump-actions">
              <button
                type="button"
                className="chk-btn"
                disabled={!isActive || busy || crossed}
                onClick={() => { void handleStep(); }}
              >
                <span className="lbl">🐔 STEP</span>
                {nextMultiplier != null && (
                  <span className="sub">{nextMultiplier.toFixed(2)}× · {deathPct}% car</span>
                )}
              </button>
            </div>
          </div>
        </div>

        <BetPanel
          amount={betAmount}
          onAmountChange={setBetAmount}
          balance={balance}
          amountLocked={!isBetting}
          multiplier={isActive ? multiplier.toFixed(2) : undefined}
          profitOnWin={isActive && lane > 0 ? profit : undefined}
          primaryLabel={primaryLabel}
          onPrimary={onPrimary}
          primaryDisabled={primaryDisabled}
        >
          <div>
            <label className="label">Difficulty</label>
            <div className="opt-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {CHICKEN_DIFFICULTY_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={!isBetting}
                  className={difficulty === id ? 'active' : ''}
                  onClick={() => setDifficulty(id)}
                >
                  {CHICKEN_DIFFICULTIES[id].label}
                </button>
              ))}
            </div>
          </div>
        </BetPanel>
      </div>
    </AppShell>
  );
}

export default ChickenPage;
