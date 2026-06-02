import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../components/vault/AppShell';
import {
  useBlackjackStore,
  type Card,
  type BJOutcome,
  type BJHandView,
  type BJSessionView,
} from '../stores/blackjackStore';
import { useBalanceStore } from '../stores/balanceStore';
import { useAudioStore } from '../stores/audioStore';
import { useAutoBet } from '../hooks/useAutoBet';
import type { RoundResult } from '../lib/autobet';
import { AutoBetControls } from '../components/vault/AutoBetControls';
import { decideBlackjack } from '../lib/blackjackStrategy';
import { sound } from '../lib/sound';
import { celebrate, winTier } from '../lib/juice';
import { prefersReducedMotion } from '../hooks/useReducedMotion';
import { apiClient } from '../api/client';

const BJ_DEAL_MS = 700; // let the initial deal land before the first decision
const BJ_STEP_MS = 600; // pause between auto actions so each card reads
const BJ_RESULT_MS = 1700; // hold the settled result (covers the reveal) before re-deal
const bjSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// A snappy back-out overshoot for cards settling into place.
const CARD_EASE: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

// Deal-sequence timing (seconds). A card flies in (FLY_S) from the upper-right,
// then flips face-up (FLIP_S). STEP_S is the gap between successive cards being
// dealt — it drives the one-card-at-a-time rhythm. DECK_* is the entrance offset
// the card travels from.
const FLY_S = 0.34;
const FLIP_S = 0.34;
const STEP_S = 0.42;
const DECK_DX = 90;
const DECK_DY = -46;

const SUIT_SYMBOLS: Record<string, string> = { hearts: '♥', diamonds: '♦', spades: '♠', clubs: '♣' };
const RED_SUITS = new Set(['hearts', 'diamonds']);
const CHIP_VALUES = [10, 50, 100, 500];

// ─── Deal-order bookkeeping ───────────────────────────────────────────────────
// Each card on the table gets a stable key. Player keys carry card identity so a
// hit/double's new card is detected as "new"; dealer keys are positional so the
// hole card persists in place across the player_turn → settle flip (no remount).

function playerKey(h: number, i: number, c: Card): string {
  return `p${h}-${i}-${c.suit[0]}${c.rank}`;
}
function dealerKey(i: number): string {
  return `d${i}`;
}

function dealerCountForView(view: BJSessionView): number {
  return view.phase === 'settled' && view.dealer.hand ? view.dealer.hand.length : 2;
}

// All card keys currently on the table for a backend view — used to pre-seed the
// "already seen" set when resuming a session so it doesn't replay the whole deal.
function keysForView(view: BJSessionView): string[] {
  const keys: string[] = [];
  view.hands.forEach((h, hi) => h.cards.forEach((c, ci) => keys.push(playerKey(hi, ci, c))));
  const dCount = dealerCountForView(view);
  for (let i = 0; i < dCount; i++) keys.push(dealerKey(i));
  return keys;
}

interface CardMeta {
  isNew: boolean; // first time on the table → plays the fly-in entrance
  delay: number; // seconds before this card is dealt (staggers new cards)
}

// Walk the table in canonical casino order (round-robin: each player hand, then
// dealer; repeat) and assign each new card an increasing deal delay so they land
// one at a time. Cards already seen render in place with no entrance.
function buildDealMeta(
  handCards: Card[][],
  dealerCount: number,
  seen: Set<string>,
  reduced: boolean,
): Map<string, CardMeta> {
  const meta = new Map<string, CardMeta>();
  const rounds = Math.max(2, dealerCount, ...handCards.map((c) => c.length), 0);
  let newRank = 0;
  for (let r = 0; r < rounds; r++) {
    for (let h = 0; h < handCards.length; h++) {
      const c = handCards[h]?.[r];
      if (!c) continue;
      const key = playerKey(h, r, c);
      const isNew = !seen.has(key);
      meta.set(key, { isNew, delay: isNew && !reduced ? newRank * STEP_S : 0 });
      if (isNew) newRank++;
    }
    if (r < dealerCount) {
      const key = dealerKey(r);
      const isNew = !seen.has(key);
      meta.set(key, { isNew, delay: isNew && !reduced ? newRank * STEP_S : 0 });
      if (isNew) newRank++;
    }
  }
  return meta;
}

