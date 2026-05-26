import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AppShell } from '../components/vault/AppShell';
import { Avatar } from '../components/vault/Avatar';
import { PlayingCard } from '../components/vault/PlayingCard';
import { apiClient } from '../api/client';
import { socket } from '../socket';
import { sound } from '../lib/sound';
import { useAuth } from '../contexts/AuthContext';
import { usePokerStore } from '../stores/pokerStore';
import { useFriendsStore } from '../stores/friendsStore';
import { XIcon } from '../components/vault/icons';
import { legalActions, evaluateHand, HAND_CATEGORY, POKER, POKER_CHAT_MAX_LEN, type PublicTableState, type PrivateHand, type PokerHandResult, type PublicSeat, type PokerChatMessage, type Card } from '@gambling/shared';

// Friendly rank labels for the "your hand" readout.
const RANK_NAME: Record<number, string> = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight',
  9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};
const plural = (r: number): string => RANK_NAME[r]! + (r === 6 ? 'es' : 's'); // Sixes, else +s

// Describe the player's current best hand from hole + board, so they don't have to
// read the board themselves. Preflop (2 cards) falls back to high-card/pocket-pair.
function describeHand(hole: Card[], board: Card[]): string {
  const all = [...hole, ...board];
  if (all.length < 5) {
    if (hole.length === 2 && hole[0]!.rank === hole[1]!.rank) return `Pocket ${plural(hole[0]!.rank)}`;
    const ranks = hole.map((c) => c.rank).sort((a, b) => b - a);
    return ranks.length === 2 ? `${RANK_NAME[ranks[0]!]}-${RANK_NAME[ranks[1]!]} high` : `${RANK_NAME[ranks[0]!]} high`;
  }
  const { category } = evaluateHand(all);
  const counts = new Map<number, number>();
  for (const c of all) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  const entries = [...counts.entries()];
  const pairs = entries.filter(([, n]) => n === 2).map(([r]) => r).sort((a, b) => b - a);
  const trips = entries.filter(([, n]) => n === 3).map(([r]) => r).sort((a, b) => b - a);
  const quad = entries.find(([, n]) => n === 4)?.[0];
  const maxRank = Math.max(...all.map((c) => c.rank));
  switch (category) {
    case HAND_CATEGORY.PAIR: return `Pair of ${plural(pairs[0] ?? maxRank)}`;
    case HAND_CATEGORY.TWO_PAIR: return `Two pair, ${plural(pairs[0]!)} & ${plural(pairs[1]!)}`;
    case HAND_CATEGORY.TRIPS: return `Trip ${plural(trips[0]!)}`;
    case HAND_CATEGORY.STRAIGHT: return 'Straight';
    case HAND_CATEGORY.FLUSH: return 'Flush';
    case HAND_CATEGORY.FULL_HOUSE: {
      const three = trips[0]!;
      const over = pairs[0] ?? trips.filter((r) => r !== three)[0]!;
      return `${plural(three)} full of ${plural(over)}`;
    }
    case HAND_CATEGORY.QUADS: return `Quad ${plural(quad ?? maxRank)}`;
    case HAND_CATEGORY.STRAIGHT_FLUSH: return 'Straight flush';
    default: return `${RANK_NAME[maxRank]} high`;
  }
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

// Fixed seat anchors around the felt (percent of the felt box). Seat 0 sits at the
// bottom (the usual hero position); the rest fan out clockwise.
const SEAT_POS: React.CSSProperties[] = [
  { left: '50%', top: '92%' },
  { left: '88%', top: '70%' },
  { left: '88%', top: '28%' },
  { left: '50%', top: '12%' },
  { left: '12%', top: '28%' },
  { left: '12%', top: '70%' },
];

// Where each seat's "bet this street" chip pill nudges toward the pot.
const BET_POS: React.CSSProperties[] = [
  { left: '50%', top: '-26px', transform: 'translateX(-50%)' },
  { left: '-14px', top: '50%', transform: 'translateY(-50%) translateX(-100%)' },
  { left: '-14px', top: '50%', transform: 'translateY(-50%) translateX(-100%)' },
  { left: '50%', bottom: '-26px', transform: 'translateX(-50%)' },
  { right: '-14px', top: '50%', transform: 'translateY(-50%) translateX(100%)' },
  { right: '-14px', top: '50%', transform: 'translateY(-50%) translateX(100%)' },
];

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function PokerTablePage() {
  const { id } = useParams<{ id: string }>();
  const tableId = Number(id);
  const navigate = useNavigate();
  const { username } = useAuth();

  const table = usePokerStore((s) => s.table);
  const myHole = usePokerStore((s) => s.myHole);
  const lastResult = usePokerStore((s) => s.lastResult);

  const [buyInSeat, setBuyInSeat] = useState<number | null>(null);
  const [inviting, setInviting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [now, setNow] = useState(Date.now());
  const prevStreetCards = useRef(0);

  // Subscribe to the live table on mount.
  useEffect(() => {
    if (!Number.isInteger(tableId)) {
      navigate('/games/poker');
      return;
    }
    apiClient
      .get<{ table: PublicTableState; hand: PrivateHand | null }>(`/poker/tables/${tableId}`)
      .then((r) => {
        usePokerStore.getState().setTable(r.data.table);
        usePokerStore.getState().setHand(r.data.hand);
      })
      .catch(() => navigate('/games/poker'));

    function onState(d: { tableId: number; state: PublicTableState }) {
      if (d.tableId !== tableId) return;
      usePokerStore.getState().setTable(d.state);
      if (d.state.board.length > prevStreetCards.current) {
        sound.cardDeal();
        prevStreetCards.current = d.state.board.length;
      }
      if (d.state.street === 'preflop') prevStreetCards.current = 0;
    }
    function onHand(d: { tableId: number; hand: PrivateHand }) {
      if (d.tableId === tableId) usePokerStore.getState().setHand(d.hand);
    }
    function onResult(d: { tableId: number; result: PokerHandResult }) {
      if (d.tableId !== tableId) return;
      usePokerStore.getState().setResult(d.result);
      usePokerStore.getState().addHandResult(d.result); // accumulate into the history log
      const mine = d.result.seats.find((s) => s.username === username);
      if (mine && mine.won > 0) sound.winMed();
      window.setTimeout(() => usePokerStore.getState().setResult(null), 5000); // matches the inter-hand pause
    }
    function onHandHistory(d: { tableId: number; hands: PokerHandResult[] }) {
      if (d.tableId === tableId) usePokerStore.getState().setHandHistory(d.hands);
    }

    function onChat(d: { tableId: number; message: PokerChatMessage }) {
      if (d.tableId === tableId) usePokerStore.getState().addChatMessage(d.message);
    }
    function onChatHistory(d: { tableId: number; messages: PokerChatMessage[] }) {
      if (d.tableId === tableId) usePokerStore.getState().setChatHistory(d.messages);
    }

    if (!socket.connected) socket.connect();
    socket.on('poker:state', onState);
    socket.on('poker:hand', onHand);
    socket.on('poker:result', onResult);
    socket.on('poker:chat', onChat);
    socket.on('poker:chathistory', onChatHistory);
    socket.on('poker:handhistory', onHandHistory);
    socket.emit('poker:subscribe', tableId);
    return () => {
      socket.emit('poker:unsubscribe', tableId);
      socket.off('poker:state', onState);
      socket.off('poker:hand', onHand);
      socket.off('poker:result', onResult);
      socket.off('poker:chat', onChat);
      socket.off('poker:chathistory', onChatHistory);
      socket.off('poker:handhistory', onHandHistory);
      usePokerStore.getState().reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  // Tick for the turn timer ring.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  if (!table) {
    return (
      <AppShell>
        <div className="crumb"><Link to="/games/poker">HOME / POKER</Link></div>
        <div className="fg-search-hint">Loading table…</div>
      </AppShell>
    );
  }

  const mySeatObj = table.seats.find((s) => s.username === username && s.userId !== null) ?? null;
  const iAmSeated = mySeatObj !== null;
  const isMyTurn = iAmSeated && table.actingSeat === mySeatObj!.seatIndex;
  // I can show my cards in the post-hand window if I reached the end without folding
  // and wasn't already revealed (i.e. I won uncontested — no showdown reveal).
  const myResultSeat = lastResult?.seats.find((s) => s.username === username) ?? null;
  const canReveal = !!lastResult && !lastResult.showdown && !!myResultSeat && !myResultSeat.folded && myResultSeat.holeCards == null;

  async function act(type: 'fold' | 'check' | 'call' | 'raise', amount?: number) {
    sound.chip();
    try {
      await apiClient.post(`/poker/tables/${tableId}/action`, { type, ...(amount != null ? { amount } : {}) });
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      toast.error(ax.response?.data?.error ?? 'Action failed');
    }
  }

  async function leave() {
    try {
      await apiClient.post(`/poker/tables/${tableId}/leave`);
      navigate('/games/poker');
    } catch {
      toast.error('Could not leave');
    }
  }

  async function reveal() {
    try {
      await apiClient.post(`/poker/tables/${tableId}/reveal`);
      sound.chip();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      toast.error(ax.response?.data?.error ?? 'Could not reveal');
    }
  }

  async function addBot(seatIndex: number) {
    sound.chip();
    try {
      await apiClient.post(`/poker/tables/${tableId}/bots`, { seatIndex });
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      toast.error(ax.response?.data?.error ?? 'Could not add bot');
    }
  }

  async function removeBot(seatIndex: number) {
    try {
      await apiClient.delete(`/poker/tables/${tableId}/bots/${seatIndex}`);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      toast.error(ax.response?.data?.error ?? 'Could not remove bot');
    }
  }

  const secsLeft = table.actionDeadline ? Math.max(0, Math.ceil((table.actionDeadline - now) / 1000)) : null;
  const actFrac = table.actionDeadline ? clamp01((table.actionDeadline - now) / POKER.TURN_MS) : 0;
  const occupied = table.seats.filter((s) => s.userId !== null).length;

  return (
    <AppShell>
      <div className="pkr-head">
        <div className="pkr-head-left">
          <div className="crumb"><Link to="/games/poker">HOME / POKER</Link></div>
          <h1 className="h-title">{table.name}</h1>
          <div className="pkr-head-meta">
            <span className="stake">{table.smallBlind}/{table.bigBlind}</span>
            <span className="hand">Hand #{table.handNumber}</span>
            <span className="sep">·</span>
            <span className="street">{table.street}</span>
          </div>
        </div>
        <div className="pkr-head-right">
          <button className="btn btn-ghost" onClick={() => setShowHistory(true)}>History</button>
          {iAmSeated && <button className="btn btn-ghost" onClick={() => setInviting(true)}>Invite</button>}
          {iAmSeated && <button className="btn btn-outline" onClick={leave}>Leave table</button>}
        </div>
      </div>

      <div className="pkr-table-wrap">
        <div>
          <div className="pkr-felt-frame">
            <div className="pkr-felt">
              <div className="pkr-felt-mark">STAKELESS · NO REAL STAKES · TEXAS HOLD'EM</div>

              <div className="pkr-center">
                {lastResult ? <ResultBanner result={lastResult} /> : <Pot amount={table.totalPot} />}
                <Board board={table.board} />
              </div>

              {SEAT_POS.map((pos, i) => {
                const seat = table.seats[i];
                return (
                  <Seat
                    key={i}
                    pos={pos}
                    betPos={BET_POS[i]!}
                    seat={seat}
                    table={table}
                    now={now}
                    mine={!!seat && seat.userId !== null && seat.username === username}
                    iAmSeated={iAmSeated}
                    onSit={() => setBuyInSeat(i)}
                    onAddBot={() => addBot(i)}
                    onRemoveBot={() => removeBot(i)}
                  />
                );
              })}
            </div>
          </div>

          {/* My hole cards + a plain-English readout of my current best hand */}
          {iAmSeated && myHole && myHole.length > 0 && (
            <div className="pkr-hero">
              <div className="pkr-hero-left">
                <div className="pkr-fan">
                  {myHole.map((c, i) => <PlayingCard key={i} card={c} size="lg" />)}
                </div>
                <div className="pkr-hero-meta">
                  <div className="pkr-hero-name">{username}</div>
                  <div className="pkr-hero-stack"><span className="lbl">Stack</span>{(mySeatObj?.stack ?? 0).toLocaleString()}</div>
                </div>
              </div>
              <div className="pkr-hero-read">
                <span className="pkr-hero-read-lbl">You're holding</span>
                <span className="pkr-hero-read-val">
                  {mySeatObj?.status === 'folded'
                    ? 'Folded'
                    : table.street === 'idle'
                      ? 'Waiting for next hand'
                      : describeHand(myHole, table.board)}
                </span>
              </div>
            </div>
          )}

          {/* Action bar (my turn) / idle status strip */}
          {isMyTurn && mySeatObj ? (
            <ActionBar table={table} seat={mySeatObj} onAct={act} secsLeft={secsLeft} frac={actFrac} />
          ) : (
            <div className="pkr-actionbar idle">
              <div className="who">
                <span className="ring" />
                {!iAmSeated
                  ? 'Tap an empty seat to sit down.'
                  : table.street === 'idle' || table.street === 'showdown'
                    ? 'Waiting for the next hand…'
                    : 'Waiting for your turn…'}
              </div>
              {canReveal && <button className="btn btn-outline" onClick={reveal}>Show cards</button>}
            </div>
          )}
        </div>

        <div className="pkr-rail">
          <div className="pkr-railcard">
            <h5>Table info</h5>
            <div className="pkr-railcard-rows">
              <div className="row"><span>Players</span><span className="v">{occupied}/{table.maxSeats}</span></div>
              <div className="row"><span>Hand</span><span className="v">#{table.handNumber}</span></div>
              <div className="row"><span>Blinds</span><span className="v gold">{table.smallBlind}/{table.bigBlind}</span></div>
              <div className="row"><span>Pot</span><span className="v gold">{table.totalPot.toLocaleString()}</span></div>
            </div>
          </div>
          <ChatPanel tableId={tableId} username={username} />
        </div>
      </div>

      {buyInSeat !== null && (
        <BuyInModal table={table} seatIndex={buyInSeat} setSeatIndex={setBuyInSeat} onClose={() => setBuyInSeat(null)} tableId={tableId} />
      )}
      {inviting && <InviteModal table={table} tableId={tableId} onClose={() => setInviting(false)} />}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
    </AppShell>
  );
}

// Stylized gold chip-stack used in the pot.
function ChipStack() {
  const fill = '#D4A857', dark = '#7a5a25', light = '#F5CB6C';
  return (
    <svg width={36} height={36} viewBox="0 0 40 40" style={{ display: 'block' }} aria-hidden="true">
      <ellipse cx="20" cy="34" rx="14" ry="2.5" fill="rgba(0,0,0,0.5)" />
      {[24, 18, 12].map((y, i) => (
        <g key={i}>
          <ellipse cx="20" cy={y + 4} rx="13" ry="3.4" fill={dark} />
          <ellipse cx="20" cy={y} rx="13" ry="3.4" fill={fill} />
          <ellipse cx="20" cy={y} rx="13" ry="3.4" fill="none" stroke={dark} strokeWidth="0.6" />
          {[0, 60, 120, 180, 240, 300].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <rect key={deg} x={20 + Math.cos(rad) * 11 - 0.5} y={y - 1.6} width="1" height="3.2" fill={light}
                transform={`rotate(${deg + 90} 20 ${y})`} opacity="0.85" />
            );
          })}
        </g>
      ))}
      <ellipse cx="20" cy="8" rx="13" ry="3.6" fill={fill} />
      <ellipse cx="20" cy="8" rx="13" ry="3.6" fill="none" stroke={dark} strokeWidth="0.6" />
      <ellipse cx="20" cy="8" rx="9" ry="2.4" fill="none" stroke={light} strokeWidth="0.5" strokeDasharray="1.4 1" />
    </svg>
  );
}

function Pot({ amount }: { amount: number }) {
  return (
    <div className="pkr-pot">
      <div className="pkr-pot-stack"><ChipStack /></div>
      <div className="pkr-pot-amt">
        <span className="label">Pot</span>
        <span className="val">{amount.toLocaleString()}</span>
      </div>
    </div>
  );
}

function Board({ board }: { board: Card[] }) {
  return (
    <div className="pkr-board">
      {[0, 1, 2, 3, 4].map((i) =>
        board[i] ? <PlayingCard key={i} card={board[i]} /> : <div key={i} className="pkr-card-slot" />,
      )}
    </div>
  );
}

function ResultBanner({ result }: { result: PokerHandResult }) {
  const winners = result.seats.filter((s) => s.won > 0);
  if (winners.length === 0) return <div className="pkr-result"><span className="who">Hand complete</span></div>;
  const primary = winners[0]!;
  const multi = winners.length > 1;
  return (
    <div className="pkr-result">
      <span className="who">{multi ? 'Split pot' : `${primary.username} wins`}</span>
      <span className="amt">{(multi ? result.potTotal : primary.won).toLocaleString()}</span>
      {result.showdown && !multi && primary.handName && <span className="hand">{primary.handName}</span>}
    </div>
  );
}

// A countdown ring around the acting player's avatar; `frac` is the fraction of the
// turn timer remaining (1 → full ring, 0 → empty), driven by the live state clock.
function TimerRing({ frac }: { frac: number }) {
  return (
    <svg className="pkr-seat-timer" viewBox="0 0 50 50" aria-hidden="true">
      <circle className="track" cx="25" cy="25" r="22" />
      <circle className="run" cx="25" cy="25" r="22" style={{ strokeDashoffset: 138 * (1 - frac) }} />
    </svg>
  );
}

function Seat({
  pos, betPos, seat, table, now, mine, iAmSeated, onSit, onAddBot, onRemoveBot,
}: {
  pos: React.CSSProperties;
  betPos: React.CSSProperties;
  seat: PublicSeat | undefined;
  table: PublicTableState;
  now: number;
  mine: boolean;
  iAmSeated: boolean;
  onSit: () => void;
  onAddBot: () => void;
  onRemoveBot: () => void;
}) {
  if (!seat || seat.userId === null) {
    // Empty seat: sit yourself, and (once you're seated) add a bot here.
    return (
      <div className="pkr-seat empty" style={pos}>
        <div className="pkr-seat-plate">
          <button className="pkr-seat-sit" onClick={onSit}>
            <span className="pkr-seat-sit-plus">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </span>
            <span>Sit here</span>
          </button>
          {iAmSeated && <button className="pkr-seat-botadd" onClick={onAddBot}>+ Bot</button>}
        </div>
      </div>
    );
  }

  const isActing = table.actingSeat === seat.seatIndex;
  const isButton = table.buttonIndex === seat.seatIndex;
  const folded = seat.status === 'folded';
  const allin = seat.status === 'allin';
  // Backs peek out during a live hand for everyone except me (I see my own cards
  // in the hero strip) and folded/empty seats; revealed cards show at showdown.
  const showBacks = !mine && !folded && seat.status !== 'empty' && seat.status !== 'sittingOut'
    && table.street !== 'idle' && table.street !== 'showdown';
  const frac = isActing && table.actionDeadline ? clamp01((table.actionDeadline - now) / POKER.TURN_MS) : null;
  const cls = ['pkr-seat', isActing && 'acting', folded && 'folded', mine && 'mine', allin && 'allin']
    .filter(Boolean).join(' ');

  return (
    <div className={cls} style={pos}>
      {seat.isBot && iAmSeated && (
        <button className="pkr-seat-remove" title="Remove bot" onClick={onRemoveBot}>×</button>
      )}
      {(seat.revealedCards || showBacks) && (
        <div className="pkr-seat-cards">
          {seat.revealedCards
            ? seat.revealedCards.map((c, i) => <PlayingCard key={i} card={c} />)
            : <><PlayingCard /><PlayingCard /></>}
        </div>
      )}
      <div className="pkr-seat-plate">
        <Avatar username={seat.username ?? '?'} avatarColor={seat.avatarColor} className="pkr-seat-ava" />
        {frac !== null && <TimerRing frac={frac} />}
        <div className="pkr-seat-meta">
          <div className="pkr-seat-name">
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{seat.username}</span>
            {seat.isBot && <span className="pkr-bot-tag">BOT</span>}
            {allin && <span className="pkr-allin">ALL-IN</span>}
          </div>
          <div className="pkr-seat-stack"><span className="coin" />{seat.stack.toLocaleString()}</div>
        </div>
        {isButton && <span className="pkr-dealer">D</span>}
      </div>
      {seat.committedThisStreet > 0 && (
        <div className="pkr-seat-bet" style={betPos}>
          <span className="stack" />
          {seat.committedThisStreet.toLocaleString()}
        </div>
      )}
    </div>
  );
}

function ActionBar({
  table, seat, onAct, secsLeft, frac,
}: {
  table: PublicTableState;
  seat: PublicSeat;
  onAct: (type: 'fold' | 'check' | 'call' | 'raise', amount?: number) => void;
  secsLeft: number | null;
  frac: number;
}) {
  const la = legalActions({
    stack: seat.stack,
    currentBet: table.currentBet,
    committedThisStreet: seat.committedThisStreet,
    minRaise: table.minRaise,
    bigBlind: table.bigBlind,
  });
  const [raiseTo, setRaiseTo] = useState(la.minRaiseTo);
  // Keep the slider within the current legal range as state changes.
  useEffect(() => {
    setRaiseTo((v) => Math.max(la.minRaiseTo, Math.min(la.maxRaiseTo, v)));
  }, [la.minRaiseTo, la.maxRaiseTo]);

  const pot = table.totalPot;
  const presets: { label: string; to: number }[] = [
    { label: '½ pot', to: table.currentBet + Math.round(pot * 0.5) },
    { label: '¾ pot', to: table.currentBet + Math.round(pot * 0.75) },
    { label: 'Pot', to: table.currentBet + pot },
    { label: 'All-in', to: la.maxRaiseTo },
  ];
  const clampTo = (to: number) => Math.max(la.minRaiseTo, Math.min(la.maxRaiseTo, to));
  const pct = la.maxRaiseTo > la.minRaiseTo ? ((raiseTo - la.minRaiseTo) / (la.maxRaiseTo - la.minRaiseTo)) * 100 : 100;

  return (
    <div className="pkr-actionbar">
      <div className="pkr-actionbar-left">
        <div className="pkr-actionbar-fold">
          <button className="pkr-actionbtn fold" onClick={() => onAct('fold')}>Fold</button>
          {la.canCheck ? (
            <button className="pkr-actionbtn call" onClick={() => onAct('check')}>Check</button>
          ) : (
            <button className="pkr-actionbtn call" onClick={() => onAct('call')} disabled={!la.canCall}>
              Call <span className="amt">{la.callAmount.toLocaleString()}</span>
            </button>
          )}
        </div>
        {secsLeft !== null && (
          <div className="pkr-actionbar-timer">
            <span className="num">{secsLeft}s</span>
            <span>to act</span>
            <span className="bar"><i style={{ width: `${Math.round(frac * 100)}%` }} /></span>
          </div>
        )}
      </div>

      {la.canRaise && (
        <div className="pkr-raise">
          <div className="pkr-raise-head">
            <div className="pkr-raise-presets">
              {presets.map((p) => {
                const to = clampTo(p.to);
                return (
                  <button
                    key={p.label}
                    className={raiseTo === to ? 'active' : ''}
                    onClick={() => setRaiseTo(to)}
                    disabled={clampTo(p.to) < la.minRaiseTo && p.to !== la.maxRaiseTo}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="pkr-raise-amt">
              <span className="lbl">Raise to</span>
              <input value={raiseTo.toLocaleString()} readOnly />
            </div>
          </div>
          <input
            type="range"
            className="pkr-raise-slider"
            min={la.minRaiseTo}
            max={la.maxRaiseTo}
            value={raiseTo}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
            style={{ background: `linear-gradient(90deg, var(--gold) 0%, var(--gold) ${pct}%, var(--bg-elevated) ${pct}%)` }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="pkr-actionbtn raise" onClick={() => onAct('raise', raiseTo)}>
              {raiseTo >= la.maxRaiseTo ? 'All-in' : <>Raise to <span className="amt">{raiseTo.toLocaleString()}</span></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Live table chat over the poker:<id> room. Seated players and railbirds alike can
// post; the server gates private tables, rate-limits, and assigns each line an id.
function ChatPanel({ tableId, username }: { tableId: number; username: string | null }) {
  const chat = usePokerStore((s) => s.chat);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Stick to the newest line as messages arrive.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    socket.emit('poker:chat', { tableId, text: t.slice(0, POKER_CHAT_MAX_LEN) });
    setText('');
  }

  return (
    <div className="pkr-chat">
      <div className="pkr-chat-head">
        <h4><span className="live" />Table chat</h4>
      </div>
      <div className="pkr-chat-list" ref={listRef}>
        {chat.length === 0 ? (
          <div className="pkr-chat-empty">No messages yet — say hi 👋</div>
        ) : (
          chat.map((m) => {
            const mine = m.username === username;
            return (
              <div className={'pkr-msg' + (mine ? ' mine' : '')} key={m.id}>
                {!mine && <Avatar username={m.username} avatarColor={m.avatarColor} className="pkr-msg-ava" />}
                <div className="pkr-msg-body">
                  <div className="pkr-msg-name"><span>{m.username}</span><span className="time">{fmtTime(m.ts)}</span></div>
                  <div className="pkr-msg-text">{m.text}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form className="pkr-chat-input" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={POKER_CHAT_MAX_LEN}
          placeholder="Say something…"
          aria-label="Table chat message"
        />
        <button className="btn btn-primary" type="submit" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}

function InviteModal({ table, tableId, onClose }: { table: PublicTableState; tableId: number; onClose: () => void }) {
  const friends = useFriendsStore((s) => s.friends);
  const [invited, setInvited] = useState<Set<number>>(new Set());
  const [q, setQ] = useState('');
  // Friends already seated here can't be invited again.
  const seatedNames = new Set(table.seats.filter((s) => s.username).map((s) => s.username));
  const filtered = friends.filter((f) => f.username.toLowerCase().includes(q.toLowerCase()));

  async function invite(userId: number, username: string) {
    setInvited((s) => new Set(s).add(userId));
    try {
      await apiClient.post(`/poker/tables/${tableId}/invite`, { username });
      toast.success(`Invited ${username}`);
    } catch (e) {
      setInvited((s) => {
        const n = new Set(s);
        n.delete(userId);
        return n;
      });
      const ax = e as { response?: { data?: { error?: string } } };
      toast.error(ax.response?.data?.error ?? 'Could not invite');
    }
  }

  return (
    <div className="pkr-modal-shade" onClick={onClose}>
      <div className="pkr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pkr-modal-head">
          <div>
            <span className="eyebrow">Friends</span>
            <h3>Invite to {table.name}</h3>
            <p>Only friends can be invited. <Link className="fg-link" to="/friends" onClick={onClose}>Add more friends →</Link></p>
          </div>
          <button className="pkr-modal-close" onClick={onClose} aria-label="Close"><XIcon size={14} /></button>
        </div>
        <div className="pkr-modal-body">
          <div className="pkr-invite-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input placeholder="Search friends" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="pkr-invite-list">
            {filtered.length === 0 ? (
              <div className="pkr-invite-empty">{friends.length === 0 ? 'No friends yet — add some on the Friends page.' : 'No matches.'}</div>
            ) : (
              filtered.map((f) => {
                const at = seatedNames.has(f.username);
                const sent = invited.has(f.userId);
                return (
                  <div className="pkr-invite-row" key={f.userId}>
                    <Avatar username={f.username} avatarColor={f.avatarColor} avatarImage={f.avatarImage} className="fg-ava" />
                    <div className="pkr-invite-meta">
                      <div className="pkr-invite-name">{f.username}</div>
                      <div className="pkr-invite-sub">{at ? 'AT TABLE' : sent ? 'INVITED' : 'FRIEND'}</div>
                    </div>
                    {at ? (
                      <span className="pkr-invite-btn sent">At table</span>
                    ) : (
                      <button className={'pkr-invite-btn' + (sent ? ' sent' : '')} onClick={() => !sent && invite(f.userId, f.username)}>
                        {sent ? 'Invited' : 'Invite'}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Recent finished hands at this table (in-memory, last ~30). Backlog arrives on
// subscribe (poker:handhistory); live hands are appended as poker:result fires.
function HistoryModal({ onClose }: { onClose: () => void }) {
  const history = usePokerStore((s) => s.history);
  return (
    <div className="pkr-modal-shade" onClick={onClose}>
      <div className="pkr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pkr-modal-head">
          <div>
            <span className="eyebrow">Hand history</span>
            <h3>Recent hands</h3>
            <p>Last {history.length} hand{history.length === 1 ? '' : 's'} at this table</p>
          </div>
          <button className="pkr-modal-close" onClick={onClose} aria-label="Close"><XIcon size={14} /></button>
        </div>
        <div className="pkr-modal-body">
          {history.length === 0 ? (
            <div className="pkr-history-empty">No hands yet — play a few and they'll show up here.</div>
          ) : (
            <div className="pkr-history-list">
              {history.map((h) => <HandRow key={h.handNumber} h={h} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HandRow({ h }: { h: PokerHandResult }) {
  const winners = h.seats.filter((s) => s.won > 0);
  const shown = h.seats.filter((s) => s.holeCards && s.holeCards.length > 0);
  const primary = winners[0];
  return (
    <div className="pkr-history-row">
      <div className="h-num">HAND<strong>#{h.handNumber}</strong></div>
      <div className="h-board">
        {h.board.length > 0
          ? h.board.map((c, i) => <PlayingCard key={i} card={c} size="sm" />)
          : <span className="fg-dim" style={{ fontSize: 11 }}>folded preflop</span>}
      </div>
      <div className="h-info">
        <div className="h-winner">
          {primary ? (
            <>
              <span>{primary.username}</span>
              <span className="amt">+{primary.won.toLocaleString()}</span>
              {winners.length > 1 && <span className="fg-dim">+{winners.length - 1} more</span>}
            </>
          ) : (
            <span className="fg-dim">—</span>
          )}
        </div>
        <div className="h-hand">{primary?.handName ?? (h.showdown ? 'Showdown' : 'Uncalled')}</div>
      </div>
      <div className="h-pot"><span className="lbl">Pot</span>{h.potTotal.toLocaleString()}</div>
      {h.showdown && shown.length > 0 && (
        <div className="h-shown">
          {shown.map((s) => (
            <span className="h-show" key={s.seatIndex}>
              <span className="h-show-name">{s.username}</span>
              {s.holeCards!.map((c, i) => <PlayingCard key={i} card={c} size="sm" />)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BuyInModal({ table, seatIndex, setSeatIndex, tableId, onClose }: { table: PublicTableState; seatIndex: number; setSeatIndex: (i: number) => void; tableId: number; onClose: () => void }) {
  // Buy-in bounds come from the stakes (40–100× BB), matching the server.
  const min = table.bigBlind * POKER.MIN_BUYIN_BB;
  const max = table.bigBlind * POKER.MAX_BUYIN_BB;
  const [amount, setAmount] = useState(max);
  const [saving, setSaving] = useState(false);
  const bb = table.bigBlind;
  const span = max - min;
  const step = (n: number) => Math.round(n / bb) * bb;
  const presets: { v: number; label: string }[] = [
    { v: min, label: 'Min' },
    { v: step(min + span / 3), label: '' },
    { v: step(min + (2 * span) / 3), label: '' },
    { v: max, label: 'Max' },
  ];
  const takenIdx = new Set(table.seats.filter((s) => s.userId !== null).map((s) => s.seatIndex));
  const pct = ((amount - min) / (max - min)) * 100;

  async function sit() {
    setSaving(true);
    try {
      await apiClient.post(`/poker/tables/${tableId}/sit`, { seatIndex, buyIn: amount });
      sound.bet();
      onClose();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      toast.error(ax.response?.data?.error ?? 'Could not sit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pkr-modal-shade" onClick={onClose}>
      <div className="pkr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pkr-modal-head">
          <div>
            <span className="eyebrow">Sit down</span>
            <h3>Buy in to {table.name}</h3>
            <p>No-Limit Hold'em · {table.smallBlind}/{table.bigBlind} · {table.maxSeats} seats</p>
          </div>
          <button className="pkr-modal-close" onClick={onClose} aria-label="Close"><XIcon size={14} /></button>
        </div>
        <div className="pkr-modal-body">
          <div>
            <label className="label">Choose a seat</label>
            <div className="pkr-buyin-seats">
              {Array.from({ length: table.maxSeats }).map((_, i) => {
                const taken = takenIdx.has(i);
                const active = seatIndex === i && !taken;
                const cls = ['pkr-buyin-seat', taken && 'taken', active && 'active'].filter(Boolean).join(' ');
                return (
                  <button key={i} className={cls} disabled={taken} onClick={() => !taken && setSeatIndex(i)}>
                    <span className="n">{i + 1}</span>
                    <span>{taken ? 'TAKEN' : active ? 'SELECTED' : 'OPEN'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Buy-in amount</label>
            <div className="pkr-buyin-amount">
              <div className="pkr-buyin-readout">
                <span className="big">{amount.toLocaleString()}</span>
                <span className="range">MIN {min.toLocaleString()} · MAX {max.toLocaleString()}</span>
              </div>
              <input
                type="range"
                className="pkr-raise-slider"
                min={min}
                max={max}
                step={bb}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                style={{ background: `linear-gradient(90deg, var(--gold) 0%, var(--gold) ${pct}%, var(--bg-elevated) ${pct}%)` }}
              />
              <div className="pkr-buyin-presets">
                {presets.map((p, i) => (
                  <button key={i} onClick={() => setAmount(p.v)}>{p.label || p.v.toLocaleString()}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="pkr-modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving} onClick={sit}>Sit &amp; buy {amount.toLocaleString()}</button>
        </div>
      </div>
    </div>
  );
}
