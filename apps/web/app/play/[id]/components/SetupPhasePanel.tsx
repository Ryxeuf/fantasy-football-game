"use client";

/**
 * Panneau d'UI pour la phase de setup pre-match (placement des 11 joueurs).
 *
 * Affiche :
 *  - les 3 etapes (Receiver place / Kicker place / Kickoff)
 *  - le coach actuel a placer
 *  - le compteur joueurs places / target
 *  - l'erreur de placement transitoire
 *  - bouton "Pret !" quand tous les joueurs sont places, sinon
 *    message d'attente adverse
 *
 * Le composant est purement UI : les actions sont injectees via
 * `onValidatePlacement`.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0h.
 */

import { type ExtendedGameState } from "@bb/game-engine";
import { getMySide } from "../utils/setup-validation";

interface SetupPhasePanelProps {
  state: ExtendedGameState;
  myTeamSide: "A" | "B" | null;
  teamNameA: string | null | undefined;
  teamNameB: string | null | undefined;
  setupError: string | null;
  setupSubmitting: boolean;
  onValidatePlacement: () => void | Promise<void>;
}

export function SetupPhasePanel({
  state,
  myTeamSide,
  teamNameA,
  teamNameB,
  setupError,
  setupSubmitting,
  onValidatePlacement,
}: SetupPhasePanelProps) {
  const currentCoach = state.preMatch?.currentCoach;
  const availableCount =
    state.players?.filter(
      (p) => p.team === currentCoach && (!p.state || p.state === "active"),
    ).length || 0;
  const target = Math.min(11, availableCount);
  const onFieldCount =
    state.players?.filter((p) => p.team === currentCoach && p.pos.x >= 0)
      .length || 0;
  const mySide = myTeamSide || getMySide(state, teamNameA, teamNameB);

  return (
    <div>
      {/* Etapes de setup */}
      <div className="mb-2">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-2">
          <span
            className={`px-2 py-0.5 rounded ${
              state.preMatch?.currentCoach === state.preMatch?.receivingTeam
                ? "bg-green-100 text-green-700 font-semibold"
                : "bg-gray-100 text-gray-500 line-through"
            }`}
          >
            1.{" "}
            {state.preMatch?.receivingTeam === "A"
              ? state.teamNames.teamA
              : state.teamNames.teamB}{" "}
            place
          </span>
          <span className="text-gray-300">&rarr;</span>
          <span
            className={`px-2 py-0.5 rounded ${
              state.preMatch?.currentCoach === state.preMatch?.kickingTeam
                ? "bg-green-100 text-green-700 font-semibold"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            2.{" "}
            {state.preMatch?.kickingTeam === "A"
              ? state.teamNames.teamA
              : state.teamNames.teamB}{" "}
            place
          </span>
          <span className="text-gray-300">&rarr;</span>
          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-400">
            3. Kickoff
          </span>
        </div>
      </div>

      <div className="font-semibold text-gray-800">
        Au tour de{" "}
        <span className="px-2 py-1 rounded bg-green-600 text-white">
          {currentCoach === "A" ? state.teamNames.teamA : state.teamNames.teamB}
        </span>{" "}
        de placer ses joueurs
      </div>

      <div className="text-xs text-gray-500 mt-1">
        Joueurs placés : {onFieldCount}/{target}
      </div>

      {setupError && (
        <div className="mt-2 px-3 py-2 bg-red-100 text-red-700 rounded border border-red-300">
          {setupError}
        </div>
      )}

      {/* Bouton de validation ou message d'attente */}
      {mySide && mySide !== currentCoach && (
        <div className="mt-3 px-3 py-2 bg-yellow-50 text-yellow-700 rounded border border-yellow-300 text-sm">
          En attente du placement adverse...
        </div>
      )}

      {onFieldCount === target && mySide === currentCoach && (
        <div className="mt-3">
          <button
            onClick={onValidatePlacement}
            disabled={setupSubmitting}
            className={`px-6 py-3 text-white rounded-lg font-bold text-lg transition-all shadow-md ${
              setupSubmitting
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 hover:shadow-lg active:scale-95"
            }`}
          >
            {setupSubmitting ? "Validation..." : "Prêt !"}
          </button>
        </div>
      )}
    </div>
  );
}
