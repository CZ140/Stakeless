import React from 'react';
import { useRouletteStore, type BetZone } from '../stores/rouletteStore';
import { useBalanceStore } from '../stores/balanceStore';

const NUMBER_ROWS: [number, number, number][] = Array.from({ length: 12 }, (_, i) => [
  i * 3 + 1, i * 3 + 2, i * 3 + 3,
]);

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

interface RouletteTableProps {
  disabled: boolean;
}

export function RouletteTable({ disabled }: RouletteTableProps) {
  const { placeChip, selectedChip } = useRouletteStore();
  const balance = useBalanceStore((s) => s.balance);

  function handlePlace(zone: BetZone) {
    if (disabled) return;
    // For Max chip: use current balance at click time, not stale value
    // selectedChip is already set to balance value by ChipRack's handleMaxChip
    void selectedChip; // used via store
    placeChip(zone);
  }

  // Cell style helper
  const cellStyle = (bg: string): React.CSSProperties => ({
    backgroundColor: bg,
    border: '1px solid #2d2d4e',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#ffffff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    padding: '8px 4px',
    minHeight: '36px',
    userSelect: 'none' as const,
    opacity: disabled ? 0.6 : 1,
    transition: 'opacity 0.2s',
  });

  // Suppress unused variable warning — balance used for future Max chip resolution
  void balance;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      {/* Number grid */}
      <div style={{ display: 'grid', gap: '2px', marginBottom: '4px' }}>
        {/* Zero */}
        <div
          onClick={() => handlePlace('number_0')}
          style={{ ...cellStyle('#16a34a'), gridColumn: '1 / -1', minHeight: '36px' }}
        >
          0
        </div>
        {/* 1-36 in 3-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
          {NUMBER_ROWS.map(([a, b, c]) => (
            <React.Fragment key={a}>
              {[a, b, c].map((n) => (
                <div
                  key={n}
                  onClick={() => handlePlace(`number_${n}`)}
                  style={cellStyle(RED_NUMBERS.has(n) ? '#dc2626' : '#111827')}
                >
                  {n}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Outside bets */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {([
          ['red', 'Red'],
          ['black', 'Black'],
          ['odd', 'Odd'],
          ['even', 'Even'],
          ['dozen_1', '1-12'],
          ['dozen_2', '13-24'],
          ['dozen_3', '25-36'],
          ['col_1', 'Col 1'],
          ['col_2', 'Col 2'],
          ['col_3', 'Col 3'],
        ] as [BetZone, string][]).map(([zone, label]) => (
          <div
            key={zone}
            onClick={() => handlePlace(zone)}
            style={{ ...cellStyle('#1a1a2e'), flex: 1, minWidth: '70px' }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
