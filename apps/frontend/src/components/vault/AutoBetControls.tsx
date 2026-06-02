import { useState, type ReactNode } from 'react';
import type { AutoBetConfig, ProgressionStep } from '../../lib/autobet';
import type { AutoBetStats } from '../../hooks/useAutoBet';

interface AutoBetControlsProps {
  /** Current bet amount from the game store — becomes the auto base bet. */
  baseBet: number;
  balance: number | null;
  running: boolean;
  stats: AutoBetStats;
  onStart: (cfg: Omit<AutoBetConfig, 'baseBet'>) => void;
  onStop: () => void;
  /** Precondition not met (e.g. Crash auto-cashout off) — disables Start. */
  disabled?: boolean;
  disabledHint?: string;
  /** localStorage key for persisting this game's auto config. */
  storageKey: string;
  /** Game-specific strategy controls (ladder target/steps, etc.). */
  children?: ReactNode;
}

interface Persisted {
  numberOfBets: number;
  onWin: ProgressionStep;
  onLoss: ProgressionStep;
  stopOnProfit: number | null;
  stopOnLoss: number | null;
  maxBet: number | null;
}

const DEFAULTS: Persisted = {
  numberOfBets: 0,
  onWin: { action: 'reset', pct: 0 },
  onLoss: { action: 'reset', pct: 0 },
  stopOnProfit: null,
  stopOnLoss: null,
  maxBet: null,
};

function load(key: string): Persisted {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persisted>) };
  } catch {
    return DEFAULTS;
  }
}

// Parse an optional positive number field; blank → null (disabled).
function optNum(v: string): number | null {
  const n = Math.floor(Number(v));
  return v.trim() === '' || !Number.isFinite(n) || n <= 0 ? null : n;
}

function ProgressionRow({
  label,
  step,
  disabled,
  onChange,
}: {
  label: string;
  step: ProgressionStep;
  disabled: boolean;
  onChange: (s: ProgressionStep) => void;
}) {
  return (
    <div className="ab-field">
      <label className="label">{label}</label>
      <div className="ab-progression">
        <div className="ab-seg">
          <button
            type="button"
            className={step.action === 'reset' ? 'active' : ''}
            disabled={disabled}
            onClick={() => onChange({ action: 'reset', pct: step.pct })}
          >
            Reset
          </button>
          <button
            type="button"
            className={step.action === 'increase' ? 'active' : ''}
            disabled={disabled}
            onClick={() => onChange({ action: 'increase', pct: step.pct || 100 })}
          >
            Increase
          </button>
        </div>
        <div className="amount-row ab-pct">
          <input
            className="input"
            data-mono
            type="number"
            min={0}
            step={1}
            value={step.pct}
            disabled={disabled || step.action !== 'increase'}
            onChange={(e) => onChange({ action: step.action, pct: Math.max(0, Math.floor(+e.target.value || 0)) })}
          />
          <span className="coin-suffix">%</span>
        </div>
      </div>
    </div>
  );
}

export function AutoBetControls({
  baseBet,
  balance,
  running,
  stats,
  onStart,
  onStop,
  disabled,
  disabledHint,
  storageKey,
  children,
}: AutoBetControlsProps) {
  const [cfg, setCfg] = useState<Persisted>(() => load(storageKey));
  const patch = (p: Partial<Persisted>) => {
    setCfg((c) => {
      const next = { ...c, ...p };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const start = () => {
    if (disabled) return;
    onStart({
      numberOfBets: cfg.numberOfBets,
      onWin: cfg.onWin,
      onLoss: cfg.onLoss,
      stopOnProfit: cfg.stopOnProfit,
      stopOnLoss: cfg.stopOnLoss,
      maxBet: cfg.maxBet,
    });
  };

  const lock = running; // config locked while running

  return (
    <div className="autobet">
      {children}

      <div className="ab-field">
        <label className="label">Number of bets <span className="fg-dim">· 0 = ∞</span></label>
        <div className="amount-row">
          <input
            className="input"
            data-mono
            type="number"
            min={0}
            step={1}
            value={cfg.numberOfBets}
            disabled={lock}
            onChange={(e) => patch({ numberOfBets: Math.max(0, Math.floor(+e.target.value || 0)) })}
          />
          <span className="coin-suffix">×</span>
        </div>
      </div>

      <ProgressionRow label="On win" step={cfg.onWin} disabled={lock} onChange={(onWin) => patch({ onWin })} />
      <ProgressionRow label="On loss" step={cfg.onLoss} disabled={lock} onChange={(onLoss) => patch({ onLoss })} />

      <div className="ab-stops">
        <div className="ab-field">
          <label className="label">Stop on profit</label>
          <input
            className="input"
            data-mono
            type="number"
            min={0}
            placeholder="—"
            value={cfg.stopOnProfit ?? ''}
            disabled={lock}
            onChange={(e) => patch({ stopOnProfit: optNum(e.target.value) })}
          />
        </div>
        <div className="ab-field">
          <label className="label">Stop on loss</label>
          <input
            className="input"
            data-mono
            type="number"
            min={0}
            placeholder="—"
            value={cfg.stopOnLoss ?? ''}
            disabled={lock}
            onChange={(e) => patch({ stopOnLoss: optNum(e.target.value) })}
          />
        </div>
      </div>

      <div className="ab-field">
        <label className="label">Max bet <span className="fg-dim">· optional cap</span></label>
        <input
          className="input"
          data-mono
          type="number"
          min={0}
          placeholder="—"
          value={cfg.maxBet ?? ''}
          disabled={lock}
          onChange={(e) => patch({ maxBet: optNum(e.target.value) })}
        />
      </div>

      {running && (
        <div className="ab-status">
          <span>
            Bet <strong>{stats.betsDone}</strong>
            {cfg.numberOfBets > 0 ? ` / ${cfg.numberOfBets}` : ''}
          </span>
          <span className={stats.net >= 0 ? 'win' : 'loss'}>
            {stats.net >= 0 ? '+' : '−'}
            {Math.abs(stats.net).toLocaleString()}
          </span>
        </div>
      )}

      {running ? (
        <button className="btn btn-outline place-bet" type="button" onClick={onStop}>
          Stop auto-bet
        </button>
      ) : (
        <button
          className="btn btn-primary place-bet"
          type="button"
          onClick={start}
          disabled={disabled || (balance != null && balance < baseBet)}
          title={disabled ? disabledHint : undefined}
        >
          Start auto-bet
        </button>
      )}
      {disabled && disabledHint && <div className="ab-hint">{disabledHint}</div>}
    </div>
  );
}
