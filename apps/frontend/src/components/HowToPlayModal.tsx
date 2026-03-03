import { motion, AnimatePresence } from 'framer-motion';

interface HowToPlayModalProps {
  open: boolean;
  onClose: () => void;
}

const BET_TYPES = [
  { bet: 'Red / Black', covers: '18 numbers each', payout: '1:1', note: 'Zero is neither' },
  { bet: 'Odd / Even', covers: '18 numbers each', payout: '1:1', note: 'Zero loses' },
  { bet: 'Dozens (1-12, 13-24, 25-36)', covers: '12 numbers each', payout: '2:1', note: '' },
  { bet: 'Columns (Col 1, 2, 3)', covers: '12 numbers each', payout: '2:1', note: 'Zero loses' },
  { bet: 'Straight Up (single number)', covers: '1 number', payout: '35:1', note: '0-36 including zero' },
];

export function HowToPlayModal({ open, onClose }: HowToPlayModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="htplay-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              zIndex: 200,
            }}
          />
          {/* Centering wrapper — flexbox so Framer Motion transform doesn't fight translate(-50%,-50%) */}
          <div style={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 201, pointerEvents: 'none',
          }}>
          <motion.div
            key="htplay-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              backgroundColor: '#1a1a2e',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '560px',
              width: '90vw',
              maxHeight: '80vh',
              overflowY: 'auto',
              pointerEvents: 'auto',
            }}
          >
            <h2 style={{ color: '#e0d7ff', marginTop: 0, marginBottom: '16px' }}>
              How to Play Roulette
            </h2>
            <p style={{ color: '#718096', marginBottom: '20px', fontSize: '0.9rem' }}>
              European Roulette -- single zero (0), 37 pockets. House edge: 2.70%.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2d2d4e' }}>
                  <th style={{ color: '#e0d7ff', textAlign: 'left', paddingBottom: '8px' }}>Bet</th>
                  <th style={{ color: '#e0d7ff', textAlign: 'left', paddingBottom: '8px' }}>Covers</th>
                  <th style={{ color: '#e0d7ff', textAlign: 'right', paddingBottom: '8px' }}>Payout</th>
                </tr>
              </thead>
              <tbody>
                {BET_TYPES.map(({ bet, covers, payout, note }) => (
                  <tr key={bet} style={{ borderBottom: '1px solid #1a1a2e' }}>
                    <td style={{ color: '#e0d7ff', padding: '8px 0' }}>
                      {bet}
                      {note && <div style={{ color: '#718096', fontSize: '0.75rem' }}>{note}</div>}
                    </td>
                    <td style={{ color: '#718096', padding: '8px 8px' }}>{covers}</td>
                    <td style={{ color: '#a78bfa', textAlign: 'right', padding: '8px 0', fontWeight: 700 }}>{payout}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ color: '#718096', marginTop: '16px', fontSize: '0.8rem' }}>
              Select a chip denomination, click a table zone to place chips, then click Spin.
              You can place chips on multiple zones per spin.
            </p>
            <button
              onClick={onClose}
              style={{
                marginTop: '16px',
                padding: '10px 24px',
                backgroundColor: '#7c3aed',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              Got It
            </button>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
