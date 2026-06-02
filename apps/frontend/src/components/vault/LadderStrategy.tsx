// Per-round auto-play strategy for the ladder games (Mines, Pump, Chicken, Hi-Lo):
// cash out once the multiplier reaches a target, OR after a fixed number of safe
// steps. Shared control + a tiny persistence helper; each page owns the state so
// its playRound adapter can read the latest values.

export interface LadderStrategy {
  mode: 'multiplier' | 'steps';
  multiplier: number; // cash out at ≥ this multiplier
  steps: number; // or after this many safe steps
}

const DEFAULT: LadderStrategy = { mode: 'multiplier', multiplier: 2, steps: 3 };

export function loadLadderStrategy(key: string): LadderStrategy {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<LadderStrategy>) };
  } catch {
    return DEFAULT;
  }
}

export function LadderStrategyControls({
  value,
  onChange,
  stepLabel,
  storageKey,
  disabled,
}: {
  value: LadderStrategy;
  onChange: (s: LadderStrategy) => void;
  stepLabel: string; // "tiles" | "pumps" | "lanes" | "guesses"
  storageKey: string;
  disabled?: boolean;
}) {
  const patch = (p: Partial<LadderStrategy>) => {
    const next = { ...value, ...p };
    localStorage.setItem(storageKey, JSON.stringify(next));
    onChange(next);
  };

  return (
    <div className="ab-field">
      <label className="label">Auto cash-out</label>
      <div className="ab-seg" style={{ marginBottom: 8 }}>
        <button type="button" className={value.mode === 'multiplier' ? 'active' : ''} disabled={disabled} onClick={() => patch({ mode: 'multiplier' })}>
          At multiplier
        </button>
        <button type="button" className={value.mode === 'steps' ? 'active' : ''} disabled={disabled} onClick={() => patch({ mode: 'steps' })}>
          After {stepLabel}
        </button>
      </div>
      {value.mode === 'multiplier' ? (
        <div className="amount-row">
          <input
            className="input"
            data-mono
            type="number"
            min={1.01}
            step={0.1}
            value={value.multiplier}
            disabled={disabled}
            onChange={(e) => patch({ multiplier: Math.max(1.01, +e.target.value || 1.01) })}
          />
          <span className="coin-suffix">×</span>
        </div>
      ) : (
        <div className="amount-row">
          <input
            className="input"
            data-mono
            type="number"
            min={1}
            step={1}
            value={value.steps}
            disabled={disabled}
            onChange={(e) => patch({ steps: Math.max(1, Math.floor(+e.target.value || 1)) })}
          />
          <span className="coin-suffix">{stepLabel}</span>
        </div>
      )}
    </div>
  );
}
