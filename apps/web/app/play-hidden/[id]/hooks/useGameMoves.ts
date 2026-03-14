"use client";
import { useState, useCallback } from "react";
import type { Move, ExtendedGameState } from "@bb/game-engine";
import { API_BASE } from "../../../auth-client";

interface MoveResult {
  success: boolean;
  gameState: ExtendedGameState;
  isMyTurn: boolean;
  moveCount: number;
}

/**
 * Hook pour soumettre les coups au serveur pendant la phase active du match.
 * Retourne submitMove(move) qui envoie le coup au serveur et retourne le nouvel état.
 */
export function useGameMoves(matchId: string) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitMove = useCallback(
    async (move: Move): Promise<MoveResult | null> => {
      setSubmitting(true);
      setError(null);
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
    [matchId],
  );

  return { submitMove, submitting, error, clearError: () => setError(null) };
}
