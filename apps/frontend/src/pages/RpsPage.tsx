import { useShallow } from 'zustand/react/shallow';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { RPS, RPS_CHOICES, rpsWinMultiplier, type RpsChoice } from '@gambling/shared';
import { AppShell } from '../components/vault/AppShell';
import { GamePageHeader } from '../components/vault/GamePageHeader';
import { BetPanel } from '../components/vault/BetPanel';
import { useRpsStore } from '../stores/rpsStore';
import { useBalanceStore } from '../stores/balanceStore';
import { useAudioStore } from '../stores/audioStore';
import { sound } from '../lib/sound';
import { celebrate, pulse, winTier } from '../lib/juice';
import { prefersReducedMotion } from '../hooks/useReducedMotion';
import { useAutoBet } from '../hooks/useAutoBet';
import type { RoundResult } from '../lib/autobet';
import { apiClient } from '../api/client';
import { sleep } from '../lib/sleep';
import { handleApiError } from '../lib/handleApiError';

const RPS_ANIM_MS = 1200; // shake → reveal before the next auto bet

interface RpsResponse {
  choice: RpsChoice;
  house: RpsChoice;
  outcome: 'win' | 'tie' | 'loss';
  multiplier: number;
  profit: number;
  newBalance: number;
}

const THROW_EMOJI: Record<RpsChoice, string> = { rock: '✊', paper: '✋', scissors: '✌️' };
const THROW_LABEL: Record<RpsChoice, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };
const FIST = '✊'; // closed fist shown while shaking, before the reveal
const COUNT = ['Rock…', 'Paper…', 'Scissors…'];

