/**
 * Pro League replay clock hook — sprint 1.G.2.
 *
 * State machine cote browser pour piloter un replay deja entierement
 * charge en memoire (via `GET /pro-league/matches/:id/replay`, lot
 * 1.G.1). Le hook tient `currentMs` et l'avance en temps reel selon
 * `playbackSpeed`. Auto-stop a `durationMs`.
 *
 * Pure-ish : `tickFn` (default `requestAnimationFrame`) injectable pour
 * tests deterministes.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type PlaybackSpeed = 0.5 | 1 | 2 | 4 | 8;
export const PLAYBACK_SPEEDS: readonly PlaybackSpeed[] = [0.5, 1, 2, 4, 8];

export interface ReplayClockState {
  readonly currentMs: number;
  readonly playing: boolean;
  readonly playbackSpeed: PlaybackSpeed;
  readonly durationMs: number;
}

export interface ReplayClockControls {
  readonly play: () => void;
  readonly pause: () => void;
  readonly toggle: () => void;
  readonly seek: (ms: number) => void;
  readonly setSpeed: (s: PlaybackSpeed) => void;
  readonly skipToEnd: () => void;
  readonly restart: () => void;
}

export interface UseReplayClockOptions {
  readonly durationMs: number;
  /** Initial currentMs (default 0). */
  readonly initialMs?: number;
  /** Initial playback speed (default 1×). */
  readonly initialSpeed?: PlaybackSpeed;
  /**
   * Override frame scheduler. Production : `requestAnimationFrame`.
   * Tests injectent un `setTimeout`-based driver pour avancer
   * deterministiquement.
   */
  readonly scheduleTick?: (fn: () => void) => () => void;
}

const DEFAULT_TICK_INTERVAL_MS = 100;

function defaultScheduleTick(fn: () => void): () => void {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    let raf = window.requestAnimationFrame(function loop() {
      fn();
      raf = window.requestAnimationFrame(loop);
    });
    return () => window.cancelAnimationFrame(raf);
  }
  const id = setInterval(fn, DEFAULT_TICK_INTERVAL_MS);
  return () => clearInterval(id);
}

export function useReplayClock(
  opts: UseReplayClockOptions,
): ReplayClockState & ReplayClockControls {
  const durationMs = Math.max(0, opts.durationMs);
  const [currentMs, setCurrentMs] = useState<number>(
    Math.min(durationMs, Math.max(0, opts.initialMs ?? 0)),
  );
  const [playing, setPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(
    opts.initialSpeed ?? 1,
  );

  const lastWallMsRef = useRef<number | null>(null);
  const scheduleTick = opts.scheduleTick ?? defaultScheduleTick;

  // Tick loop : avance currentMs tant que playing=true.
  useEffect(() => {
    if (!playing) {
      lastWallMsRef.current = null;
      return undefined;
    }
    lastWallMsRef.current = Date.now();
    const cancel = scheduleTick(() => {
      const now = Date.now();
      const last = lastWallMsRef.current ?? now;
      const wallDelta = Math.max(0, now - last);
      lastWallMsRef.current = now;
      setCurrentMs((prev) => {
        const next = prev + wallDelta * playbackSpeed;
        if (next >= durationMs) {
          // Atteint la fin : pause auto + clamp.
          setPlaying(false);
          return durationMs;
        }
        return next;
      });
    });
    return cancel;
  }, [playing, playbackSpeed, durationMs, scheduleTick]);

  const play = useCallback(() => {
    setPlaying((p) => {
      // Si on relance depuis la fin, on revient au debut.
      if (!p) {
        setCurrentMs((c) => (c >= durationMs ? 0 : c));
      }
      return true;
    });
  }, [durationMs]);

  const pause = useCallback(() => setPlaying(false), []);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p) {
        setCurrentMs((c) => (c >= durationMs ? 0 : c));
      }
      return !p;
    });
  }, [durationMs]);

  const seek = useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(durationMs, ms));
      setCurrentMs(clamped);
    },
    [durationMs],
  );

  const setSpeed = useCallback((s: PlaybackSpeed) => setPlaybackSpeed(s), []);

  const skipToEnd = useCallback(() => {
    setPlaying(false);
    setCurrentMs(durationMs);
  }, [durationMs]);

  const restart = useCallback(() => {
    setCurrentMs(0);
    setPlaying(true);
  }, []);

  return {
    currentMs,
    playing,
    playbackSpeed,
    durationMs,
    play,
    pause,
    toggle,
    seek,
    setSpeed,
    skipToEnd,
    restart,
  };
}

/** Format `currentMs` en `MM:SS`. */
export function formatReplayClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
