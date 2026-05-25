// Per-game banner artwork — detailed geometric SVGs for the dashboard game tiles.
// Ported from the Claude Design handoff (GameArt in screens.jsx) — VCasino.html.
import type { ReactElement } from 'react';

// ─── Roulette — cross-section of the wheel ──────────────────────────
const RouletteArt = () => {
  const cx = 32, cy = 32, rO = 24, rI = 15, N = 8;
  const colors = ['#0e8a4d', '#9a1f2e', '#0a0d12', '#9a1f2e', '#0a0d12', '#9a1f2e', '#0a0d12', '#9a1f2e'];
  const ballAng = -Math.PI / 4;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx={cx} cy={cy} r={rO + 2} fill="#1a1208" />
      {Array.from({ length: N }).map((_, i) => {
        const a1 = (i / N) * Math.PI * 2 - Math.PI / 2;
        const a2 = ((i + 1) / N) * Math.PI * 2 - Math.PI / 2;
        const p1 = [cx + Math.cos(a1) * rI, cy + Math.sin(a1) * rI];
        const p2 = [cx + Math.cos(a1) * rO, cy + Math.sin(a1) * rO];
        const p3 = [cx + Math.cos(a2) * rO, cy + Math.sin(a2) * rO];
        const p4 = [cx + Math.cos(a2) * rI, cy + Math.sin(a2) * rI];
        const d = `M${p1[0]},${p1[1]} L${p2[0]},${p2[1]} A${rO},${rO} 0 0 1 ${p3[0]},${p3[1]} L${p4[0]},${p4[1]} A${rI},${rI} 0 0 0 ${p1[0]},${p1[1]} Z`;
        return <path key={i} d={d} fill={colors[i]} stroke="#d4a857" strokeWidth="0.5" strokeOpacity="0.7" />;
      })}
      <circle cx={cx} cy={cy} r={rO} fill="none" stroke="#d4a857" strokeWidth="0.8" />
      <circle cx={cx} cy={cy} r={rI} fill="#1a1208" stroke="#d4a857" strokeWidth="0.8" />
      <circle cx={cx} cy={cy} r="5" fill="#d4a857" />
      <circle cx={cx} cy={cy} r="5" fill="none" stroke="#7a5a25" strokeWidth="0.5" />
      <circle cx={cx + Math.cos(ballAng) * (rO - 3)} cy={cy + Math.sin(ballAng) * (rO - 3)} r="2" fill="#fff" />
    </svg>
  );
};

