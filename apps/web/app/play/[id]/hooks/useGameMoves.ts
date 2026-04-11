"use client";
import { useState, useCallback } from "react";
import type { Move, ExtendedGameState } from "@bb/game-engine";
import { API_BASE } from "../../../auth-client";
import type { MoveAckPayload } from "./useGameSocket";

interface MoveResult {
  success: boolean;
  gameState: ExtendedGameState;
  isMyTurn: boolean;
  moveCount: number;
}

interface UseGameMovesOptions {
  /** WebSocket submitMove function from useGameSocket. When provided and connected, moves are sent via WebSocket. */
  wsSubmitMove?: (move: Move) => Promise<MoveAckPayload | null>;
}

/**
 * Hook pour soumettre les coups au serveur pendant la phase active du match.
 * Prefere WebSocket quand disponible, avec fallback REST automatique.
 */
export function useGameMoves(matchId: string, options: UseGameMovesOptions = {}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitMove = useCallback(
    async (move: Move): Promise<MoveResult | null> => {
      setSubmitting(true);
      setError(null);

      // Try WebSocket first if available
      if (options.wsSubmitMove) {
        try {
          const wsResult = await options.wsSubmitMove(move);
          if (wsResult) {
            setSubmitting(false);
            if (!wsResult.success) {
              setError(wsResult.error || "Erreur WebSocket");
              return null;
            }
            return wsResult as MoveResult;
          }
          // wsResult is null → socket not connected, fall through to REST
        } catch {
          // WebSocket failed, fall through to REST
        }
      }

      // REST fallback
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) {
          setError("Non authentifié");
          return null;
        }

        const res = await fetch(`${API_BASE}/match/${matchId}/move`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ move }),
        });

        const data = await res.json().catch(() => ({}) as any);

        if (!res.ok) {
          setError(data?.error || `Erreur ${res.status}`);
          return null;
        }

        return data as MoveResult;
      } catch (e: any) {
        setError(e?.message || "Erreur réseau");
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [matchId, options.wsSubmitMove],
  );

  return { submitMove, submitting, error, clearError: () => setError(null) };
}
