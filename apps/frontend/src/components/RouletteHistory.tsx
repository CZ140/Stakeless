import { useMemo } from 'react';
import { useRouletteStore, type HistoryEntry } from '../stores/rouletteStore';

const COLOR_BG: Record<string, string> = {
  red: '#dc2626',
  black: '#111827',
  green: '#16a34a',
};

function StatBar({ label, segments }: {
  label: string;
  segments: { color: string; pct: number; count: number; name: string }[];
}) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '0.7rem', color: '#718096', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', height: '20px' }}>
        {segments.map((seg) => (
          <div
            key={seg.name}
            title={`${seg.name}: ${seg.count} (${Math.round(seg.pct)}%)`}
            style={{
              width: `${seg.pct}%`,
              backgroundColor: seg.color,
              transition: 'width 0.4s ease',
              minWidth: seg.count > 0 ? '2px' : '0',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
        {segments.map((seg) => (
          <span key={seg.name} style={{ fontSize: '0.65rem', color: '#718096' }}>
            {seg.name} {Math.round(seg.pct)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function computeStats(entries: HistoryEntry[]) {
  const last10 = entries.slice(0, 10);
  const total = last10.length;
  if (total === 0) return null;

  // Exclude green (0) for color/parity/dozen stats — zero is a special pocket
  const nonZero = last10.filter((e) => e.pocket !== 0);
  const nz = nonZero.length || 1; // avoid div/0

  const reds = nonZero.filter((e) => e.color === 'red').length;
  const blacks = nonZero.filter((e) => e.color === 'black').length;
  const odds = nonZero.filter((e) => e.pocket % 2 !== 0).length;
  const evens = nonZero.filter((e) => e.pocket % 2 === 0).length;
  const d1 = nonZero.filter((e) => e.pocket >= 1 && e.pocket <= 12).length;
  const d2 = nonZero.filter((e) => e.pocket >= 13 && e.pocket <= 24).length;
  const d3 = nonZero.filter((e) => e.pocket >= 25 && e.pocket <= 36).length;
  const zeros = last10.filter((e) => e.pocket === 0).length;

  return { reds, blacks, odds, evens, d1, d2, d3, zeros, nz, total };
}

export function RouletteHistory() {
  const history = useRouletteStore((s) => s.history);

  const stats = useMemo(() => computeStats(history), [history]);

  return (
    <div style={{
      width: '200px',
      flexShrink: 0,
      backgroundColor: '#12122a',
      borderRadius: '12px',
      border: '1px solid #2d2d4e',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>
      {/* Header */}
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e0d7ff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        History
      </div>

      {/* Number badges — newest first, scrollable */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
        {history.length === 0 ? (
          <span style={{ fontSize: '0.75rem', color: '#4a4a6a' }}>No spins yet</span>
        ) : (
          history.map((entry, i) => (
            <div
              key={i}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: COLOR_BG[entry.color],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#ffffff',
                flexShrink: 0,
                border: i === 0 ? '2px solid #a78bfa' : '2px solid transparent',
                boxShadow: i === 0 ? '0 0 6px rgba(167,139,250,0.5)' : 'none',
              }}
            >
              {entry.pocket}
            </div>
          ))
        )}
      </div>

      {/* Stats — last 10 spins */}
      {stats ? (
        <div>
          <div style={{ fontSize: '0.7rem', color: '#4a4a6a', marginBottom: '10px', borderTop: '1px solid #2d2d4e', paddingTop: '10px' }}>
            LAST {stats.total} SPINS
          </div>

          <StatBar
            label="Red / Black"
            segments={[
              { name: 'Red', color: '#dc2626', pct: (stats.reds / stats.nz) * 100, count: stats.reds },
              { name: 'Black', color: '#374151', pct: (stats.blacks / stats.nz) * 100, count: stats.blacks },
            ]}
          />

          <StatBar
            label="Odd / Even"
            segments={[
              { name: 'Odd', color: '#7c3aed', pct: (stats.odds / stats.nz) * 100, count: stats.odds },
              { name: 'Even', color: '#4c1d95', pct: (stats.evens / stats.nz) * 100, count: stats.evens },
            ]}
          />

          <StatBar
            label="Dozens"
            segments={[
              { name: '1-12', color: '#0e7490', pct: (stats.d1 / stats.nz) * 100, count: stats.d1 },
              { name: '13-24', color: '#0369a1', pct: (stats.d2 / stats.nz) * 100, count: stats.d2 },
              { name: '25-36', color: '#1d4ed8', pct: (stats.d3 / stats.nz) * 100, count: stats.d3 },
            ]}
          />

          {stats.zeros > 0 && (
            <div style={{ fontSize: '0.65rem', color: '#16a34a', marginTop: '4px' }}>
              Zero landed {stats.zeros}× in last {stats.total}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '0.7rem', color: '#4a4a6a' }}>
          Stats appear after first spin
        </div>
      )}
    </div>
  );
}
