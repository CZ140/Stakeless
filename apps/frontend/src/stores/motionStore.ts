import { create } from 'zustand';

// Global animation preference, shared by every game via prefersReducedMotion().
// Three states:
//   'system' — follow the OS "reduce motion" accessibility setting (default)
//   'on'     — force full animations even if the OS asks to reduce motion
//   'off'    — force reduced motion regardless of the OS
// An explicit 'on'/'off' override lets a user opt back into animations when their
// machine has reduce-motion enabled (the common cause of "animations don't play
// on my friend's computer"). Persisted to localStorage; 'system' is the absence
// of a stored override.

export type MotionPref = 'system' | 'on' | 'off';

const KEY = 'stakeless.motion.pref';

function load(): MotionPref {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  return v === 'on' || v === 'off' ? v : 'system';
}

interface MotionState {
  pref: MotionPref;
  setPref: (p: MotionPref) => void;
}

export const useMotionStore = create<MotionState>()((set) => ({
  pref: load(),
  setPref: (pref) => {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
    set({ pref });
  },
}));