export function RpsPage() {
  const { betAmount, choice, playing, lastResult, setBetAmount, setChoice, setPlaying, setLastResult } = useRpsStore(useShallow((s) => ({ betAmount: s.betAmount, choice: s.choice, playing: s.playing, lastResult: s.lastResult, setBetAmount: s.setBetAmount, setChoice: s.setChoice, setPlaying: s.setPlaying, setLastResult: s.setLastResult })));
  const { muted, toggleMute } = useAudioStore();
  const balance = useBalanceStore((s) => s.balance);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [count, setCount] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const playerHandRef = useRef<HTMLSpanElement>(null);
  const houseHandRef = useRef<HTMLSpanElement>(null);

  const multiplier = rpsWinMultiplier();
  const profitOnWin = Math.max(0, Math.floor(betAmount * multiplier) - betAmount);

  // Run the shake → reveal → settle sequence once the server result is known.
  useEffect(() => {
    if (!lastResult) return;
    const reduced = prefersReducedMotion();

    const settle = () => {
      setCount(null);
      if (lastResult.outcome === 'win') {
        pulse(playerHandRef.current, '#B392F0');
        celebrate(winTier(lastResult.profit, betAmount), { shakeEl: stageRef.current, originEl: playerHandRef.current });
      } else if (lastResult.outcome === 'tie') {
        sound.chip();
      } else {
        celebrate('none'); // loss stinger
      }
      setPlaying(false);
    };

    if (reduced) {
      setRevealed(true);
      settle();
      return;
    }

    setRevealed(false);
    const hands = [playerHandRef.current, houseHandRef.current];
    const tl = gsap.timeline();
    for (let i = 0; i < 3; i++) {
      tl.to(hands, { y: -20, duration: 0.14, ease: 'power1.out', onStart: () => { setCount(COUNT[i]!); sound.tick(); } })
        .to(hands, { y: 0, duration: 0.14, ease: 'power1.in' });
    }
    tl.add(() => { setCount('Shoot!'); setRevealed(true); });
    tl.fromTo(hands, { scale: 0.7 }, { scale: 1, duration: 0.26, ease: 'back.out(2.6)' });
    tl.add(settle);
    return () => { tl.kill(); };
    // betAmount is locked during play; lastResult identity drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastResult]);

  // One round at `stake`: fire the throw, run the shake/reveal, resolve net result.
  // A tie is a push (profit 0) → counts as non-losing for stake progression.
  async function playRound(stake: number): Promise<RoundResult> {
    setBetAmount(stake);
    sound.unlock();
    sound.tick();
    setRevealed(false);
    setPlaying(true);
    localStorage.setItem('lastBet_rps', String(stake));
    let d: RpsResponse;
    try {
      d = (await apiClient.post<RpsResponse>('/games/rps/bet', { betAmount: stake, choice })).data;
    } catch (e) {
      setPlaying(false); // the reveal animation never runs on error, so reset here
      throw e;
    }
    useBalanceStore.getState().setBalance(d.newBalance);
    setLastResult({ choice: d.choice, house: d.house, outcome: d.outcome, multiplier: d.multiplier, profit: d.profit });
    await sleep(prefersReducedMotion() ? 0 : RPS_ANIM_MS);
    return { profit: d.profit, win: d.profit >= 0 };
  }

  const auto = useAutoBet(playRound);

  async function handleShoot() {
    if (playing || auto.running) return;
    setError(null);
    setRevealed(false);
    try {
      await playRound(betAmount);
    } catch (err: unknown) {
      sound.error();
      handleApiError(err, setError, { rateLimitMsg: 'Too fast — slow down.' });
    }
  }

  const r = lastResult;
  const showResult = revealed && r;
  const playerHandCls = 'rps-hand' + (showResult ? (r.outcome === 'win' ? ' won' : r.outcome === 'loss' ? ' lost' : ' tied') : '');
  const houseHandCls = 'rps-hand mirror' + (showResult ? (r.outcome === 'loss' ? ' won' : r.outcome === 'win' ? ' lost' : ' tied') : '');

  const resultText = (() => {
    if (!showResult) return playing ? 'Rock, paper, scissors…' : 'Pick your throw and shoot';
    if (r.outcome === 'win') return `${THROW_LABEL[r.choice]} beats ${r.house} — won +${r.profit.toLocaleString()} coins`;
    if (r.outcome === 'tie') return `Tie — both threw ${r.house} · stake returned`;
    return `${THROW_LABEL[r.house]} beats ${r.choice} — lost ${betAmount.toLocaleString()} coins`;
  })();
  const resultColor = showResult ? (r.outcome === 'win' ? 'var(--win)' : r.outcome === 'loss' ? 'var(--loss)' : 'var(--text-secondary)') : 'var(--text-muted)';

  return (
    <AppShell>
      <GamePageHeader
        crumb="RPS"
        title="Rock · Paper · Scissors"
        specs={[`${multiplier.toFixed(2)}× ON WIN`, 'TIE PUSHES', '97% RTP']}
        muted={muted}
        onToggleMute={toggleMute}
        error={error}
      />

      <div className="game-layout">
        <div className="game-stage">
          <div className="rps-stage" ref={stageRef}>
            <div className="rps-arena">
              <div className="rps-side">
                <div className="rps-who">YOU</div>
                <span className={playerHandCls} ref={playerHandRef}>{showResult ? THROW_EMOJI[r.choice] : FIST}</span>
              </div>
              <div className="rps-vs">{count ?? 'VS'}</div>
              <div className="rps-side">
                <div className="rps-who">HOUSE</div>
                <span className={houseHandCls} ref={houseHandRef}>{showResult ? THROW_EMOJI[r.house] : FIST}</span>
              </div>
            </div>

            <div className="hilo-hint" style={{ color: resultColor }}>{resultText}</div>

            {/* Throw picker */}
            <div className="rps-picks opt-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {RPS_CHOICES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={'rps-pick' + (choice === c ? ' active' : '')}
                  disabled={playing}
                  onClick={() => setChoice(c)}
                >
                  <span className="emo">{THROW_EMOJI[c]}</span>
                  <span className="lbl">{THROW_LABEL[c]}</span>
                </button>
              ))}
            </div>

            {/* Live stats — shares the dice stat-strip layout. */}
            <div className="dice-stats">
              <div className="col">
                <div className="section-title">Your throw</div>
                <div className="num v">{THROW_LABEL[choice]}</div>
              </div>
              <div className="divider" />
              <div className="col">
                <div className="section-title">Win chance</div>
                <div className="num v">{Math.round(RPS.WIN_CHANCE * 100)}%</div>
              </div>
              <div className="divider" />
              <div className="col">
                <div className="section-title">Win pays</div>
                <div className="num v" style={{ color: 'var(--accent)' }}>{multiplier.toFixed(2)}×</div>
              </div>
            </div>
          </div>
        </div>

        <BetPanel
          amount={betAmount}
          onAmountChange={setBetAmount}
          balance={balance}
          amountLocked={playing}
          multiplier={multiplier.toFixed(2)}
          profitOnWin={profitOnWin}
          summary={[
            { label: 'Win chance', value: '33%' },
            { label: 'Tie (push)', value: '33%' },
          ]}
          primaryLabel={playing ? 'Shooting…' : `Shoot · ${THROW_LABEL[choice]}`}
          onPrimary={() => { void handleShoot(); }}
          primaryDisabled={playing || auto.running}
          autoBet={{
            running: auto.running,
            stats: auto.stats,
            onStart: (cfg) => auto.start({ ...cfg, baseBet: betAmount }),
            onStop: auto.stop,
            storageKey: 'autobet_rps',
          }}
        />
      </div>
    </AppShell>
  );
}

export default RpsPage;
