/**
 * Helper d'appel API pour la validation du setup pre-match.
 *
 * Different des kickoff actions car la response contient des
 * meta-infos (isMyTurn, myTeamSide) que la page doit hydrater
 * dans des etats React separes.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0e.
 */

import { type ExtendedGameState } from "@bb/game-engine";
import { API_BASE } from "../../../auth-client";
import { normalizeState } from "./normalize-state";

interface ValidateSetupOptions {
  matchId: string;
  extState: ExtendedGameState;
  setState: (s: ExtendedGameState) => void;
  setIsMyTurn: (v: boolean) => void;
  setMyTeamSide: (v: "A" | "B") => void;
}

/**
 * Sauvegarde le placement en base via `POST /match/:id/validate-setup`
 * et hydrate les etats React (gameState, isMyTurn, myTeamSide) avec la
 * response. Throw au caller en cas d'erreur reseau ou response.ok=false.
 */
export async function validateSetupPlacement({
  matchId,
  extState,
  setState,
  setIsMyTurn,
  setMyTeamSide,
}: ValidateSetupOptions): Promise<void> {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    if (typeof window !== "undefined") {
      window.location.href = "/lobby";
    }
    return;
  }

  const response = await fetch(`${API_BASE}/match/${matchId}/validate-setup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      placedPlayers: extState.preMatch?.placedPlayers,
      playerPositions: extState.players
        .filter((p) => p.pos.x >= 0)
        .map((p) => ({ playerId: p.id, x: p.pos.x, y: p.pos.y })),
    }),
  });

  if (!response.ok) {
    throw new Error("Erreur lors de la sauvegarde du placement");
  }

  const responseData = await response.json();
  const normalizedState = normalizeState(responseData.gameState);
  setState(normalizedState);
  if (typeof responseData.isMyTurn === "boolean") {
    setIsMyTurn(responseData.isMyTurn);
  }
  if (responseData.myTeamSide) {
    setMyTeamSide(responseData.myTeamSide);
  }
}
