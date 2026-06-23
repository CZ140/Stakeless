import type { PlacedChip } from '../stores/rouletteStore';

interface ResultOverlayProps {
  visible: boolean;
  winningPocket: number | null;
  netAmount: number;
  bets: PlacedChip[];
}

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function getPocketLabel(pocket: number): { color: string; label: string } {
  if (pocket === 0) return { color: '#16a34a', label: 'Green' };
  return RED_NUMBERS.has(pocket)
    ? { color: '#dc2626', label: 'Red' }
    : { color: '#374151', label: 'Black' };
}

function isBetWon(pocket: number, zone: string): boolean {
  if (pocket === 0) return zone === 'number_0';
  if (zone === 'red') return RED_NUMBERS.has(pocket);
  if (zone === 'black') return !RED_NUMBERS.has(pocket);
  if (zone === 'odd') return pocket % 2 !== 0;
  if (zone === 'even') return pocket % 2 === 0;
  if (zone === 'dozen_1') return pocket >= 1 && pocket <= 12;
  if (zone === 'dozen_2') return pocket >= 13 && pocket <= 24;
  if (zone === 'dozen_3') return pocket >= 25 && pocket <= 36;
  if (zone === 'col_1') return pocket % 3 === 1;
  if (zone === 'col_2') return pocket % 3 === 2;
  if (zone === 'col_3') return pocket % 3 === 0;
  return pocket === parseInt(zone.replace('number_', ''), 10);
}

// Display multiplier (payout odds, casino convention)
function getDisplayMultiplier(zone: string): number {
  if (zone.startsWith('number_')) return 35;
  if (['dozen_1', 'dozen_2', 'dozen_3', 'col_1', 'col_2', 'col_3'].includes(zone)) return 3;
  return 2;
}

const ZONE_LABEL: Record<string, string> = {
  red: 'Red', black: 'Black', odd: 'Odd', even: 'Even',
  dozen_1: '1–12', dozen_2: '13–24', dozen_3: '25–36',
  col_1: 'Col 1', col_2: 'Col 2', col_3: 'Col 3',
};

function getZoneLabel(zone: string): string {
  if (zone.startsWith('number_')) return `No. ${zone.replace('number_', '')}`;
  return ZONE_LABEL[zone] ?? zone;
}

export function ResultOverlay({ visible, winningPocket, netAmount, bets }: ResultOverlayProps) {
  const pocket = winningPocket ?? 0;
  const { color, label } = getPocketLabel(pocket);
  const won = netAmount > 0;

  // Aggregate bets by zone, compute which ones won
  const aggregated = bets.reduce<Record<string, number>>((acc, chip) => {
    acc[chip.zone] = (acc[chip.zone] ?? 0) + chip.amount;
    return acc;
  }, {});

  const winningBets = Object.entries(aggregated)
    .filter(([zone]) => isBetWon(pocket, zone))
    .map(([zone, amount]) => ({
      label: getZoneLabel(zone),
      multiplier: getDisplayMultiplier(zone),
      payout: amount * (getDisplayMultiplier(zone) - 1), // net winnings only
    }));

  return (
    <>
      {visible && (
        <div
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#1a1a2e',
            border: `2px solid ${won ? '#7c3aed' : '#4a4a6e'}`,
            borderRadius: '16px',
            padding: '28px 36px',
            zIndex: 100,
            textAlign: 'center',
            minWidth: '220px',
            boxShadow: won ? '0 0 32px rgba(124,58,237,0.4)' : 'none',
            animation: 'modal-pop-centered 0.25s ease-out',
          }}
        >
          {/* Winning number */}
          <div style={{ fontSize: '3rem', fontWeight: 800, color, marginBottom: '4px' }}>
            {pocket}
          </div>
          <div style={{ color: '#718096', marginBottom: '16px', fontSize: '0.9rem' }}>
            {label}
          </div>

          {/* Winning bet breakdown */}
          {winningBets.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              {winningBets.map(({ label: bl, multiplier, payout }) => (
                <div key={bl} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '4px 0',
                  borderBottom: '1px solid #2d2d4e',
                  fontSize: '0.85rem',
                }}>
                  <span style={{ color: '#e0d7ff' }}>{bl}</span>
                  <span style={{
                    backgroundColor: '#2d2d4e',
                    color: '#a78bfa',
                    borderRadius: '6px',
                    padding: '1px 7px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}>{multiplier}×</span>
                  <span style={{ color: '#a78bfa', fontWeight: 600 }}>+{payout}</span>
                </div>
              ))}
            </div>
          )}

          {/* Net total */}
          <div style={{
            fontSize: '1.4rem', fontWeight: 700,
            color: won ? '#a78bfa' : netAmount === 0 ? '#e0d7ff' : '#ef4444',
            marginBottom: '8px',
          }}>
            {won ? `+${netAmount}` : netAmount === 0 ? '+/-0' : `${netAmount}`} coins
          </div>

          <div style={{ color: '#718096', fontSize: '0.78rem', marginTop: '8px' }}>
            Press Spin to play again
          </div>
        </div>
      )}
    </>
  );
}
