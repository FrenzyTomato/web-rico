import { useEffect, useRef } from 'react';

/** One quiet cue per transition into actionable play; browser interaction unlocks audio. */
export function useTurnChime(yourTurn: boolean, connected: boolean, enabled: boolean) {
  const previous = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    const unlock = () => {
      if (!enabled || typeof AudioContext === 'undefined') return;
      try {
        audio.current ??= new AudioContext();
        if (audio.current.state === 'suspended') void audio.current.resume().catch(() => {});
      } catch { /* Audio is optional. */ }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      const context = audio.current;
      audio.current = null;
      if (context) void context.close().catch(() => {});
    };
  }, [enabled]);
  useEffect(() => {
    const starts = yourTurn && !previous.current;
    previous.current = yourTurn;
    const context = audio.current;
    if (!starts || !connected || !enabled || context?.state !== 'running') return;
    try {
      for (const [offset, frequency] of [[0, 523.25], [0.12, 659.25]]) {
        const start = context.currentTime + offset!;
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency!;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.035, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start); oscillator.stop(start + 0.27);
      }
    } catch { /* Never interrupt a turn if audio is unavailable. */ }
  }, [yourTurn, connected, enabled]);
}
