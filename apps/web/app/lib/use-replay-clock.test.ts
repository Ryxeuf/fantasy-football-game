/**
 * Sprint 1.G.2 — Tests `useReplayClock` (pure browser clock pour replay).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import {
  PLAYBACK_SPEEDS,
  formatReplayClock,
  useReplayClock,
} from "./use-replay-clock";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-07T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Crée un schedule-tick contrôlable manuellement par les tests :
 * `controller.tick()` invoque la callback enregistrée par le hook.
 */
function makeController() {
  const fns = new Set<() => void>();
  const scheduleTick = (fn: () => void): (() => void) => {
    fns.add(fn);
    return () => fns.delete(fn);
  };
  const tick = (): void => {
    for (const fn of fns) fn();
  };
  return { scheduleTick, tick };
}

describe("useReplayClock — sprint 1.G.2", () => {
  it("initialise sur currentMs=0, paused, vitesse 1×", () => {
    const ctrl = makeController();
    const { result } = renderHook(() =>
      useReplayClock({ durationMs: 100_000, scheduleTick: ctrl.scheduleTick }),
    );
    expect(result.current.currentMs).toBe(0);
    expect(result.current.playing).toBe(false);
    expect(result.current.playbackSpeed).toBe(1);
    expect(result.current.durationMs).toBe(100_000);
  });

  it("respecte initialMs et initialSpeed", () => {
    const ctrl = makeController();
    const { result } = renderHook(() =>
      useReplayClock({
        durationMs: 100_000,
        initialMs: 30_000,
        initialSpeed: 2,
        scheduleTick: ctrl.scheduleTick,
      }),
    );
    expect(result.current.currentMs).toBe(30_000);
    expect(result.current.playbackSpeed).toBe(2);
  });

  it("clamp initialMs au range [0, durationMs]", () => {
    const ctrl = makeController();
    const { result: a } = renderHook(() =>
      useReplayClock({
        durationMs: 100_000,
        initialMs: -50,
        scheduleTick: ctrl.scheduleTick,
      }),
    );
    expect(a.current.currentMs).toBe(0);

    const { result: b } = renderHook(() =>
      useReplayClock({
        durationMs: 100_000,
        initialMs: 999_999,
        scheduleTick: ctrl.scheduleTick,
      }),
    );
    expect(b.current.currentMs).toBe(100_000);
  });

  it("play() declenche playing=true et avance currentMs sur tick", () => {
    const ctrl = makeController();
    const { result } = renderHook(() =>
      useReplayClock({
        durationMs: 100_000,
        scheduleTick: ctrl.scheduleTick,
      }),
    );
    act(() => {
      result.current.play();
    });
    expect(result.current.playing).toBe(true);

    // Avance la wall clock de 1s puis tick.
    act(() => {
      vi.advanceTimersByTime(1000);
      ctrl.tick();
    });
    expect(result.current.currentMs).toBeGreaterThanOrEqual(900);
    expect(result.current.currentMs).toBeLessThanOrEqual(1100);
  });

  it("playbackSpeed multiplie la progression", () => {
    const ctrl = makeController();
    const { result } = renderHook(() =>
      useReplayClock({
        durationMs: 100_000,
        initialSpeed: 4,
        scheduleTick: ctrl.scheduleTick,
      }),
    );
    act(() => {
      result.current.play();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
      ctrl.tick();
    });
    // 1s wall × 4 = ~4s replay clock.
    expect(result.current.currentMs).toBeGreaterThanOrEqual(3500);
    expect(result.current.currentMs).toBeLessThanOrEqual(4500);
  });

  it("pause() arrete l'avancement", () => {
    const ctrl = makeController();
    const { result } = renderHook(() =>
      useReplayClock({
        durationMs: 100_000,
        scheduleTick: ctrl.scheduleTick,
      }),
    );
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(1000);
      ctrl.tick();
    });
    const beforePause = result.current.currentMs;
    act(() => result.current.pause());
    expect(result.current.playing).toBe(false);
    act(() => {
      vi.advanceTimersByTime(2000);
      ctrl.tick();
    });
    expect(result.current.currentMs).toBe(beforePause);
  });

  it("auto-pause quand currentMs >= durationMs", () => {
    const ctrl = makeController();
    const { result } = renderHook(() =>
      useReplayClock({
        durationMs: 1000,
        initialSpeed: 8,
        scheduleTick: ctrl.scheduleTick,
      }),
    );
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(500);
      ctrl.tick();
    });
    expect(result.current.playing).toBe(false);
    expect(result.current.currentMs).toBe(1000);
  });

  it("seek() clamp dans [0, durationMs]", () => {
    const ctrl = makeController();
    const { result } = renderHook(() =>
      useReplayClock({
        durationMs: 100_000,
        scheduleTick: ctrl.scheduleTick,
      }),
    );
    act(() => result.current.seek(50_000));
    expect(result.current.currentMs).toBe(50_000);
    act(() => result.current.seek(-1));
    expect(result.current.currentMs).toBe(0);
    act(() => result.current.seek(999_999));
    expect(result.current.currentMs).toBe(100_000);
  });

  it("setSpeed() change vitesse sans interrompre playing", () => {
    const ctrl = makeController();
    const { result } = renderHook(() =>
      useReplayClock({
        durationMs: 100_000,
        scheduleTick: ctrl.scheduleTick,
      }),
    );
    act(() => result.current.play());
    act(() => result.current.setSpeed(8));
    expect(result.current.playbackSpeed).toBe(8);
    expect(result.current.playing).toBe(true);
  });

  it("toggle() relance depuis 0 si on etait a la fin", () => {
    const ctrl = makeController();
    const { result } = renderHook(() =>
      useReplayClock({
        durationMs: 100_000,
        initialMs: 100_000,
        scheduleTick: ctrl.scheduleTick,
      }),
    );
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(true);
    expect(result.current.currentMs).toBe(0);
  });

  it("skipToEnd() sette currentMs=durationMs et pause", () => {
    const ctrl = makeController();
    const { result } = renderHook(() =>
      useReplayClock({
        durationMs: 100_000,
        scheduleTick: ctrl.scheduleTick,
      }),
    );
    act(() => result.current.play());
    act(() => result.current.skipToEnd());
    expect(result.current.currentMs).toBe(100_000);
    expect(result.current.playing).toBe(false);
  });

  it("restart() remet a 0 et redemarre", () => {
    const ctrl = makeController();
    const { result } = renderHook(() =>
      useReplayClock({
        durationMs: 100_000,
        initialMs: 50_000,
        scheduleTick: ctrl.scheduleTick,
      }),
    );
    act(() => result.current.restart());
    expect(result.current.currentMs).toBe(0);
    expect(result.current.playing).toBe(true);
  });
});

describe("formatReplayClock — sprint 1.G.2", () => {
  it("0 -> 00:00", () => {
    expect(formatReplayClock(0)).toBe("00:00");
  });

  it("65000 -> 01:05", () => {
    expect(formatReplayClock(65_000)).toBe("01:05");
  });

  it("clamp negatives a 00:00", () => {
    expect(formatReplayClock(-500)).toBe("00:00");
  });

  it("60s -> 01:00", () => {
    expect(formatReplayClock(60_000)).toBe("01:00");
  });

  it("expose les vitesses standards", () => {
    expect(PLAYBACK_SPEEDS).toEqual([0.5, 1, 2, 4, 8]);
  });
});
