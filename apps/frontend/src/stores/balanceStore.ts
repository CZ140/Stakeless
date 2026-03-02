import { create } from 'zustand';

interface BalanceState {
  balance: number | null;
  setBalance: (n: number) => void;
  clearBalance: () => void;
}

export const useBalanceStore = create<BalanceState>()((set) => ({
  balance: null,
  setBalance: (n) => set({ balance: n }),
  clearBalance: () => set({ balance: null }),
}));
