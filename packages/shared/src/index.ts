// Shared TypeScript types for @gambling/shared
// Only export interfaces/types — no runtime values in Phase 1

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

// Game types (stubs for future phases)
export type GameType = 'roulette' | 'plinko' | 'mines' | 'blackjack';

// Wallet / Game types (Phase 3+)
export interface BetRequest {
  betAmount: number;
  gameType?: string;
}

export interface BetResponse {
  outcome: 'win' | 'loss';
  profit: number;
  newBalance: number;
}
