import { useEffect, useState, type ReactNode } from 'react';
import { AppShell } from '../components/vault/AppShell';
import { CoinIcon, ProfileIcon, ZapIcon, SearchIcon, gameIcons } from '../components/vault/icons';
import { apiClient } from '../api/client';

interface StatsResponse {
  totalUsers: number;
  totalBets: number;
  coinsInCirculation: number;
  mostActiveUsers: { userId: number; username: string; bets: number }[];
}

interface Player {
  id: number;
  username: string;
  email: string;
  balance: number;
  totalWagered: number;
  role: string;
  isBanned: boolean;
  createdAt: string;
}

interface HistoryRound {
  id: number;
  gameType: string;
  betAmount: number;
  outcome: string;
  profit: number;
  createdAt: string;
}

interface PokerTableRow {
  id: number;
  name: string;
  type: 'public' | 'private';
  smallBlind: number;
  bigBlind: number;
  maxSeats: number;
  seatedHumans: number;
  botCount: number;
  handInProgress: boolean;
  ownerName: string | null;
  createdAt: string;
}

const GAME_LABEL: Record<string, string> = { roulette: 'Roulette', plinko: 'Plinko', mines: 'Mines', blackjack: 'Blackjack' };
const GAME_COLOR: Record<string, string> = { roulette: 'var(--accent)', plinko: 'var(--blue)', mines: 'var(--loss)', blackjack: 'var(--purple)' };

function initial(name: string): string {
  return name.charAt(0).toUpperCase() || '?';
}

