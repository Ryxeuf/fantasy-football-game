/**
 * Sprint 1.G.5 — Hook keyboard shortcuts pour MatchReplayPlayer.
 *
 * Bindings :
 *  - Space          : toggle play/pause
 *  - ArrowLeft      : seek -5s
 *  - ArrowRight     : seek +5s
 *  - Shift+Left     : marker precedent (key moment)
 *  - Shift+Right    : marker suivant
 *  - Home           : restart (currentMs=0)
 *  - End            : skip-to-end
 *
 * Ignore les events si le focus est dans un input/textarea/select/
 * contenteditable. Pure-ish : `target` injectable (default = window).
 */

"use client";

import { useEffect } from "react";

import type { ScrubMarker } from "./replay-scrub-markers";

const SEEK_STEP_MS = 5_000;

export interface ReplayShortcutHandlers {
  readonly currentMs: number;
  readonly onToggle: () => void;
  readonly onSeek: (ms: number) => void;
  readonly onRestart: () => void;
  readonly onSkipToEnd: () => void;
  readonly markers: readonly ScrubMarker[];
}

export interface UseReplayShortcutsOptions extends ReplayShortcutHandlers {
  /** Override pour tests. Default = window. */
  readonly target?: EventTarget | null;
  /** Disable les shortcuts (ex: pendant un loading). */
  readonly enabled?: boolean;
}

function isTypingInForm(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    // Range input = scrub bar : on laisse passer pour fluiditer (les
    // touches sont gérées par les bindings, pas par le natif range).
    if (
      tag === "INPUT" &&
      (target as HTMLInputElement).type === "range"
    ) {
      return false;
    }
    return true;
  }
  if (target.isContentEditable) return true;
  return false;
}

function findPrevMarker(
  markers: readonly ScrubMarker[],
  currentMs: number,
): ScrubMarker | null {
  let prev: ScrubMarker | null = null;
  for (const m of markers) {
    if (m.displayAtMs < currentMs - 50) {
      prev = m;
    } else {
      break;
    }
  }
  return prev;
}

function findNextMarker(
  markers: readonly ScrubMarker[],
  currentMs: number,
): ScrubMarker | null {
  for (const m of markers) {
    if (m.displayAtMs > currentMs + 50) {
      return m;
    }
  }
  return null;
}

export function useReplayShortcuts(opts: UseReplayShortcutsOptions): void {
  const enabled = opts.enabled !== false;
  const {
    currentMs,
    onToggle,
    onSeek,
    onRestart,
    onSkipToEnd,
    markers,
    target,
  } = opts;

  useEffect(() => {
    if (!enabled) return undefined;
    const root = target ?? (typeof window !== "undefined" ? window : null);
    if (!root) return undefined;

    const handler = (ev: Event): void => {
      const ke = ev as KeyboardEvent;
      if (isTypingInForm(ke.target)) return;
      switch (ke.key) {
        case " ":
        case "Spacebar": {
          ke.preventDefault();
          onToggle();
          return;
        }
        case "ArrowLeft": {
          ke.preventDefault();
          if (ke.shiftKey) {
            const prev = findPrevMarker(markers, currentMs);
            if (prev) onSeek(prev.displayAtMs);
          } else {
            onSeek(currentMs - SEEK_STEP_MS);
          }
          return;
        }
        case "ArrowRight": {
          ke.preventDefault();
          if (ke.shiftKey) {
            const next = findNextMarker(markers, currentMs);
            if (next) onSeek(next.displayAtMs);
          } else {
            onSeek(currentMs + SEEK_STEP_MS);
          }
          return;
        }
        case "Home": {
          ke.preventDefault();
          onRestart();
          return;
        }
        case "End": {
          ke.preventDefault();
          onSkipToEnd();
          return;
        }
        default:
          return;
      }
    };

    root.addEventListener("keydown", handler);
    return () => {
      root.removeEventListener("keydown", handler);
    };
  }, [
    enabled,
    target,
    currentMs,
    onToggle,
    onSeek,
    onRestart,
    onSkipToEnd,
    markers,
  ]);
}
