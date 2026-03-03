import { Header } from '../components/Header';

// Placeholder — full implementation in 04-03-PLAN.md
export function RoulettePage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d0d1a', color: '#ffffff' }}>
      <Header />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ color: '#e0d7ff' }}>Roulette</h1>
        <p style={{ color: '#718096' }}>Loading game…</p>
      </main>
    </div>
  );
}
