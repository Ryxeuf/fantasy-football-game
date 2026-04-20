"use client";
import { useCallback, useMemo, useState } from "react";
import {
  applyMove,
  getLegalMoves,
  makeRNG,
  type GameState,
  type Move,
  type TeamId,
} from "@bb/game-engine";
import { API_BASE } from "../../../auth-client";

/**
 * N.4 — Pont d'orchestration cote client entre le moteur et le service IA.
 *
 * Responsabilites :
 *  - interroger le serveur pour obtenir le prochain coup IA
 *    (`POST /local-match/:id/ai-next-move`) ;
 *  - appliquer ce coup localement via `applyMove` (sans mutation) ;
 *  - persister le nouveau `gameState` via `PUT /local-match/:id/state` ;
 *  - repeter tant que c'est encore le tour de l'IA (multi-coups par tour).
 *
 * Le hook retourne des primitives composables (`playOneAIMove`, `playAITurn`)
 * que la couche UI branche a ses boutons. Pas de boucle cachee.
 */

interface AINextMoveResponse {
  readonly isAITurn: boolean;
  readonly move: Move | null;
  readonly aiTeam: TeamId;
  readonly difficulty: "easy" | "medium" | "hard";
}

export interface UseAIPracticeLoopOptions {
  readonly matchId: string;
  readonly aiTeam: TeamId;
  readonly onStateChange?: (state: GameState) => void;
  /** Garde-fou anti boucle infinie (defaut: 64 coups par tour). */
  readonly maxMovesPerTurn?: number;
}

export interface PlayResult {
  readonly state: GameState;
  readonly moves: readonly Move[];
  readonly isAITurn: boolean;
}

async function apiFetch<T>(path: string, init: RequestInit): Promise<T> {
  const token = typeof window !== "undefined"
    ? window.localStorage.getItem("auth_token")
    : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const message = json?.error ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return json as T;
}

async function persistState(matchId: string, state: GameState): Promise<void> {
  await apiFetch(`/local-match/${matchId}/state`, {
    method: "PUT",
    body: JSON.stringify({ gameState: state }),
  });
}

async function fetchAIMove(
  matchId: string,
  state: GameState,
): Promise<AINextMoveResponse> {
  return apiFetch<AINextMoveResponse>(`/local-match/${matchId}/ai-next-move`, {
    method: "POST",
    body: JSON.stringify({ gameState: state }),
  });
}

export function useAIPracticeLoop(options: UseAIPracticeLoopOptions) {
  const { matchId, aiTeam, onStateChange } = options;
  const maxMovesPerTurn = options.maxMovesPerTurn ?? 64;

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rng = useMemo(() => makeRNG(`ai-client-${matchId}`), [matchId]);

  const playOneAIMove = useCallback(
    async (state: GameState): Promise<PlayResult> => {
      setError(null);
      setRunning(true);
      try {
        const response = await fetchAIMove(matchId, state);
        if (!response.isAITurn || !response.move) {
          return { state, moves: [], isAITurn: false };
        }
        const nextState = applyMove(state, response.move, rng);
        await persistState(matchId, nextState);
        onStateChange?.(nextState);
        return {
          state: nextState,
          moves: [response.move],
          isAITurn: nextState.currentPlayer === aiTeam,
        };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Erreur inconnue";
        setError(message);
        throw e;
      } finally {
        setRunning(false);
      }
    },
    [matchId, aiTeam, rng, onStateChange],
  );

  const playAITurn = useCallback(
    async (initialState: GameState): Promise<PlayResult> => {
      setError(null);
      setRunning(true);
      const appliedMoves: Move[] = [];
      let state = initialState;
      try {
        let count = 0;
        while (count < maxMovesPerTurn) {
          const response = await fetchAIMove(matchId, state);
          if (!response.isAITurn || !response.move) {
            break;
          }
          state = applyMove(state, response.move, rng);
          appliedMoves.push(response.move);
          count += 1;
          if (state.currentPlayer !== aiTeam) {
            break;
          }
        }
        await persistState(matchId, state);
        onStateChange?.(state);
        return {
          state,
          moves: appliedMoves,
          isAITurn: state.currentPlayer === aiTeam,
        };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Erreur inconnue";
        setError(message);
        throw e;
      } finally {
        setRunning(false);
      }
    },
    [matchId, aiTeam, rng, maxMovesPerTurn, onStateChange],
  );

  const applyUserMove = useCallback(
    async (state: GameState, move: Move): Promise<GameState> => {
      setError(null);
      setRunning(true);
      try {
        const legal = getLegalMoves(state);
        const isLegal = legal.some(m => JSON.stringify(m) === JSON.stringify(move));
        if (!isLegal) {
          throw new Error("Coup illegal pour l'etat courant");
        }
        const nextState = applyMove(state, move, rng);
        await persistState(matchId, nextState);
        onStateChange?.(nextState);
        return nextState;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Erreur inconnue";
        setError(message);
        throw e;
      } finally {
        setRunning(false);
      }
    },
    [matchId, rng, onStateChange],
  );

  return {
    running,
    error,
    clearError: () => setError(null),
    playOneAIMove,
    playAITurn,
    applyUserMove,
  };
}