// ─── Cards ──────────────────────────────────────────────────────────────────────

function CardFace({ card }: { card: Card | 'facedown' }) {
  if (card === 'facedown') return <div className="playing-card back" />;
  const symbol = SUIT_SYMBOLS[card.suit] ?? card.suit;
  const red = RED_SUITS.has(card.suit);
  return (
    <div className={`playing-card ${red ? 'red' : 'black'}`}>
      <div className="corner tl">
        <div className="rank">{card.rank}</div>
        <div className="suit-sm">{symbol}</div>
      </div>
      <div className="center-suit">{symbol}</div>
      <div className="corner tr">
        <div className="rank">{card.rank}</div>
        <div className="suit-sm">{symbol}</div>
      </div>
    </div>
  );
}

// A two-faced card. New cards fly in from the shoe face-down then flip up after
// they land. `faceUp` is reactive: a card that arrives face-down (the dealer's
// hole) flips over later when faceUp turns true. Deal/flip cues play in step.
function DealtCard({
  card,
  faceUp,
  isNew = false,
  delay = 0,
}: {
  card: Card | null;
  faceUp: boolean;
  isNew?: boolean;
  delay?: number;
}) {
  const reduced = prefersReducedMotion();

  // Entrance cues for a freshly-dealt card: a deal thunk as it flies, a flip cue
  // as it turns over (only if it lands face-up).
  useEffect(() => {
    if (!isNew) return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => sound.cardDeal(), reduced ? 0 : delay * 1000));
    if (faceUp) timers.push(window.setTimeout(() => sound.cardFlip(), reduced ? 0 : (delay + FLY_S) * 1000));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A later reveal of an already-placed card (the dealer flipping its hole card).
  const prevFaceUp = useRef(faceUp);
  useEffect(() => {
    if (!prevFaceUp.current && faceUp && !isNew) sound.cardFlip();
    prevFaceUp.current = faceUp;
  }, [faceUp, isNew]);

  const animate = !reduced && isNew;
  const flipDelay = isNew ? (reduced ? 0 : delay + FLY_S) : 0;

  return (
    <motion.div
      className="bj-card-fly"
      initial={animate ? { opacity: 0, x: DECK_DX, y: DECK_DY } : false}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: reduced ? 0 : FLY_S, ease: CARD_EASE, delay: animate ? delay : 0 }}
    >
      <motion.div
        className="bj-card-3d"
        initial={animate ? { rotateY: 180 } : false}
        animate={{ rotateY: faceUp ? 0 : 180 }}
        transition={{ duration: reduced ? 0 : FLIP_S, ease: 'easeInOut', delay: flipDelay }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="bj-face bj-front">{card ? <CardFace card={card} /> : <div className="playing-card" />}</div>
        <div className="bj-face bj-back">
          <div className="playing-card back" />
        </div>
      </motion.div>
    </motion.div>
  );
}

function outcomeBadge(outcome: BJOutcome): { text: string; cls: string } | null {
  switch (outcome) {
    case 'player_blackjack': return { text: 'Blackjack 3:2', cls: 'win' };
    case 'player_win': return { text: 'Win', cls: 'win' };
    case 'dealer_bust': return { text: 'Dealer bust', cls: 'win' };
    case 'push': return { text: 'Push', cls: 'push' };
    case 'player_bust': return { text: 'Bust', cls: 'loss' };
    case 'dealer_win': return { text: 'Lose', cls: 'loss' };
    default: return null;
  }
}

function handNet(h: BJHandView): number {
  const effectiveBet = h.bet * (h.isDoubled ? 2 : 1);
  return (h.profit ?? 0) - effectiveBet;
}

// A single player hand (cards + footer with value / bet / outcome).
function PlayerHand({
  hand,
  index,
  active,
  settled,
  meta,
}: {
  hand: BJHandView;
  index: number;
  active: boolean;
  settled: boolean;
  meta: Map<string, CardMeta>;
}) {
  const badge = settled ? outcomeBadge(hand.outcome) : null;
  const valClass = hand.status === 'bust' ? 'bust' : hand.status === 'blackjack' ? 'bj' : '';
  return (
    <div className={`bj-hand${active ? ' active' : ''}${settled ? ' done' : ''}`}>
      <div className="cards-row">
        {hand.cards.map((c, i) => {
          const key = playerKey(index, i, c);
          const m = meta.get(key);
          return <DealtCard key={key} card={c} faceUp isNew={m?.isNew} delay={m?.delay} />;
        })}
      </div>
      <div className="bj-hand-foot">
        <span className={`bj-val ${valClass}`}>{hand.value}</span>
        <span>{hand.bet}{hand.isDoubled ? '×2' : ''} coins</span>
      </div>
      {badge ? <span className={`bj-outcome ${badge.cls}`}>{badge.text}</span> : null}
    </div>
  );
}

