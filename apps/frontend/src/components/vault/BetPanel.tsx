import { useState, type ReactNode } from 'react';
import { AutoBetControls } from './AutoBetControls';
import type { AutoBetConfig } from '../../lib/autobet';
import type { AutoBetStats } from '../../hooks/useAutoBet';

export interface SummaryRow {
  label: string;
  value: string;
  win?: boolean;
}

/** Wiring for the "Auto" tab. When omitted, the Auto tab stays disabled. */
export interface AutoBetBinding {
  running: boolean;
  stats: AutoBetStats;
  onStart: (cfg: Omit<AutoBetConfig, 'baseBet'>) => void;
  onStop: () => void;
  storageKey: string;
  disabled?: boolean;
  disabledHint?: string;
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
  /** Enables + wires the "Auto" tab. Omit to keep auto-bet unavailable. */
  autoBet?: AutoBetBinding;
  /** Extra controls shown only in the Auto tab (e.g. a ladder cash-out strategy). */
  autoExtra?: ReactNode;
}

function formatAmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Shared bet panel for amount-based games. The "Auto" tab is enabled only when an
// `autoBet` binding is supplied; otherwise it stays disabled.
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
  autoBet,
  autoExtra,
}: BetPanelProps) {
  const [tab, setTab] = useState<'manual' | 'auto'>('manual');
  // While auto-bet runs, pin the Auto tab and lock the base-bet inputs.
  const autoRunning = autoBet?.running ?? false;
  const activeTab = autoRunning ? 'auto' : tab;
  const inputsLocked = amountLocked || autoRunning;

  const quick: { label: string; apply: () => number }[] = [
    { label: '½', apply: () => Math.max(1, Math.floor(amount / 2)) },
    { label: '2×', apply: () => amount * 2 },
    { label: 'MIN', apply: () => 1 },
    { label: 'MAX', apply: () => Math.max(1, Math.floor(balance ?? amount)) },
  ];

  return (
    <div className="bet-panel">
      <div className="tabs-2">
        <button
          className={activeTab === 'manual' ? 'active' : ''}
          type="button"
          disabled={autoRunning}
          onClick={() => setTab('manual')}
        >
          Manual
        </button>
        {autoBet ? (
          <button className={activeTab === 'auto' ? 'active' : ''} type="button" onClick={() => setTab('auto')}>
            Auto
          </button>
        ) : (
          <button type="button" disabled title="Auto-betting coming soon" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
            Auto
          </button>
        )}
      </div>
      <div className="body">
        <div>
          <label className="label">{activeTab === 'auto' ? 'Base bet' : 'Bet amount'}</label>
          <div className="amount-row">
            <input
              className="input"
              data-mono
              type="number"
              min={1}
              value={amount}
              disabled={inputsLocked}
              onChange={(e) => onAmountChange(Math.max(1, Math.floor(+e.target.value || 0)))}
            />
            <span className="coin-suffix">
              <span className="dot" /> COINS
            </span>
          </div>
        </div>

        <div className="quick-bets">
          {quick.map((q) => (
            <button key={q.label} type="button" disabled={inputsLocked} onClick={() => onAmountChange(q.apply())}>
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

        {activeTab === 'auto' && autoBet ? (
          <AutoBetControls
            baseBet={amount}
            balance={balance}
            running={autoBet.running}
            stats={autoBet.stats}
            onStart={autoBet.onStart}
            onStop={autoBet.onStop}
            disabled={autoBet.disabled}
            disabledHint={autoBet.disabledHint}
            storageKey={autoBet.storageKey}
          >
            {autoExtra}
          </AutoBetControls>
        ) : (
          <button className="btn btn-primary place-bet" disabled={primaryDisabled} onClick={onPrimary} type="button">
            {primaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
