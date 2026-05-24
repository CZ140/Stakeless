// Live-bets marquee.
//
// NOTE: This is a VISUAL-ONLY placeholder. The backend currently has no
// global live-bets feed (it only emits per-user `balance:update` and a global
// `leaderboard:update`). The sample rows below are clearly fabricated demo
// data. When a real `bet:placed` broadcast is added, swap `SAMPLE_EVENTS` for
// the live feed and keep the same markup.
//
// Marquee mechanics: the track is rendered twice and sized to `max-content`,
// then translated by -50% — so the second copy seamlessly takes over from the
// first with no jump and no overflow past the viewport (the prototype's bug).

interface TickerEvent {
  user: string;
  game: string;
  mult?: number;
  amount: number;
}

const SAMPLE_EVENTS: TickerEvent[] = [
  { user: 'crypto_owl', game: 'Plinko', mult: 127.0, amount: 12700 },
  { user: 'shibuya_88', game: 'Mines', mult: 24.0, amount: 2400 },
  { user: 'velour', game: 'Roulette', amount: -500 },
  { user: 'midnight', game: 'Blackjack', mult: 2.5, amount: 1250 },
  { user: 'rune_03', game: 'Mines', amount: -200 },
  { user: 'foxtrot', game: 'Plinko', mult: 8.2, amount: 820 },
  { user: 'echo_charlie', game: 'Roulette', mult: 35.0, amount: 17500 },
  { user: 'goldfish', game: 'Blackjack', amount: -800 },
  { user: 'starling', game: 'Mines', mult: 5.0, amount: 500 },
];

function Row({ e }: { e: TickerEvent }) {
  return (
    <span>
      <span className="t-user">{e.user}</span>
      <span className="sep"> · </span>
      <span className="t-game">{e.game}</span>
      <span className="sep"> · </span>
      {e.mult != null && (
        <>
          <span className="t-mult">{e.mult}×</span>
          <span className="sep"> · </span>
        </>
      )}
      <span className={e.amount >= 0 ? 't-amt-pos' : 't-amt-neg'}>
        {e.amount >= 0 ? '+' : ''}
        {e.amount.toLocaleString('en-US')}
      </span>
      <span className="sep"> ◆ </span>
    </span>
  );
}

export function LiveTicker({ events = SAMPLE_EVENTS }: { events?: TickerEvent[] }) {
  // Duplicate the list so the -50% translate produces a seamless loop.
  const doubled = [...events, ...events];
  return (
    <div className="ticker">
      <span className="ticker-live">LIVE</span>
      <div className="ticker-viewport">
        <div className="ticker-track" aria-hidden>
          {doubled.map((e, i) => (
            <Row key={i} e={e} />
          ))}
        </div>
      </div>
    </div>
  );
}