// ─── Plinko — pyramid of pegs + multiplier slots ────────────────────
const PlinkoArt = () => {
  const pegs: [number, number][] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c <= r; c++) {
      pegs.push([32 + (c - r / 2) * 7, 10 + r * 7]);
    }
  }
  const slots = ['10×', '3×', '1×', '3×', '10×'];
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      {pegs.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.5" fill="#5B8DEF" />)}
      <path d="M32 4 L29 11 L33 18 L30 25 L34 32 L31 39" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" strokeDasharray="1.2 1.2" fill="none" strokeLinecap="round" />
      <circle cx="31" cy="39" r="2.4" fill="#fff" stroke="#5B8DEF" strokeWidth="0.6" />
      {slots.map((m, i) => {
        const heat = i === 0 || i === 4 ? 1 : i === 1 || i === 3 ? 0.55 : 0.25;
        return (
          <g key={i}>
            <rect x={6 + i * 11} y="48" width="9" height="10" rx="1.5" fill={`rgba(91,141,239,${heat})`} />
            <text x={10.5 + i * 11} y="55" textAnchor="middle" fontFamily="Geist Mono" fontSize="5" fontWeight="700" fill={heat > 0.5 ? '#0a1428' : '#fff'}>{m}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ─── Mines — 5×5 grid w/ gems + a bomb ──────────────────────────────
const MinesArt = () => {
  const gems = new Set(['1-0', '0-2', '3-1', '2-4']);
  const bomb = '2-3';
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      {[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => {
        const x = 6 + c * 10.5, y = 6 + r * 10.5;
        const key = `${r}-${c}`;
        const isBomb = key === bomb;
        const isGem = gems.has(key);
        return (
          <g key={key}>
            <rect x={x} y={y} width="9" height="9" rx="1.5"
              fill={isBomb ? 'rgba(240,68,90,0.25)' : isGem ? 'rgba(0,224,130,0.18)' : 'rgba(255,255,255,0.05)'}
              stroke={isBomb ? '#F0445A' : isGem ? '#00E082' : 'rgba(255,255,255,0.15)'} strokeWidth="0.6" />
            {isGem && <path d={`M ${x + 4.5} ${y + 1.8} L ${x + 7.2} ${y + 4.5} L ${x + 4.5} ${y + 7.2} L ${x + 1.8} ${y + 4.5} Z`} fill="#00E082" opacity="0.95" />}
            {isBomb && (
              <g>
                <circle cx={x + 4.5} cy={y + 5} r="2.2" fill="#1a0a0d" />
                <circle cx={x + 3.7} cy={y + 4.2} r="0.5" fill="rgba(255,255,255,0.35)" />
                <path d={`M ${x + 6} ${y + 3} L ${x + 7.5} ${y + 1.4}`} stroke="#F6B85D" strokeWidth="0.7" strokeLinecap="round" />
                <circle cx={x + 7.7} cy={y + 1.2} r="0.55" fill="#F6B85D" />
              </g>
            )}
          </g>
        );
      }))}
    </svg>
  );
};

// ─── Blackjack — two cards (A♠ + K♥) + chip ─────────────────────────
const BlackjackArt = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <g transform="rotate(-14 26 32)">
      <rect x="12" y="14" width="22" height="32" rx="2.5" fill="#fff" stroke="rgba(0,0,0,0.15)" />
      <text x="15" y="24" fontFamily="Georgia, serif" fontSize="9" fontWeight="700" fill="#C8364B">K</text>
      <text x="15" y="32" fontFamily="serif" fontSize="7" fill="#C8364B">♥</text>
      <text x="23" y="42" fontFamily="serif" fontSize="12" textAnchor="middle" fill="#C8364B">♥</text>
    </g>
    <g transform="rotate(10 38 32)">
      <rect x="28" y="14" width="22" height="32" rx="2.5" fill="#fff" stroke="rgba(0,0,0,0.1)" />
      <text x="31" y="24" fontFamily="Georgia, serif" fontSize="9" fontWeight="700" fill="#0a0f15">A</text>
      <text x="31" y="32" fontFamily="serif" fontSize="7" fill="#0a0f15">♠</text>
      <text x="39" y="42" fontFamily="serif" fontSize="12" textAnchor="middle" fill="#0a0f15">♠</text>
    </g>
    <g transform="translate(50 50)">
      <circle r="6.5" fill="#9a1f2e" stroke="#fff" strokeWidth="1" strokeDasharray="2.2 1.6" />
      <circle r="3.2" fill="#1a0a0d" />
      <circle r="3.2" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
    </g>
  </svg>
);

// ─── Dice — two dice (4 + 3) ────────────────────────────────────────
const DiceArt = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <g transform="rotate(-10 20 36)">
      <rect x="6" y="22" width="24" height="24" rx="3.5" fill="#f5d68a" stroke="#7a5a25" strokeWidth="0.7" />
      <rect x="6" y="22" width="24" height="4" fill="rgba(255,255,255,0.35)" />
      {([[12, 28], [24, 28], [12, 40], [24, 40]] as const).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" fill="#1a0f04" />)}
    </g>
    <g transform="rotate(14 46 28)">
      <rect x="34" y="14" width="24" height="24" rx="3.5" fill="#d4a857" stroke="#5a3f18" strokeWidth="0.7" />
      <rect x="34" y="14" width="24" height="4" fill="rgba(255,255,255,0.3)" />
      {([[40, 20], [46, 26], [52, 32]] as const).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" fill="#1a0f04" />)}
    </g>
  </svg>
);

// ─── Slots — machine showing 7-7-7 ──────────────────────────────────
const SlotsArt = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <rect x="6" y="12" width="52" height="40" rx="4" fill="#1f0a18" stroke="#E879B6" strokeWidth="1" />
    <rect x="6" y="12" width="52" height="5" rx="4" fill="#E879B6" opacity="0.25" />
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect x={10 + i * 16} y={20} width="12" height="24" rx="1.5" fill="rgba(255,255,255,0.06)" stroke="rgba(232,121,182,0.4)" strokeWidth="0.5" />
        <text x={16 + i * 16} y={37} textAnchor="middle" fontFamily="Geist Mono" fontSize="13" fontWeight="800" fill="#E879B6">7</text>
      </g>
    ))}
    <line x1="6" y1="32" x2="58" y2="32" stroke="#F0BBDA" strokeOpacity="0.5" strokeWidth="0.5" strokeDasharray="2 2" />
    <circle cx="10" cy="48" r="1" fill="#F0BBDA" />
    <circle cx="54" cy="48" r="1" fill="#F0BBDA" />
  </svg>
);

