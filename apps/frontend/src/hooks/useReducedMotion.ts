import { useEffect, useState } from 'react';
import { useMotionStore } from '../stores/motionStore';

const QUERY = '(prefers-reduced-motion: reduce)';

function systemReduced(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

// Resolve the in-app override against the OS setting. An explicit 'on'/'off' wins;
// 'system' (the default) follows the OS reduce-motion preference.
function resolve(pref: 'system' | 'on' | 'off'): boolean {
  if (pref === 'on') return false; // user forced animations on
  if (pref === 'off') return true; // user forced reduced motion
  return systemReduced();
}

/** True when motion should be reduced: an in-app override, else the OS setting.
 *  Components should reduce (shorten/skip decorative) animation rather than
 *  remove functional motion. */
export function useReducedMotion(): boolean {
  const pref = useMotionStore((s) => s.pref);
  const [sysReduced, setSysReduced] = useState(systemReduced);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setSysReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (pref === 'on') return false;
  if (pref === 'off') return true;
  return sysReduced;
}

/** Non-hook read, for use inside imperative GSAP/confetti helpers and at render
 *  time. Reads the override straight from the store (works outside React). */
export function prefersReducedMotion(): boolean {
  return resolve(useMotionStore.getState().pref);
}
