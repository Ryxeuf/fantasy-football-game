/**
 * Pro League full-replay hook — Lot 3.D.3.
 *
 * Charge le dump `{ initialState, moves, states, teams }` depuis
 * `/pro-league/matches/:id/full-replay` (Lot 3.D.2) et expose le
 * `GameState` à l'instant courant pour rendu via `<GameBoardWithDugouts>`
 * (Lot 3.D.4). Réutilise `useReplayClock` pour la state machine
 * play/pause/scrub/speed.
 *
 * Modèle temps : le full driver émet 1 action / seconde (`MS_PER_ACTION
 * = 1000ms` côté sim-engine). Le hook traduit `currentMs` du clock en
 * `currentMoveIndex` via une division entière.
 *
 *   currentMs = 0       → currentMoveIndex = -1 (initialState)
 *   currentMs = 1000    → currentMoveIndex = 0  (états après moves[0])
 *   currentMs = N*1000  → currentMoveIndex = N - 1
 *
 * État courant exposé :
 *   - `currentMoveIndex === -1` → `initialState`
 *   - sinon → `states[currentMoveIndex]`
 *
 * Erreurs 404 (full replay non dispo pour les replays legacy / hybrid)
 * sont remontées via `error` pour qu'un fallback puisse rediriger vers
 * la vue textuelle classique.
 */

"use client";

import { useEffect, useMemo, useState } from "react";

import type { GameState, Move } from "@bb/game-engine";

import { apiRequest } from "./api-client";
import { compactReplaySequence } from "./compact-replay";
import {
  type PlaybackSpeed,
  type ReplayClockControls,
  formatReplayClock,
  useReplayClock,
} from "./use-replay-clock";

/** 1 action = 1 seconde (aligné avec `MS_PER_ACTION` du sim-engine). */
export const MS_PER_MOVE = 1000;

export interface FullReplayTeamPaint {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly race: string;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
}

export interface FullReplayDump {
  readonly matchId: string;
  readonly status: string;
  readonly durationMs: number;
  readonly initialState: GameState;
  readonly moves: readonly Move[];
  readonly states: readonly GameState[];
  readonly teams: {
    readonly home: FullReplayTeamPaint | null;
    readonly away: FullReplayTeamPaint | null;
  };
}

export interface UseFullReplayOptions {
  /**
   * Lot 3.E.2 — si `true` (défaut), retire les moves "filler" (choix
   * tactiques sans effet visuel : BLOCK_CHOOSE, PUSH_CHOOSE,
   * FOLLOW_UP_CHOOSE, REROLL_CHOOSE, APOTHECARY_CHOOSE,
   * DUMP_OFF_CHOOSE) de la séquence visionnée. Densifie l'expérience
   * de re-jeu sans changer le contenu logique du match.
   */
  readonly compact?: boolean;
}

export interface UseFullReplayResult {
  readonly loading: boolean;
  readonly error: string | null;
  readonly errorCode: string | null;
  readonly dump: FullReplayDump | null;
  readonly currentState: GameState | null;
  readonly currentMove: Move | null;
  readonly currentMoveIndex: number;
  readonly totalMoves: number;
  readonly currentMs: number;
  readonly durationMs: number;
  readonly playing: boolean;
  readonly playbackSpeed: PlaybackSpeed;
  readonly controls: ReplayClockControls & {
    readonly stepForward: () => void;
    readonly stepBackward: () => void;
  };
  readonly clockLabel: string;
  /** Lot 3.E.2 — true si la séquence visionnée est la version compacte. */
  readonly compact: boolean;
  /** Lot 3.E.2 — nombre de moves filler retirés (0 si compact=false). */
  readonly fillerCount: number;
}

/**
 * Fetch + état du replay full-driver. `error` non-null si l'API
 * répond 404 (full replay non disponible — legacy / hybrid driver) ou
 * si le réseau échoue. `errorCode` reprend le code retourné par
 * `/api/pro-league/matches/:id/full-replay` (ex: `FULL_REPLAY_NOT_AVAILABLE`).
 */
