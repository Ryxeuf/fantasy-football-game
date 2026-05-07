/**
 * Sprint 1.G.5 — Tests `useReplayShortcuts`.
 *
 * Le hook est plug-and-play sur la window. On lui injecte un EventTarget
 * dummy pour piloter les events sans toucher la window globale.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import type { ScrubMarker } from "./replay-scrub-markers";
import { useReplayShortcuts } from "./use-replay-shortcuts";

interface MockTarget extends EventTarget {
  fire(key: string, opts?: { shiftKey?: boolean; targetTag?: string }): boolean;
}

function makeTarget(): MockTarget {
  const t = new EventTarget() as MockTarget;
  t.fire = (
    key: string,
    opts: { shiftKey?: boolean; targetTag?: string } = {},
  ): boolean => {
    let target: HTMLElement | null = null;
    if (opts.targetTag) {
      target = document.createElement(opts.targetTag);
    }
    const ke = new KeyboardEvent("keydown", {
      key,
      shiftKey: opts.shiftKey ?? false,
      cancelable: true,
    });
    if (target) {
      Object.defineProperty(ke, "target", { value: target });
    }
    return t.dispatchEvent(ke);
  };
  return t;
}

const MARKERS: ScrubMarker[] = [
  {
    type: "TD",
    displayAtMs: 60_000,
    percent: 10,
    label: "TOUCHDOWN HOME",
    eventIndex: 5,
  },
  {
    type: "CASUALTY",
    displayAtMs: 200_000,
    percent: 33,
    label: "Casualty",
    eventIndex: 12,
  },
  {
    type: "NUFFLE",
    displayAtMs: 350_000,
    percent: 58,
    label: "Nuffle: fog_rolls_in",
    eventIndex: 22,
  },
];

let onToggle: ReturnType<typeof vi.fn>;
let onSeek: ReturnType<typeof vi.fn>;
let onRestart: ReturnType<typeof vi.fn>;
let onSkipToEnd: ReturnType<typeof vi.fn>;

beforeEach(() => {
  onToggle = vi.fn();
  onSeek = vi.fn();
  onRestart = vi.fn();
  onSkipToEnd = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useReplayShortcuts — sprint 1.G.5", () => {
  it("Space toggles play/pause", () => {
    const target = makeTarget();
    renderHook(() =>
      useReplayShortcuts({
        currentMs: 30_000,
        onToggle,
        onSeek,
        onRestart,
        onSkipToEnd,
        markers: MARKERS,
        target,
      }),
    );
    target.fire(" ");
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("ArrowLeft seek -5s", () => {
    const target = makeTarget();
    renderHook(() =>
      useReplayShortcuts({
        currentMs: 30_000,
        onToggle,
        onSeek,
        onRestart,
        onSkipToEnd,
        markers: MARKERS,
        target,
      }),
    );
    target.fire("ArrowLeft");
    expect(onSeek).toHaveBeenCalledWith(25_000);
  });

  it("ArrowRight seek +5s", () => {
    const target = makeTarget();
    renderHook(() =>
      useReplayShortcuts({
        currentMs: 30_000,
        onToggle,
        onSeek,
        onRestart,
        onSkipToEnd,
        markers: MARKERS,
        target,
      }),
    );
    target.fire("ArrowRight");
    expect(onSeek).toHaveBeenCalledWith(35_000);
  });

  it("Shift+ArrowRight seek vers marker suivant", () => {
    const target = makeTarget();
    renderHook(() =>
      useReplayShortcuts({
        currentMs: 30_000,
        onToggle,
        onSeek,
        onRestart,
        onSkipToEnd,
        markers: MARKERS,
        target,
      }),
    );
    target.fire("ArrowRight", { shiftKey: true });
    expect(onSeek).toHaveBeenCalledWith(60_000);
  });

  it("Shift+ArrowLeft seek vers marker precedent", () => {
    const target = makeTarget();
    renderHook(() =>
      useReplayShortcuts({
        currentMs: 250_000,
        onToggle,
        onSeek,
        onRestart,
        onSkipToEnd,
        markers: MARKERS,
        target,
      }),
    );
    target.fire("ArrowLeft", { shiftKey: true });
    expect(onSeek).toHaveBeenCalledWith(200_000);
  });

  it("Shift+ArrowRight no-op si pas de marker apres", () => {
    const target = makeTarget();
    renderHook(() =>
      useReplayShortcuts({
        currentMs: 999_000,
        onToggle,
        onSeek,
        onRestart,
        onSkipToEnd,
        markers: MARKERS,
        target,
      }),
    );
    target.fire("ArrowRight", { shiftKey: true });
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("Shift+ArrowLeft no-op si pas de marker avant", () => {
    const target = makeTarget();
    renderHook(() =>
      useReplayShortcuts({
        currentMs: 1_000,
        onToggle,
        onSeek,
        onRestart,
        onSkipToEnd,
        markers: MARKERS,
        target,
      }),
    );
    target.fire("ArrowLeft", { shiftKey: true });
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("Home declenche restart", () => {
    const target = makeTarget();
    renderHook(() =>
      useReplayShortcuts({
        currentMs: 30_000,
        onToggle,
        onSeek,
        onRestart,
        onSkipToEnd,
        markers: MARKERS,
        target,
      }),
    );
    target.fire("Home");
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("End declenche skipToEnd", () => {
    const target = makeTarget();
    renderHook(() =>
      useReplayShortcuts({
        currentMs: 30_000,
        onToggle,
        onSeek,
        onRestart,
        onSkipToEnd,
        markers: MARKERS,
        target,
      }),
    );
    target.fire("End");
    expect(onSkipToEnd).toHaveBeenCalledTimes(1);
  });

  it("ignore les keys quand le focus est sur un INPUT text", () => {
    const target = makeTarget();
    renderHook(() =>
      useReplayShortcuts({
        currentMs: 30_000,
        onToggle,
        onSeek,
        onRestart,
        onSkipToEnd,
        markers: MARKERS,
        target,
      }),
    );
    target.fire(" ", { targetTag: "input" });
    target.fire("ArrowLeft", { targetTag: "textarea" });
    expect(onToggle).not.toHaveBeenCalled();
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("enabled=false desactive tous les shortcuts", () => {
    const target = makeTarget();
    renderHook(() =>
      useReplayShortcuts({
        currentMs: 30_000,
        onToggle,
        onSeek,
        onRestart,
        onSkipToEnd,
        markers: MARKERS,
        target,
        enabled: false,
      }),
    );
    target.fire(" ");
    target.fire("ArrowRight");
    target.fire("Home");
    expect(onToggle).not.toHaveBeenCalled();
    expect(onSeek).not.toHaveBeenCalled();
    expect(onRestart).not.toHaveBeenCalled();
  });

  it("ignore les keys non bindees", () => {
    const target = makeTarget();
    renderHook(() =>
      useReplayShortcuts({
        currentMs: 30_000,
        onToggle,
        onSeek,
        onRestart,
        onSkipToEnd,
        markers: MARKERS,
        target,
      }),
    );
    target.fire("a");
    target.fire("Enter");
    target.fire("Tab");
    expect(onToggle).not.toHaveBeenCalled();
    expect(onSeek).not.toHaveBeenCalled();
  });
});
