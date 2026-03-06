import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        backgroundColor: '#1a1a2e',
        padding: '1.5rem',
        borderRadius: '8px',
        border: '1px solid #2a2a4a',
      }}
    >
      <div style={{ color: '#a0a0c0', fontSize: '0.85rem' }}>{label}</div>
      <div
        style={{
          color: '#e0d7ff',
          fontSize: '2rem',
          fontWeight: 700,
          marginTop: '0.5rem',
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function AdminPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerHistory, setPlayerHistory] = useState<HistoryRound[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [actionStatus, setActionStatus] = useState('');

  useEffect(() => {
    apiClient
      .get<StatsResponse>('/admin/stats')
      .then(res => setStats(res.data))
      .catch(() => {});
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    apiClient
      .get<{ players: Player[] }>('/admin/players?q=' + encodeURIComponent(searchQuery))
      .then(res => setSearchResults(res.data.players))
      .catch(() => {});
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
      setActionStatus(
        player.isBanned
          ? `${player.username} has been unbanned.`
          : `${player.username} has been banned.`
      );
      setTimeout(() => setActionStatus(''), 3000);
    } catch {
      setActionStatus('Action failed. Please try again.');
      setTimeout(() => setActionStatus(''), 3000);
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f1a' }}>
      <Header />
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>
        <h1 style={{ color: '#e0d7ff', marginBottom: '2rem' }}>Admin Dashboard</h1>

        {/* Stat cards row */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <StatCard label="Total Users" value={stats ? stats.totalUsers.toLocaleString() : '—'} />
          <StatCard label="Total Bets" value={stats ? stats.totalBets.toLocaleString() : '—'} />
          <StatCard
            label="Coins in Circulation"
            value={stats ? stats.coinsInCirculation.toLocaleString() : '—'}
          />
        </section>

        {/* Player search */}
        <section
          style={{
            backgroundColor: '#1a1a2e',
            padding: '1.5rem',
            borderRadius: '8px',
            marginBottom: '2rem',
          }}
        >
          <h2 style={{ color: '#e0d7ff', marginBottom: '1rem' }}>Player Search</h2>
          <form onSubmit={handleSearch}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by username..."
              style={{
                backgroundColor: '#0f0f1a',
                border: '1px solid #2a2a4a',
                color: '#c0b8e0',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                width: '300px',
                marginRight: '1rem',
              }}
            />
            <button
              type="submit"
              style={{
                backgroundColor: '#7c3aed',
                color: '#fff',
                border: 'none',
                padding: '0.5rem 1.5rem',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Search
            </button>
          </form>
          {searchResults.length > 0 && (
            <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a4a' }}>
                  <th style={{ color: '#a0a0c0', textAlign: 'left', padding: '0.5rem' }}>
                    Username
                  </th>
                  <th style={{ color: '#a0a0c0', textAlign: 'left', padding: '0.5rem' }}>
                    Email
                  </th>
                  <th style={{ color: '#a0a0c0', textAlign: 'right', padding: '0.5rem' }}>
                    Balance
                  </th>
                  <th style={{ color: '#a0a0c0', textAlign: 'left', padding: '0.5rem' }}>
                    Status
                  </th>
                  <th style={{ color: '#a0a0c0', textAlign: 'left', padding: '0.5rem' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map(player => (
                  <tr
                    key={player.id}
                    style={{ borderBottom: '1px solid #2a2a4a', cursor: 'pointer' }}
                    onClick={() => handleSelectPlayer(player)}
                  >
                    <td style={{ padding: '0.5rem', color: '#c0b8e0' }}>{player.username}</td>
                    <td style={{ padding: '0.5rem', color: '#a0a0c0' }}>{player.email}</td>
                    <td style={{ padding: '0.5rem', color: '#c0b8e0', textAlign: 'right' }}>
                      {player.balance.toLocaleString()}
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <span
                        style={{
                          color: player.isBanned ? '#f87171' : '#4ade80',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                        }}
                      >
                        {player.isBanned ? 'Banned' : 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          void handleBanToggle(player);
                        }}
                        style={{
                          backgroundColor: player.isBanned ? '#4ade80' : '#ef4444',
                          color: '#fff',
                          border: 'none',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        {player.isBanned ? 'Unban' : 'Ban'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Player inspector — shown when a player is selected */}
        {selectedPlayer && (
          <section
            style={{ backgroundColor: '#1a1a2e', padding: '1.5rem', borderRadius: '8px' }}
          >
            <h2 style={{ color: '#e0d7ff', marginBottom: '1rem' }}>
              Game History — {selectedPlayer.username}
            </h2>
            {isLoadingHistory ? (
              <p style={{ color: '#a0a0c0' }}>Loading...</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a4a' }}>
                    <th style={{ color: '#a0a0c0', textAlign: 'left', padding: '0.5rem' }}>
                      Time
                    </th>
                    <th style={{ color: '#a0a0c0', textAlign: 'left', padding: '0.5rem' }}>
                      Game
                    </th>
                    <th style={{ color: '#a0a0c0', textAlign: 'right', padding: '0.5rem' }}>
                      Bet
                    </th>
                    <th style={{ color: '#a0a0c0', textAlign: 'left', padding: '0.5rem' }}>
                      Outcome
                    </th>
                    <th style={{ color: '#a0a0c0', textAlign: 'right', padding: '0.5rem' }}>
                      Profit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {playerHistory.map(round => (
                    <tr key={round.id} style={{ borderBottom: '1px solid #2a2a4a' }}>
                      <td style={{ padding: '0.5rem', color: '#a0a0c0', fontSize: '0.85rem' }}>
                        {new Date(round.createdAt).toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: '0.5rem',
                          color: '#c0b8e0',
                          textTransform: 'capitalize',
                        }}
                      >
                        {round.gameType}
                      </td>
                      <td style={{ padding: '0.5rem', color: '#c0b8e0', textAlign: 'right' }}>
                        {round.betAmount.toLocaleString()}
                      </td>
                      <td style={{ padding: '0.5rem', color: '#a0a0c0' }}>{round.outcome}</td>
                      <td
                        style={{
                          padding: '0.5rem',
                          textAlign: 'right',
                          color: round.profit >= 0 ? '#4ade80' : '#f87171',
                        }}
                      >
                        {round.profit >= 0 ? '+' : ''}
                        {round.profit.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {actionStatus && (
          <p style={{ marginTop: '1rem', color: '#4ade80' }}>{actionStatus}</p>
        )}
      </main>
    </div>
  );
}
