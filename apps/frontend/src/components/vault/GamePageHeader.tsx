import { Fragment, type ReactNode } from 'react';

// The shared breadcrumb + title + meta-spec + error block that every game page
// repeated verbatim. `specs` are the dot-separated items shown next to the title
// (e.g. odds, multiplier); `onHowTo`, when given, renders the ghost "How to play"
// button before the mute toggle.
interface GamePageHeaderProps {
  crumb: string; // last breadcrumb label, e.g. "DICE"
  title: ReactNode;
  specs: ReactNode[];
  muted: boolean;
  onToggleMute: () => void;
  error?: string | null;
  onHowTo?: () => void;
}

export function GamePageHeader({ crumb, title, specs, muted, onToggleMute, error, onHowTo }: GamePageHeaderProps) {
  return (
    <>
      <div className="crumb">
        <span>HOME</span><span className="crumb-sep">/</span><span>GAMES</span>
        <span className="crumb-sep">/</span><span style={{ color: 'var(--text-secondary)' }}>{crumb}</span>
      </div>
      <div className="game-page-head">
        <h1 className="h-title">{title}</h1>
        <div className="game-meta-spec">
          {specs.map((s, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="dot">·</span>}
              <span>{s}</span>
            </Fragment>
          ))}
          {onHowTo && (
            <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} onClick={onHowTo}>How to play</button>
          )}
          <button className="icon-btn" onClick={onToggleMute} title={muted ? 'Unmute' : 'Mute'} style={{ fontSize: 14 }}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>
      {error && <div className="notice loss" role="alert" style={{ marginBottom: 16, textAlign: 'left' }}>{error}</div>}
    </>
  );
}