// ─── Crash — rocket curve ───────────────────────────────────────────
const CrashArt = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    {[0, 1, 2, 3].map((i) => <line key={i} x1="6" y1={16 + i * 10} x2="58" y2={16 + i * 10} stroke="rgba(0,224,209,0.15)" strokeDasharray="1 2" />)}
    <path d="M 8 54 Q 22 54 32 42 T 54 12 L 54 54 Z" fill="rgba(0,224,209,0.2)" />
    <path d="M 8 54 Q 22 54 32 42 T 54 12" stroke="#00E0D1" strokeWidth="2" strokeLinecap="round" fill="none" />
    <circle cx="54" cy="12" r="3" fill="#00E0D1" />
    <path d="M 54 12 L 58 8 M 54 12 L 50 8 M 54 12 L 54 7" stroke="#00E0D1" strokeWidth="0.9" strokeLinecap="round" />
    <text x="34" y="24" fontFamily="Geist Mono" fontSize="7" fontWeight="800" fill="#fff">2.84×</text>
  </svg>
);

// ─── Chicken Road — stepping stones w/ multipliers ──────────────────
const ChickenArt = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    {[0, 1, 2, 3, 4].map((i) => (
      <rect key={i} x={4 + i * 12} y={46} width="10" height="7" rx="1.5"
        fill={i <= 1 ? '#F6B85D' : 'rgba(246,184,93,0.16)'} stroke="#F6B85D" strokeWidth="0.6" />
    ))}
    {['1.2', '1.8', '2.7', '4.1', '6.0'].map((m, i) => (
      <text key={i} x={9 + i * 12} y="42" textAnchor="middle" fontFamily="Geist Mono" fontSize="4.5" fontWeight="700"
        fill={i <= 1 ? '#F6B85D' : 'rgba(246,184,93,0.55)'}>{m}×</text>
    ))}
    <g transform="translate(20 24)">
      <ellipse cx="0" cy="4" rx="7" ry="6" fill="#fff" />
      <circle cx="4" cy="-1" r="4" fill="#fff" />
      <path d="M 1 -5 L 3 -7 L 4 -5 L 5 -7 L 6 -5 Z" fill="#C8364B" />
      <path d="M 7 0 L 10 0.5 L 7 2 Z" fill="#F6B85D" />
      <circle cx="5" cy="-1" r="0.7" fill="#1a0a0d" />
      <line x1="-2" y1="10" x2="-2" y2="13" stroke="#F6B85D" strokeWidth="1" strokeLinecap="round" />
      <line x1="2" y1="10" x2="2" y2="13" stroke="#F6B85D" strokeWidth="1" strokeLinecap="round" />
    </g>
  </svg>
);

// ─── Hi-Lo — card flanked by HI/LO arrows ───────────────────────────
const HiloArt = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <g>
      <text x="12" y="16" textAnchor="middle" fontFamily="Geist Mono" fontSize="6" fontWeight="800" fill="#00E082">HI</text>
      <path d="M 12 22 L 12 32" stroke="#00E082" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M 8 26 L 12 22 L 16 26" stroke="#00E082" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <rect x="22" y="14" width="20" height="36" rx="2.5" fill="#fff" stroke="rgba(0,0,0,0.15)" />
    <text x="25" y="24" fontFamily="Georgia, serif" fontSize="9" fontWeight="700" fill="#0a0f15">8</text>
    <text x="25" y="32" fontFamily="serif" fontSize="6" fill="#0a0f15">♠</text>
    <text x="32" y="42" textAnchor="middle" fontFamily="serif" fontSize="14" fill="#0a0f15">♠</text>
    <g>
      <text x="52" y="50" textAnchor="middle" fontFamily="Geist Mono" fontSize="6" fontWeight="800" fill="#F0445A">LO</text>
      <path d="M 52 32 L 52 42" stroke="#F0445A" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M 48 38 L 52 42 L 56 38" stroke="#F0445A" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

// ─── Flip — coin in motion ──────────────────────────────────────────
const FlipArt = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <path d="M 12 50 Q 32 6 52 50" stroke="rgba(245,214,138,0.3)" strokeWidth="0.9" strokeDasharray="1.5 2" fill="none" />
    <ellipse cx="32" cy="14" rx="10" ry="3" fill="#d4a857" stroke="#7a5a25" strokeWidth="0.6" />
    <ellipse cx="32" cy="14" rx="10" ry="3" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
    <g transform="translate(14 46)">
      <circle r="7" fill="#d4a857" stroke="#7a5a25" strokeWidth="0.8" />
      <circle r="5" fill="none" stroke="#7a5a25" strokeWidth="0.4" />
      <text y="3" textAnchor="middle" fontFamily="serif" fontWeight="800" fontSize="9" fill="#3a2a14">H</text>
    </g>
    <g transform="translate(50 46)">
      <circle r="7" fill="#f5d68a" stroke="#7a5a25" strokeWidth="0.8" />
      <circle r="5" fill="none" stroke="#7a5a25" strokeWidth="0.4" />
      <text y="3" textAnchor="middle" fontFamily="serif" fontWeight="800" fontSize="9" fill="#3a2a14">T</text>
    </g>
  </svg>
);