export function useFullReplay(
  matchId: string,
  options: UseFullReplayOptions = {},
): UseFullReplayResult {
  const { compact = true } = options;
  const [dump, setDump] = useState<FullReplayDump | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setErrorCode(null);
    apiRequest<FullReplayDump>(
      `/pro-league/matches/${encodeURIComponent(matchId)}/full-replay`,
    )
      .then((res) => {
        if (cancelled) return;
        setDump(res);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "fetch error";
        const code =
          e && typeof e === "object" && "code" in e
            ? String((e as { code?: unknown }).code ?? "")
            : "";
        setError(msg);
        setErrorCode(code || null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // Lot 3.E.2 — si `compact`, filtre les moves filler (BLOCK_CHOOSE,
  // PUSH_CHOOSE, ...) sans effet visuel. Le tableau résultant est
  // celui exposé via `dump`-derived state, et la duration s'ajuste.
  const sequence = useMemo(() => {
    if (!dump) return null;
    if (!compact)
      return {
        moves: dump.moves,
        states: dump.states,
        fillerCount: 0,
      };
    const compacted = compactReplaySequence({
      moves: dump.moves,
      states: dump.states,
    });
    return {
      moves: compacted.moves,
      states: compacted.states,
      fillerCount: dump.moves.length - compacted.moves.length,
    };
  }, [dump, compact]);

  // Durée logique : 1 move = 1 seconde. `KICKOFF` à T+0 puis chaque
  // move à T+(i+1)s. Borne supérieure = `moves.length * 1000` ms.
  const durationMs = sequence ? sequence.moves.length * MS_PER_MOVE : 0;
  const clock = useReplayClock({ durationMs });

  // Index courant = floor(currentMs / MS_PER_MOVE) - 1. -1 = kickoff.
  const currentMoveIndex = useMemo(() => {
    if (!sequence) return -1;
    const idx = Math.floor(clock.currentMs / MS_PER_MOVE) - 1;
    return Math.max(-1, Math.min(sequence.moves.length - 1, idx));
  }, [clock.currentMs, sequence]);

  const currentState: GameState | null = useMemo(() => {
    if (!dump || !sequence) return null;
    if (currentMoveIndex < 0) return dump.initialState;
    return sequence.states[currentMoveIndex] ?? dump.initialState;
  }, [dump, sequence, currentMoveIndex]);

  const currentMove: Move | null = useMemo(() => {
    if (!sequence || currentMoveIndex < 0) return null;
    return sequence.moves[currentMoveIndex] ?? null;
  }, [sequence, currentMoveIndex]);

  const stepForward = useMemo(
    () => () => {
      if (!sequence) return;
      const nextIdx = Math.min(
        sequence.moves.length - 1,
        currentMoveIndex + 1,
      );
      clock.seek((nextIdx + 1) * MS_PER_MOVE);
    },
    [clock, currentMoveIndex, sequence],
  );

  const stepBackward = useMemo(
    () => () => {
      if (!sequence) return;
      const prevIdx = Math.max(-1, currentMoveIndex - 1);
      clock.seek((prevIdx + 1) * MS_PER_MOVE);
    },
    [clock, currentMoveIndex, sequence],
  );

  return {
    loading,
    error,
    errorCode,
    dump,
    currentState,
    currentMove,
    currentMoveIndex,
    totalMoves: sequence?.moves.length ?? 0,
    currentMs: clock.currentMs,
    durationMs,
    playing: clock.playing,
    playbackSpeed: clock.playbackSpeed,
    controls: {
      play: clock.play,
      pause: clock.pause,
      toggle: clock.toggle,
      seek: clock.seek,
      setSpeed: clock.setSpeed,
      skipToEnd: clock.skipToEnd,
      restart: clock.restart,
      stepForward,
      stepBackward,
    },
    clockLabel: formatReplayClock(clock.currentMs),
    compact,
    fillerCount: sequence?.fillerCount ?? 0,
  };
}
