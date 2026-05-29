// A single shared AudioContext for these procedural game blips (used by Plinko
// and Mines). The previous version created `new AudioContext()` on every tone —
// i.e. every win/loss. Browsers cap the number of live AudioContexts (~6 in
// Chrome); once exceeded, construction throws and every subsequent game sound
// silently dies. That's why the sounds cut out after a handful of rapid drops.
// Reusing one context fixes it; the per-tone oscillator/gain nodes are cheap and
// disconnect themselves when they finish.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  // The first sound fires from a user gesture; resume if the browser suspended it.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function useGameSounds(isMuted: boolean) {
  const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (isMuted) return;
    const audio = getCtx();
    if (!audio) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.type = type;
    osc.frequency.value = frequency;
    const now = audio.currentTime;
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  };

  return {
    playWin: () => playTone(880, 0.4, 'sine'),
    playLoss: () => playTone(180, 0.5, 'triangle'),
  };
}