// ─── Pump — balloon w/ pressure gauge ───────────────────────────────
const PumpArt = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <ellipse cx="28" cy="28" rx="15" ry="17" fill="#E879B6" />
    <ellipse cx="22" cy="22" rx="3" ry="2" fill="rgba(255,255,255,0.4)" />
    <path d="M 26 44 L 30 44 L 28 48 Z" fill="#9a3a6e" />
    <path d="M 28 48 Q 25 54 30 60" stroke="#9a3a6e" strokeWidth="0.8" fill="none" />
    <g transform="translate(52 18)">
      <rect x="-10" y="-7" width="20" height="14" rx="2" fill="#1f0a18" stroke="#E879B6" strokeWidth="0.7" />
      <text y="-1" textAnchor="middle" fontFamily="Geist Mono" fontSize="4.5" fontWeight="700" fill="#F0BBDA" letterSpacing="0.1em">PSI</text>
      <text y="5" textAnchor="middle" fontFamily="Geist Mono" fontSize="5.5" fontWeight="800" fill="#fff">3.2×</text>
    </g>
  </svg>
);

// ─── RPS — rock / paper / scissors ──────────────────────────────────
const RpsArt = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <g transform="translate(12 32)">
      <circle r="8" fill="#8B8B9C" />
      <ellipse cx="-2.5" cy="-2.5" rx="2" ry="1.4" fill="rgba(255,255,255,0.25)" />
      <circle cx="2" cy="2" r="1" fill="rgba(0,0,0,0.2)" />
    </g>
    <g transform="translate(32 32)">
      <rect x="-6.5" y="-9" width="13" height="18" rx="1.2" fill="#fff" stroke="rgba(0,0,0,0.2)" strokeWidth="0.6" />
      <line x1="-4.5" y1="-5" x2="4.5" y2="-5" stroke="rgba(0,0,0,0.3)" strokeWidth="0.6" />
      <line x1="-4.5" y1="-1" x2="4.5" y2="-1" stroke="rgba(0,0,0,0.3)" strokeWidth="0.6" />
      <line x1="-4.5" y1="3" x2="2.5" y2="3" stroke="rgba(0,0,0,0.3)" strokeWidth="0.6" />
    </g>
    <g transform="translate(52 32)" stroke="#B392F0" strokeWidth="1.4" strokeLinecap="round" fill="none">
      <circle cx="-3" cy="6" r="2.5" />
      <circle cx="3" cy="6" r="2.5" />
      <line x1="-1" y1="4" x2="5" y2="-7" />
      <line x1="1" y1="4" x2="-5" y2="-7" />
      <circle cx="0" cy="-1" r="0.6" fill="#B392F0" />
    </g>
  </svg>
);

// ─── Poker — two hole cards + a chip ────────────────────────────────
const PokerArt = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <g transform="translate(24 34) rotate(-12)">
      <rect x="-9" y="-13" width="18" height="26" rx="2.4" fill="#fff" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
      <path d="M0 -7 C4 -3 7 0 0 6 C-7 0 -4 -3 0 -7 Z" fill="#0a0d12" />
      <rect x="-1" y="3" width="2" height="4" fill="#0a0d12" />
    </g>
    <g transform="translate(38 32) rotate(10)">
      <rect x="-9" y="-13" width="18" height="26" rx="2.4" fill="#fff" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
      <path d="M0 -6 L4 0 L0 6 L-4 0 Z" fill="#9a1f2e" />
    </g>
    <g transform="translate(44 46)">
      <circle r="8" fill="#21D07A" stroke="#0a0d12" strokeWidth="1.2" strokeDasharray="2 2.4" />
      <circle r="4.2" fill="none" stroke="#0a0d12" strokeWidth="1" />
    </g>
  </svg>
);

export const gameArt: Record<string, () => ReactElement> = {
  poker: PokerArt,
  roulette: RouletteArt,
  plinko: PlinkoArt,
  mines: MinesArt,
  blackjack: BlackjackArt,
  dice: DiceArt,
  slots: SlotsArt,
  crash: CrashArt,
  chicken: ChickenArt,
  hilo: HiloArt,
  flip: FlipArt,
  pump: PumpArt,
  rps: RpsArt,
};
