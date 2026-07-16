import { useCallback, useEffect, useRef } from 'react';

import { DEFAULT_VMIX_PORT, sendVmixFunction } from '../../common/utils/vmix';

/** how often a held button seeks. Often enough to look continuous, rarely enough not to flood vMix */
const SCRUB_TICK_MS = 100;
/** half a second of media for every second the button is held */
const SCRUB_RATE = 0.5;

export interface Scrub {
  /** starts moving the playhead, direction -1 rewinds and 1 fast forwards */
  start: (direction: -1 | 1) => void;
  /** stops on release */
  stop: () => void;
}

/**
 * Hold to scrub. vMix has no rewind function, only SetPosition, so a held button
 * walks the playhead by repeatedly seeking.
 *
 * The target is derived from how long the button has actually been held rather than
 * accumulated per tick, so a slow or drifting timer cannot change the scrub speed.
 */
export function useScrub(host: string | null, input: string | null, position: number, duration: number): Scrub {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionRef = useRef(position);

  // follow vMix whenever we are not actively scrubbing
  useEffect(() => {
    if (timerRef.current === null) {
      positionRef.current = position;
    }
  }, [position]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (direction: -1 | 1) => {
      if (!host || !input || duration <= 0) return;
      stop();

      const base = positionRef.current;
      const heldSince = performance.now();

      timerRef.current = setInterval(() => {
        const held = performance.now() - heldSince;
        const next = Math.min(Math.max(base + direction * held * SCRUB_RATE, 0), duration);
        positionRef.current = next;
        sendVmixFunction(host, DEFAULT_VMIX_PORT, 'SetPosition', { Input: input, Value: Math.round(next) });

        // parked at either end, no point hammering vMix
        if (next === 0 || next === duration) stop();
      }, SCRUB_TICK_MS);
    },
    [host, input, duration, stop],
  );

  // a button held while the page unmounts would leave the timer running
  useEffect(() => stop, [stop]);

  return { start, stop };
}
