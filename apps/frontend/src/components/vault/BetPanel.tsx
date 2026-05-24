import type { ReactNode } from 'react';

export interface SummaryRow {
  label: string;
  value: string;
  win?: boolean;
}

interface BetPanelProps {
  amount: number;
  onAmountChange: (n: number) => void;
  balance: number | null;
  /** Disable the amount field + quick bets (e.g. while a round is in progress). */
  amountLocked?: boolean;
  multiplier?: string;
  profitOnWin?: number;
  summary?: SummaryRow[];
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  /** Game-specific controls (risk selector, mine count, etc.). */
  children?: ReactNode;
}

function formatAmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Shared bet panel for amount-based games (Plinko / Mines / Blackjack).
// The "Auto" tab is rendered but disabled — auto-betting is not implemented,
// so it is shown as unavailable rather than faked.
export function BetPanel({
  amount,
  onAmountChange,
  balance,
  amountLocked = false,
  multiplier,
  profitOnWin,
  summary,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  children,
}: BetPanelProps) {
  const quick: { label: string; apply: () => number }[] = [
    { label: '½', apply: () => Math.max(1, Math.floor(amount / 2)) },
    { label: '2×', apply: () => amount * 2 },
    { label: 'MIN', apply: () => 1 },
    { label: 'MAX', apply: () => Math.max(1, Math.floor(balance ?? amount)) },
  ];

  return (
    <div className="bet-panel">
      <div className="tabs-2">
        <button className="active" type="button">
          Manual
        </button>
        <button type="button" disabled title="Auto-betting coming soon" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
          Auto
        </button>
      </div>
      <div className="body">
        <div>
          <label className="label">Bet amount</label>
          <div className="amount-row">
            <input
              className="input"
              data-mono
              type="number"
              min={1}
              value={amount}
              disabled={amountLocked}
              onChange={(e) => onAmountChange(Math.max(1, Math.floor(+e.target.value || 0)))}
            />
            <span className="coin-suffix">
              <span className="dot" /> COINS
            </span>
          </div>
        </div>

        <div className="quick-bets">
          {quick.map((q) => (
            <button key={q.label} type="button" disabled={amountLocked} onClick={() => onAmountChange(q.apply())}>
              {q.label}
            </button>
          ))}
        </div>

        {children}

        {(multiplier != null || profitOnWin != null || summary) && (
          <div className="bet-summary">
            {multiplier != null && (
              <div className="row">
                <span>Multiplier</span>
                <span className="mono">{multiplier}×</span>
              </div>
            )}
            {profitOnWin != null && (
              <div className="row">
                <span>Profit on win</span>
                <span className="win mono">+{formatAmt(profitOnWin)}</span>
              </div>
            )}
            {summary?.map((s, i) => (
              <div key={i} className="row">
                <span>{s.label}</span>
                <span className={s.win ? 'win mono' : 'mono'}>{s.value}</span>
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-primary place-bet" disabled={primaryDisabled} onClick={onPrimary} type="button">
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