// Prettify raw outcome strings (e.g. "player_blackjack" → "Player blackjack",
// "bucket_5" → "Bucket 5").
function prettyOutcome(outcome: string): string {
  const cleaned = outcome.replace(/_/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

const ShieldIcon = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

function StatCard({ label, value, valSmall, sub, chipBg, chipFg, chip }: {
  label: string; value: string; valSmall?: string; sub?: string;
  chipBg: string; chipFg: string; chip: ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="head">
        <span className="lab">{label}</span>
        <span className="chip" style={{ background: chipBg, color: chipFg }}>{chip}</span>
      </div>
      <div className="val">{value}{valSmall && <small>{valSmall}</small>}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function AdminPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerHistory, setPlayerHistory] = useState<HistoryRound[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: 'win' | 'loss' } | null>(null);
  const [grantAmount, setGrantAmount] = useState('');
  const [isGranting, setIsGranting] = useState(false);
  const [pokerTables, setPokerTables] = useState<PokerTableRow[]>([]);

  useEffect(() => {
    apiClient
      .get<StatsResponse>('/admin/stats')
      .then(res => setStats(res.data))
      .catch(() => {});
    refreshPokerTables();
  }, []);

  function refreshPokerTables() {
    apiClient
      .get<{ tables: PokerTableRow[] }>('/admin/poker/tables')
      .then(res => setPokerTables(res.data.tables))
      .catch(() => {});
  }

  async function handleDeletePokerTable(table: PokerTableRow) {
    if (!window.confirm(`Delete poker table “${table.name}”? Any seated players are refunded and kicked.`)) return;
    try {
      const res = await apiClient.delete<{ ok: boolean; refunded: number; chips: number }>('/admin/poker/tables/' + table.id);
      setPokerTables(prev => prev.filter(t => t.id !== table.id));
      showToast(
        res.data.refunded > 0
          ? `Closed “${table.name}” — refunded ${res.data.chips.toLocaleString()} coins to ${res.data.refunded} player${res.data.refunded === 1 ? '' : 's'}.`
          : `Closed “${table.name}”.`,
        'win',
      );
    } catch {
      showToast('Could not delete that table. Please try again.', 'loss');
    }
  }

  function showToast(msg: string, kind: 'win' | 'loss') {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    apiClient
      .get<{ players: Player[] }>('/admin/players?q=' + encodeURIComponent(searchQuery))
      .then(res => setSearchResults(res.data.players))
      .catch(() => setSearchResults([]))
      .finally(() => setHasSearched(true));
  }

  function handleSelectPlayer(player: Player) {
    setSelectedPlayer(player);
    setIsLoadingHistory(true);
    apiClient
      .get<{ history: HistoryRound[] }>('/admin/players/' + player.id + '/history')
      .then(res => {
        setPlayerHistory(res.data.history);
      })
      .catch(() => {
        setPlayerHistory([]);
      })
      .finally(() => setIsLoadingHistory(false));
  }

  async function handleBanToggle(player: Player) {
    const endpoint = '/admin/players/' + player.id + (player.isBanned ? '/unban' : '/ban');
    try {
      await apiClient.post(endpoint);
      setSearchResults(prev =>
        prev.map(p => (p.id === player.id ? { ...p, isBanned: !p.isBanned } : p))
      );
      if (selectedPlayer?.id === player.id) {
        setSelectedPlayer(prev => prev ? { ...prev, isBanned: !prev.isBanned } : prev);
      }
      showToast(
        player.isBanned ? `${player.username} has been unbanned.` : `${player.username} has been banned.`,
        player.isBanned ? 'win' : 'loss'
      );
    } catch {
      showToast('Action failed. Please try again.', 'loss');
    }
  }

  // Add (sign +1) or claw back (sign −1) coins for the selected player. The
  // amount field holds an unsigned magnitude; the sign comes from which button
  // was pressed. Mirrors the backend cap (|amount| ≤ 1,000,000) so the user gets
  // an inline message instead of a 400.
  async function handleGrant(sign: 1 | -1) {
    if (!selectedPlayer || isGranting) return;
    const magnitude = Math.floor(Number(grantAmount));
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      showToast('Enter a positive whole number of coins.', 'loss');
      return;
    }
    if (magnitude > 1_000_000) {
      showToast('Amount must be 1,000,000 or less.', 'loss');
      return;
    }
    const amount = sign * magnitude;
    setIsGranting(true);
    try {
      const res = await apiClient.post<{ ok: boolean; newBalance: number }>(
        '/admin/players/' + selectedPlayer.id + '/grant',
        { amount },
      );
      const newBalance = res.data.newBalance;
      setSelectedPlayer(prev => (prev ? { ...prev, balance: newBalance } : prev));
      setSearchResults(prev => prev.map(p => (p.id === selectedPlayer.id ? { ...p, balance: newBalance } : p)));
      showToast(
        `${sign > 0 ? 'Added' : 'Removed'} ${magnitude.toLocaleString()} coins ${sign > 0 ? 'to' : 'from'} ${selectedPlayer.username} — new balance ${newBalance.toLocaleString()}.`,
        sign > 0 ? 'win' : 'loss',
      );
      setGrantAmount('');
    } catch {
      showToast('Balance update failed. Please try again.', 'loss');
    } finally {
      setIsGranting(false);
    }
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="lb-head">
        <div className="lb-title">
          <ShieldIcon size={32} />
          <div>
            <div className="crumb"><span>HOME</span><span className="crumb-sep">/</span><span>ADMIN</span></div>
            <h1 className="h-title">Admin Console</h1>
          </div>
          <span className="tag accent">STAFF</span>
        </div>
      </div>

      {/* Platform metrics */}
      <div className="acc-stat-grid admin-stats">
        <StatCard
          label="TOTAL USERS"
          value={stats ? stats.totalUsers.toLocaleString() : '—'}
          chipBg="rgba(91,141,239,0.18)" chipFg="var(--blue)" chip={<ProfileIcon size={14} />}
          sub="registered accounts"
        />
        <StatCard
          label="TOTAL BETS"
          value={stats ? stats.totalBets.toLocaleString() : '—'}
          chipBg="var(--accent-soft)" chipFg="var(--accent)" chip={<ZapIcon size={13} />}
          sub="rounds settled"
        />
        <StatCard
          label="COINS IN CIRCULATION"
          value={stats ? stats.coinsInCirculation.toLocaleString() : '—'}
          valSmall=" coins"
          chipBg="var(--gold-soft)" chipFg="var(--gold)" chip={<CoinIcon size={14} />}
          sub="across all balances"
        />
      </div>

      {/* Player search */}
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head">
          <h3>Player Search</h3>
          {hasSearched && (
            <span className="net" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {searchResults.length} {searchResults.length === 1 ? 'RESULT' : 'RESULTS'}
            </span>
          )}
        </div>

        <form className="admin-search" onSubmit={handleSearch}>
          <input
            className="input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by username…"
          />
          <button type="submit" className="btn btn-primary">
            <SearchIcon size={15} /> Search
          </button>
        </form>

        {hasSearched && searchResults.length === 0 ? (
          <div className="lb-empty">No players match “{searchQuery}”.</div>
        ) : searchResults.length > 0 ? (
          <div className="table-scroll" style={{ marginTop: 16 }}>
          <table className="act-table admin-table">
            <thead>
              <tr>
                <th>Player</th>
                <th className="r">Balance</th>
                <th className="r">Wagered</th>
                <th>Status</th>
                <th className="r">Action</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map(player => (
                <tr
                  key={player.id}
                  className={selectedPlayer?.id === player.id ? 'sel' : ''}
                  onClick={() => handleSelectPlayer(player)}
                >
                  <td>
                    <div className="gcell">
                      <span className="avatar">{initial(player.username)}</span>
                      <div>
                        <div className="gname">{player.username}</div>
                        <div className="gtype">{player.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="res">{player.balance.toLocaleString()}<small> coins</small></td>
                  <td className="mult" style={{ color: 'var(--text-secondary)' }}>{player.totalWagered.toLocaleString()}</td>
                  <td>
                    <div className="tags">
                      {player.role === 'admin' && <span className="tag gold">ADMIN</span>}
                      <span className={'tag ' + (player.isBanned ? 'loss' : 'accent')}>
                        {player.isBanned ? 'BANNED' : 'ACTIVE'}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className={'admin-btn ' + (player.isBanned ? 'unban' : 'ban')}
                      onClick={e => {
                        e.stopPropagation();
                        void handleBanToggle(player);
                      }}
                    >
                      {player.isBanned ? 'Unban' : 'Ban'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : null}
      </div>

      {/* Poker tables — janitor for orphaned/abandoned tables. Deleting refunds
          every seated player and kicks the room. */}
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head">
          <h3>Poker Tables</h3>
          <span className="net" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {pokerTables.length} {pokerTables.length === 1 ? 'TABLE' : 'TABLES'}
          </span>
        </div>
        {pokerTables.length === 0 ? (
          <div className="lb-empty">No poker tables exist right now.</div>
        ) : (
          <div className="table-scroll" style={{ marginTop: 16 }}>
            <table className="act-table admin-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Owner</th>
                  <th className="r">Stakes</th>
                  <th className="r">Seated</th>
                  <th>Status</th>
                  <th className="r">Action</th>
                </tr>
              </thead>
              <tbody>
                {pokerTables.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div className="gcell">
                        <span className="avatar">{initial(t.name)}</span>
                        <div>
                          <div className="gname">{t.name}</div>
                          <div className="gtype">TABLE #{String(t.id).padStart(4, '0')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="desc">{t.ownerName ?? '—'}</td>
                    <td className="mult" style={{ color: 'var(--text-secondary)' }}>{t.smallBlind}/{t.bigBlind}</td>
                    <td className="res">{t.seatedHumans}{t.botCount > 0 && <small> +{t.botCount} bot</small>}</td>
                    <td>
                      <div className="tags">
                        <span className={'tag ' + (t.type === 'private' ? 'gold' : 'accent')}>{t.type === 'private' ? 'PRIVATE' : 'PUBLIC'}</span>
                        {t.handInProgress && <span className="tag muted">LIVE</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="admin-btn ban" onClick={() => void handleDeletePokerTable(t)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Player inspector — shown when a player is selected */}
      {selectedPlayer && (
        <>
        {/* Balance adjustment — production-safe replacement for the dev console
            cheat. Add or claw back coins; every action is audit-logged server-side. */}
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3>Adjust Balance</h3>
              <span className="tag muted">{selectedPlayer.username.toUpperCase()}</span>
            </div>
            <span className="net">{selectedPlayer.balance.toLocaleString()} coins</span>
          </div>
          <form className="admin-search" onSubmit={e => e.preventDefault()}>
            <input
              className="input"
              type="number"
              min={1}
              max={1000000}
              step={1}
              value={grantAmount}
              onChange={e => setGrantAmount(e.target.value)}
              placeholder="Amount of coins…"
            />
            <button type="button" className="btn btn-primary" disabled={isGranting} onClick={() => void handleGrant(1)}>
              <CoinIcon size={15} /> Add
            </button>
            <button type="button" className="admin-btn ban" disabled={isGranting} onClick={() => void handleGrant(-1)}>
              Remove
            </button>
          </form>
          <div className="sub" style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: 12 }}>
            Adds to or claws back from the player's balance. Max 1,000,000 per action; logged to the admin audit trail.
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3>Game History</h3>
              <span className="tag muted">{selectedPlayer.username.toUpperCase()}</span>
            </div>
          </div>

          {isLoadingHistory ? (
            <div className="lb-empty">Loading…</div>
          ) : playerHistory.length === 0 ? (
            <div className="lb-empty">No rounds played yet.</div>
          ) : (
            <>
              <div className="table-scroll">
              <table className="act-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Outcome</th>
                    <th className="r">Bet</th>
                    <th className="r">Time</th>
                    <th className="r">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {playerHistory.map(round => {
                    const Ico = gameIcons[round.gameType];
                    const color = GAME_COLOR[round.gameType] ?? 'var(--accent)';
                    const pos = round.profit >= 0;
                    return (
                      <tr key={round.id}>
                        <td>
                          <div className="gcell">
                            <span className="gicon" style={{ color }}>{Ico && <Ico size={14} />}</span>
                            <div>
                              <div className="gname">{GAME_LABEL[round.gameType] ?? round.gameType}</div>
                              <div className="gtype">ROUND #{String(round.id).padStart(4, '0')}</div>
                            </div>
                          </div>
                        </td>
                        <td className="desc">{prettyOutcome(round.outcome)}</td>
                        <td className="mult" style={{ color: 'var(--text-secondary)' }}>{round.betAmount.toLocaleString()}</td>
                        <td className="time">{new Date(round.createdAt).toLocaleString()}</td>
                        <td className={'res ' + (pos ? 'win' : 'loss')}>
                          {pos ? '+' : '−'}{Math.abs(round.profit).toLocaleString()}<small> coins</small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              <div className="act-foot">
                <span>SHOWING {playerHistory.length} {playerHistory.length === 1 ? 'ROUND' : 'ROUNDS'}</span>
              </div>
            </>
          )}
        </div>
        </>
      )}

      {toast && (
        <div className={'notice admin-toast ' + toast.kind}>{toast.msg}</div>
      )}
    </AppShell>
  );
}
