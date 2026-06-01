import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AppShell } from '../components/vault/AppShell';
import { XIcon, ArrowRightIcon, PokerIcon } from '../components/vault/icons';
import { apiClient } from '../api/client';
import { usePokerStore } from '../stores/pokerStore';
import { POKER_STAKES, type PokerStakeId, type PokerTableSummary } from '@gambling/shared';

function CreateTableForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [name, setName] = useState('');
  const [stake, setStake] = useState<PokerStakeId>('micro');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [saving, setSaving] = useState(false);

  async function create() {
    const blinds = POKER_STAKES.find((s) => s.id === stake)!;
    setSaving(true);
    try {
      const res = await apiClient.post<{ id: number }>('/poker/tables', {
        name: name.trim() || `${blinds.label} Table`,
        type,
        smallBlind: blinds.smallBlind,
        bigBlind: blinds.bigBlind,
      });
      toast.success('Table created');
      onCreated(res.data.id);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      toast.error(ax.response?.data?.error ?? 'Could not create table');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pkr-create">
      <div className="pkr-create-head">
        <div>
          <span className="eyebrow">● New table</span>
          <h3>Spin up a table</h3>
        </div>
        <button className="pkr-modal-close" onClick={onClose} aria-label="Close"><XIcon size={14} /></button>
      </div>

      <div className="pkr-create-grid">
        <div className="pkr-create-field">
          <label className="label">Table name <span className="fg-dim">· optional</span></label>
          <input className="input" maxLength={50} placeholder="e.g. Friday Night" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="pkr-create-field">
          <label className="label">Visibility</label>
          <div className="pkr-toggle">
            <button className={type === 'public' ? 'active' : ''} onClick={() => setType('public')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
              Public
            </button>
            <button className={type === 'private' ? 'active' : ''} onClick={() => setType('private')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              Private
            </button>
          </div>
        </div>
      </div>

      <div className="pkr-create-field">
        <label className="label">Stakes</label>
        <div className="pkr-segmented">
          {POKER_STAKES.map((s) => (
            <button key={s.id} className={stake === s.id ? 'active' : ''} onClick={() => setStake(s.id)}>
              <span>{s.label}</span>
              <span className="small">{s.smallBlind} / {s.bigBlind}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pkr-create-foot">
        <span className="fg-mono fg-dim">6-max · buy-in 40–100× the big blind · sit, then tap empty seats to add bots</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving} onClick={create}>Create table</button>
        </div>
      </div>
    </div>
  );
}

// Aggregate seat fills (humans first, then bots) into 6 dots for the mini-felt.
// PokerTableSummary only carries counts, so this conveys occupancy, not exact seats.
function fillsFor(t: PokerTableSummary): [boolean, boolean][] {
  const out: [boolean, boolean][] = [];
  for (let i = 0; i < t.maxSeats; i++) {
    if (i < t.seatedHumans) out.push([true, false]);
    else if (i < t.seatedHumans + t.botCount) out.push([true, true]);
    else out.push([false, false]);
  }
  return out;
}

function MiniFelt({ fills }: { fills: [boolean, boolean][] }) {
  const pos = [
    { x: 50, y: 88 }, { x: 88, y: 70 }, { x: 88, y: 28 },
    { x: 50, y: 12 }, { x: 12, y: 28 }, { x: 12, y: 70 },
  ];
  return (
    <div className="pkr-tablecard-mini">
      {pos.map((p, i) => {
        const [f, bot] = fills[i] ?? [false, false];
        const cls = ['seat-dot', f ? (bot ? 'bot' : 'filled') : ''].filter(Boolean).join(' ');
        return <div key={i} className={cls} style={{ left: p.x + '%', top: p.y + '%' }} />;
      })}
    </div>
  );
}

function TableCard({ t, onJoin }: { t: PokerTableSummary; onJoin: () => void }) {
  const cta = t.iAmSeated ? 'Resume' : t.handInProgress ? 'Watch' : 'Sit';
  const players = t.seatedHumans + t.botCount;
  return (
    <button className={'pkr-tablecard' + (cta === 'Resume' ? ' resume' : '')} onClick={onJoin}>
      <div className="pkr-tablecard-top">
        <div>
          <div className="pkr-tablecard-name">{t.name}</div>
          <div className="pkr-tablecard-stakes">
            <span className="stake">{t.smallBlind}/{t.bigBlind}</span>
            <span className="sep">·</span>
            <span>buy-in {t.minBuyIn}–{t.maxBuyIn}</span>
          </div>
        </div>
        <span className={'pkr-tag ' + (cta === 'Resume' ? 'resume' : t.type === 'private' ? 'private' : 'public')}>
          {cta === 'Resume' ? 'Resume' : t.type === 'private' ? 'Private' : 'Public'}
        </span>
      </div>

      <MiniFelt fills={fillsFor(t)} />

      <div className="pkr-tablecard-foot">
        <div className="pkr-tablecard-players">
          <span><span className="num">{players}</span>/{t.maxSeats}</span>
          {t.botCount > 0 && <span className="bot">· {t.botCount} BOT</span>}
        </div>
        <span className="pkr-tablecard-cta">{cta} <ArrowRightIcon size={11} /></span>
      </div>
    </button>
  );
}

export function PokerLobbyPage() {
  const navigate = useNavigate();
  const lobby = usePokerStore((s) => s.lobby);
  const [creating, setCreating] = useState(false);

  function refresh() {
    apiClient.get<{ tables: PokerTableSummary[] }>('/poker/tables').then((r) => usePokerStore.getState().setLobby(r.data.tables)).catch(() => {});
  }

  // Owner closes their own (private) table from the lobby. Refunds every seated
  // player server-side and kicks anyone currently at it.
  async function closeTable(id: number, name: string) {
    if (!window.confirm(`Close “${name}”? Everyone seated is cashed out and refunded.`)) return;
    try {
      await apiClient.delete(`/poker/tables/${id}`);
      toast.success('Table closed');
      refresh();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      toast.error(ax.response?.data?.error ?? 'Could not close table');
    }
  }
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000); // light polling of the lobby
    return () => clearInterval(t);
  }, []);

  return (
    <AppShell>
      <div className="pkr-head">
        <div className="pkr-head-left">
          <div className="crumb"><span>HOME / POKER</span></div>
          <h1 className="h-title">Poker</h1>
          <p className="h-subtitle">No-Limit Texas Hold'em · play live against friends and bots · no rake</p>
        </div>
        <div className="pkr-head-right">
          <button className="btn btn-primary" onClick={() => setCreating((v) => !v)}><PokerIcon size={15} /> Create table</button>
        </div>
      </div>

      {creating && <CreateTableForm onClose={() => setCreating(false)} onCreated={(id) => navigate(`/games/poker/${id}`)} />}

      <div className="fg-sub-head"><span className="section-title">Tables · {lobby.length}</span><span className="fg-mono fg-dim">tap to sit</span></div>
      {lobby.length === 0 ? (
        <div className="pkr-lobby-empty">
          <div className="mark">♠</div>
          <h4 style={{ fontSize: 18, fontWeight: 600 }}>No tables yet</h4>
          <p style={{ color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto 10px' }}>Create one, set a couple of bots to fill seats, and start playing.</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>Create the first table</button>
        </div>
      ) : (
        <div className="pkr-lobby-grid">
          {lobby.map((t) => (
            <div key={t.id} className="pkr-tablecard-wrap">
              <TableCard t={t} onJoin={() => navigate(`/games/poker/${t.id}`)} />
              {t.isOwner && (
                <button
                  className="pkr-tablecard-del"
                  title="Close table"
                  aria-label={`Close ${t.name}`}
                  onClick={() => closeTable(t.id, t.name)}
                >
                  <XIcon size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
