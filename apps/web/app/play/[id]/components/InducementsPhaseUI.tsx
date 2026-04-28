"use client";

/**
 * UI de la phase d'inducements pre-match.
 *
 * Le coach voit son budget (petty cash) puis selectionne / skip ses
 * inducements via `<InducementSelector>`. La selection est emise sur le
 * socket de jeu (`game:submit-inducements`), et l'UI passe en
 * "submitted" tant que l'adversaire n'a pas confirme la sienne.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0a.
 */

import { useState, useCallback } from "react";
import {
  INDUCEMENT_CATALOGUE,
  type InducementSelection,
  type InducementDefinition,
  type ExtendedGameState,
} from "@bb/game-engine";
import InducementSelector from "../../../components/InducementSelector";
import { normalizeState } from "../utils/normalize-state";
import type { useGameSocket } from "../hooks/useGameSocket";

interface InducementsPhaseUIProps {
  matchId: string;
  state: ExtendedGameState;
  stateSource: string | null;
  setState: (
    s:
      | ExtendedGameState
      | ((prev: ExtendedGameState | null) => ExtendedGameState | null),
  ) => void;
  myTeamSide: "A" | "B" | null;
  gameSocket: ReturnType<typeof useGameSocket>["socket"];
}

export function InducementsPhaseUI({
  matchId,
  state,
  setState,
  myTeamSide,
  gameSocket,
}: InducementsPhaseUIProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [inducementError, setInducementError] = useState<string | null>(null);

  const catalogue = INDUCEMENT_CATALOGUE.filter(
    (ind) => ind.slug !== "star_player",
  ) as InducementDefinition[];

  const myTeamName =
    myTeamSide === "A" ? state.teamNames.teamA : state.teamNames.teamB;
  // Budget info from preMatch state (petty cash computed server-side during pre-match sequence)
  const myBudget =
    myTeamSide === "A"
      ? (state.preMatch?.inducements?.teamA?.pettyCash ?? 0)
      : (state.preMatch?.inducements?.teamB?.pettyCash ?? 0);

  const handleConfirm = useCallback(
    (selection: InducementSelection) => {
      if (!gameSocket || submitting || submitted) return;
      setSubmitting(true);
      setInducementError(null);

      gameSocket.emit(
        "game:submit-inducements",
        { matchId, selection },
        (response: any) => {
          setSubmitting(false);
          if (!response?.success) {
            setInducementError(response?.error || "Erreur");
            return;
          }
          setSubmitted(true);
          if (response.gameState) {
            setState(normalizeState(response.gameState));
          }
        },
      );
    },
    [gameSocket, matchId, submitting, submitted, setState],
  );

  const handleSkip = useCallback(() => {
    handleConfirm({ items: [] });
  }, [handleConfirm]);

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Phase d&apos;Inducements</h2>
        <p className="text-sm text-gray-500 mt-1">
          Depensez votre budget pour des avantages de match.
        </p>
      </div>

      {inducementError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm text-center">
          {inducementError}
        </div>
      )}

      {submitted ? (
        <div className="rounded border bg-emerald-50 border-emerald-300 p-6 text-center">
          <div className="font-semibold text-emerald-700">{myTeamName}</div>
          <div className="text-sm text-emerald-600 mt-1">Selection confirmee</div>
          <div className="text-xs text-gray-500 mt-3">En attente de l&apos;adversaire...</div>
        </div>
      ) : (
        <InducementSelector
          catalogue={catalogue}
          budget={myBudget}
          pettyCash={myBudget}
          teamName={myTeamName}
          disabled={submitting}
          onConfirm={handleConfirm}
          onSkip={handleSkip}
        />
      )}

      {submitting && (
        <div className="mt-4 text-center text-gray-500 text-sm">
          Envoi de la selection...
        </div>
      )}
    </div>
  );
}