export function BlackjackPage() {
  const store = useBlackjackStore();
  const { muted, toggleMute } = useAudioStore();
  const balance = useBalanceStore((s) => s.balance);
  const feltRef = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();

  // Card keys that have already been dealt onto the table. Drives which cards
  // play their fly-in entrance; cleared at the start of each fresh deal.
  const seenKeysRef = useRef<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  // Gates the result display (banner, outcome badges, dealer total, win flourish)
  // until the dealer's hole card has flipped and all cards have finished dealing.
  const [resultRevealed, setResultRevealed] = useState(false);

  const { betAmount, handCount, phase, sessionId, hands, activeHandIndex, dealer, canSplit, canDouble } = store;
  const isBetting = phase === 'betting';
  const isPlayerTurn = phase === 'player_turn';
  const isSettled = phase === 'settled';

  // Resume an open hand on mount. Pre-seed the seen set so the resumed table
  // renders in place instead of replaying the whole deal animation.
  useEffect(() => {
    apiClient
      .get<{ session: BJSessionView | null }>('/games/blackjack/active-session')
      .then((res) => {
        if (res.data.session) {
          const view = res.data.session;
          keysForView(view).forEach((k) => seenKeysRef.current.add(k));
          store.applyView(view);
          if (view.phase === 'settled') setResultRevealed(true); // resumed, no replay
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Card layout for the current phase + per-card deal metadata (new? + delay).
  const handCards: Card[][] = isBetting ? [] : hands.map((h) => h.cards);
  const dealerCount = isBetting ? 0 : isSettled && dealer.hand ? dealer.hand.length : 2;
  const dealMeta = buildDealMeta(handCards, dealerCount, seenKeysRef.current, reduced);
  const currentKeys = [...dealMeta.keys()];

  // Once a render has placed a card, mark it seen so it won't re-animate.
  useEffect(() => {
    for (const k of currentKeys) seenKeysRef.current.add(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKeys.join('|')]);

  // Reveal the result (banner, badges, win flourish) only once the dealer's hole
  // card has flipped and every drawn card has finished dealing — otherwise the
  // outcome would be spoiled before the cards land.
  function scheduleSettleReveal(view: BJSessionView, newCount: number) {
    if (view.phase !== 'settled') return;
    const net = view.hands.reduce((s, h) => s + handNet(h), 0);
    const stake = view.hands.reduce((s, h) => s + h.bet * (h.isDoubled ? 2 : 1), 0);
    const revealMs = reduced ? 0 : (Math.max(0, newCount - 1) * STEP_S + FLY_S + FLIP_S) * 1000 + 140;
    window.setTimeout(() => {
      setResultRevealed(true);
      if (net > 0) celebrate(winTier(net, stake), { shakeEl: feltRef.current, originEl: feltRef.current });
      else if (net < 0) celebrate('none');
      // net === 0 (push): no sound.
    }, revealMs);
  }

  function applySettled(view: BJSessionView) {
    // Count cards about to be revealed (new draws, or the whole deal on an
    // immediate blackjack) before applyView marks them seen.
    const newCount = keysForView(view).filter((k) => !seenKeysRef.current.has(k)).length;
    setResultRevealed(false); // keep the outcome hidden while the cards deal/flip
    store.applyView(view);
    if (view.newBalance !== undefined) useBalanceStore.getState().setBalance(view.newBalance);
    scheduleSettleReveal(view, newCount);
  }

  async function handleDeal() {
    if (isLoading) return;
    sound.unlock();
    sound.chip();
    setError(null);
    seenKeysRef.current.clear(); // fresh hand → animate the full deal
    setResultRevealed(false);
    localStorage.setItem('lastBet_blackjack', String(betAmount));
    setIsLoading(true);
    try {
      const bets = Array.from({ length: handCount }, () => betAmount);
      const res = await apiClient.post<BJSessionView>('/games/blackjack/deal', { bets });
      if (res.data.phase === 'settled') applySettled(res.data);
      else store.applyView(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string }; status?: number } };
      if (axiosErr.response?.status === 402) setError('Insufficient funds for that total bet.');
      else setError(axiosErr.response?.data?.error ?? 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function act(action: 'hit' | 'stand' | 'double' | 'split') {
    if (isLoading || sessionId === null || !isPlayerTurn) return;
    if (action === 'double' || action === 'split') sound.chip();
    else sound.uiClick();
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<BJSessionView>('/games/blackjack/action', { sessionId, action });
      if (res.data.phase === 'settled') applySettled(res.data);
      else store.applyView(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string }; status?: number } };
      if (axiosErr.response?.status === 402) setError('Insufficient funds for that action.');
      else setError(axiosErr.response?.data?.error ?? 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function handlePlayAgain() {
    seenKeysRef.current.clear();
    setResultRevealed(false);
    store.reset();
  }

  // One auto round at `stake`: deal a single hand, play it (and any splits) with
  // basic strategy, then settle. Drives the store so cards deal/flip; throws on a
  // backend error so the engine stops. net = total returned − total staked.
  async function playRound(stake: number): Promise<RoundResult> {
    store.setBetAmount(stake);
    sound.unlock();
    seenKeysRef.current.clear();
    setResultRevealed(false);
    localStorage.setItem('lastBet_blackjack', String(stake));
    let view = (await apiClient.post<BJSessionView>('/games/blackjack/deal', { bets: [stake] })).data;
    if (view.phase === 'settled') applySettled(view);
    else {
      store.applyView(view);
      if (view.newBalance !== undefined) useBalanceStore.getState().setBalance(view.newBalance);
    }
    await bjSleep(BJ_DEAL_MS);
    let guard = 0;
    while (view.phase === 'player_turn' && guard++ < 60) {
      const hand = view.hands[view.activeHandIndex];
      const action =
        hand && hand.status === 'playing'
          ? decideBlackjack(hand.cards, view.dealer.upCard, view.canDouble, view.canSplit)
          : 'stand';
      view = (await apiClient.post<BJSessionView>('/games/blackjack/action', { sessionId: view.sessionId, action })).data;
      if (view.phase === 'settled') applySettled(view);
      else {
        store.applyView(view);
        if (view.newBalance !== undefined) useBalanceStore.getState().setBalance(view.newBalance);
      }
      await bjSleep(BJ_STEP_MS);
    }
    await bjSleep(BJ_RESULT_MS);
    const net = view.hands.reduce((s, h) => s + handNet(h), 0);
    return { profit: net, win: net >= 0 };
  }

  const auto = useAutoBet(playRound);

  // The outcome is settled on the backend, but only shown once the deal/draw
  // animation has finished playing out.
  const showResult = isSettled && resultRevealed;
  const dealerTotal = showResult && dealer.value !== null ? String(dealer.value) : isBetting ? '—' : '?';

  const activeBet = hands[activeHandIndex]?.bet ?? betAmount;
  const totalStake = betAmount * handCount;
  const netTotal = isSettled ? hands.reduce((s, h) => s + handNet(h), 0) : 0;
  const netClass = netTotal > 0 ? 'win' : netTotal < 0 ? 'loss' : 'flat';

  // Betting-phase placeholder hands.
  const placeholders = Array.from({ length: handCount }, (_, i) => i);

  const quickBet = (n: number) => store.setBetAmount(Math.max(1, Math.floor(n)));

  return (
    <AppShell>
      <div className="crumb">
        <span>HOME</span><span className="crumb-sep">/</span><span>GAMES</span>
        <span className="crumb-sep">/</span><span style={{ color: 'var(--text-secondary)' }}>BLACKJACK</span>
      </div>
      <div className="game-page-head">
        <h1 className="h-title">Blackjack</h1>
        <div className="game-meta-spec">
          <span>SINGLE DECK</span><span className="dot">·</span><span>BJ PAYS 3:2</span><span className="dot">·</span><span>DEALER STANDS 17</span>
          <button className="icon-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'} style={{ fontSize: 14 }}>{muted ? '🔇' : '🔊'}</button>
        </div>
      </div>

      {error && <div className="notice loss" role="alert" style={{ marginBottom: 16, textAlign: 'left' }}>{error}</div>}

      <div className="game-layout">
        <div className="game-stage" style={{ padding: 14 }}>
          <div className="felt" ref={feltRef}>
            <div className="felt-label">STAKELESS · BLACKJACK</div>

            {/* Dealer */}
            <div className="hand-row">
              <div className="hand-label">
                <span>DEALER</span>
                <span className="total">{dealerTotal}</span>
              </div>
              <div className="cards-row">
                {isBetting ? (
                  <>
                    <CardFace card="facedown" />
                    <CardFace card="facedown" />
                  </>
                ) : (
                  Array.from({ length: dealerCount }).map((_, i) => {
                    const key = dealerKey(i);
                    const m = dealMeta.get(key);
                    const card = isSettled && dealer.hand ? dealer.hand[i] ?? null : i === 0 ? dealer.upCard : null;
                    const faceUp = isSettled ? true : i === 0;
                    return <DealtCard key={key} card={card} faceUp={faceUp} isNew={m?.isNew} delay={m?.delay} />;
                  })
                )}
              </div>
            </div>

            {/* Settlement banner */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 32 }}>
              {showResult && (
                <div
                  style={{
                    padding: '8px 22px', borderRadius: 8,
                    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, letterSpacing: '0.12em',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  }}
                >
                  RESULT&nbsp;&nbsp;
                  <span className={`bj-net ${netClass}`}>
                    {netTotal > 0 ? '+' : netTotal < 0 ? '−' : ''}{Math.abs(netTotal).toLocaleString()} coins
                  </span>
                </div>
              )}
            </div>

            {/* Player hands */}
            <div className="player-hands">
              {isBetting
                ? placeholders.map((i) => (
                    <div className="bj-hand" key={`ph-${i}`}>
                      <div className="cards-row">
                        <CardFace card="facedown" />
                        <CardFace card="facedown" />
                      </div>
                      <div className="bj-hand-foot">
                        <span className="bj-val">—</span>
                        <span>{betAmount} coins</span>
                      </div>
                    </div>
                  ))
                : hands.map((h, i) => (
                    <PlayerHand
                      key={`hand-${i}`}
                      hand={h}
                      index={i}
                      active={isPlayerTurn && i === activeHandIndex}
                      settled={showResult}
                      meta={dealMeta}
                    />
                  ))}
            </div>
          </div>
        </div>

        {/* Bet / action panel */}
        <div className="bet-panel">
          <div className="tabs-2">
            <button className={mode === 'manual' ? 'active' : ''} type="button" disabled={auto.running} onClick={() => setMode('manual')}>Manual</button>
            <button className={mode === 'auto' ? 'active' : ''} type="button" disabled={auto.running} onClick={() => setMode('auto')}>Auto</button>
          </div>
          <div className="body">
            {mode === 'auto' && (
              <>
                <div>
                  <label className="label">Base bet</label>
                  <div className="amount-row">
                    <input
                      className="input"
                      data-mono
                      type="number"
                      min={1}
                      value={betAmount}
                      disabled={auto.running}
                      onChange={(e) => store.setBetAmount(Math.max(1, Math.floor(+e.target.value || 0)))}
                    />
                    <span className="coin-suffix"><span className="dot" /> COINS</span>
                  </div>
                </div>
                <div className="quick-bets">
                  <button type="button" disabled={auto.running} onClick={() => quickBet(betAmount / 2)}>½</button>
                  <button type="button" disabled={auto.running} onClick={() => quickBet(betAmount * 2)}>2×</button>
                  <button type="button" disabled={auto.running} onClick={() => quickBet(1)}>MIN</button>
                  <button type="button" disabled={auto.running} onClick={() => quickBet(balance ?? betAmount)}>MAX</button>
                </div>
                <div className="ab-hint">Auto plays one hand per round with basic strategy.</div>
                <AutoBetControls
                  baseBet={betAmount}
                  balance={balance}
                  running={auto.running}
                  stats={auto.stats}
                  onStart={(cfg) => auto.start({ ...cfg, baseBet: betAmount })}
                  onStop={auto.stop}
                  storageKey="autobet_blackjack"
                />
              </>
            )}

            {mode === 'manual' && isBetting && (
              <>
                <div>
                  <label className="label">Bet per hand</label>
                  <div className="amount-row">
                    <input
                      className="input"
                      data-mono
                      type="number"
                      min={1}
                      value={betAmount}
                      onChange={(e) => store.setBetAmount(Math.max(1, Math.floor(+e.target.value || 0)))}
                    />
                    <span className="coin-suffix"><span className="dot" /> COINS</span>
                  </div>
                </div>

                <div className="quick-bets">
                  <button type="button" onClick={() => quickBet(betAmount / 2)}>½</button>
                  <button type="button" onClick={() => quickBet(betAmount * 2)}>2×</button>
                  <button type="button" onClick={() => quickBet(1)}>MIN</button>
                  <button type="button" onClick={() => quickBet(balance ?? betAmount)}>MAX</button>
                </div>

                <div className="quick-bets">
                  {CHIP_VALUES.map((v) => (
                    <button key={v} type="button" className={betAmount === v ? 'active' : ''} onClick={() => store.setBetAmount(v)} style={betAmount === v ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}>
                      {v}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="label">Hands</label>
                  <div className="hand-stepper">
                    <button type="button" onClick={store.decHands} disabled={handCount <= 1} aria-label="Fewer hands">−</button>
                    <span className="count">{handCount}</span>
                    <button type="button" onClick={store.incHands} disabled={handCount >= 3} aria-label="More hands">+</button>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      TOTAL {totalStake.toLocaleString()} coins
                    </span>
                  </div>
                </div>

                <button className="btn btn-primary place-bet" disabled={isLoading} onClick={() => void handleDeal()} type="button">
                  {isLoading ? 'Dealing…' : `Deal · ${totalStake.toLocaleString()} coins`}
                </button>
              </>
            )}

            {mode === 'manual' && isPlayerTurn && (
              <>
                <div className="bet-summary">
                  <div className="row">
                    <span>Hand</span>
                    <span className="mono">{activeHandIndex + 1} of {hands.length}</span>
                  </div>
                  <div className="row">
                    <span>Hand value</span>
                    <span className="mono">{hands[activeHandIndex]?.value ?? '—'}</span>
                  </div>
                  <div className="row">
                    <span>Bet</span>
                    <span className="mono">{activeBet} coins</span>
                  </div>
                </div>

                <div className="card-inset" style={{ padding: 12 }}>
                  <div className="section-title" style={{ marginBottom: 10 }}>Actions</div>
                  <div className="action-row">
                    <button className="btn btn-ghost" disabled={isLoading} onClick={() => void act('hit')}>Hit</button>
                    <button className="btn btn-ghost" disabled={isLoading} onClick={() => void act('stand')}>Stand</button>
                    <button className="btn btn-ghost" disabled={isLoading || !canDouble} onClick={() => void act('double')}>
                      Double · {activeBet}
                    </button>
                    <button className="btn btn-ghost" disabled={isLoading || !canSplit} onClick={() => void act('split')}>Split</button>
                  </div>
                </div>
              </>
            )}

            {isSettled && !resultRevealed && (
              <div className="card-inset" style={{ padding: 16, textAlign: 'center' }}>
                <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 12, letterSpacing: '0.16em' }}>
                  DEALER PLAYING…
                </span>
              </div>
            )}

            {mode === 'manual' && showResult && (
              <>
                <div className="bet-summary">
                  {hands.map((h, i) => {
                    const net = handNet(h);
                    const cls = net > 0 ? 'win' : net < 0 ? 'loss' : 'flat';
                    return (
                      <div className="row" key={i}>
                        <span>Hand {i + 1}{h.isDoubled ? ' (2×)' : ''}</span>
                        <span className={`mono bj-net ${cls}`}>{net > 0 ? '+' : net < 0 ? '−' : ''}{Math.abs(net).toLocaleString()} coins</span>
                      </div>
                    );
                  })}
                  <div className="row" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                    <span>Net</span>
                    <span className={`mono bj-net ${netClass}`}>{netTotal > 0 ? '+' : netTotal < 0 ? '−' : ''}{Math.abs(netTotal).toLocaleString()} coins</span>
                  </div>
                </div>
                <button className="btn btn-primary place-bet" onClick={handlePlayAgain} type="button">
                  Play again
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default BlackjackPage;
