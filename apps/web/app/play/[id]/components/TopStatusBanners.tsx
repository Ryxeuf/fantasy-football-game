"use client";

/**
 * Bandeaux fixes en haut de l'ecran qui resument le statut courant
 * du tour (match actif) et le statut de placement (prematch setup).
 *
 * Deux composants exportes :
 *  - `TurnStatusBanner` : affiche en match actif "C'est votre tour"
 *    / "En attente" + badges Reroll / Apothecary / Match termine.
 *  - `PreMatchSetupBanner` : affiche en phase setup "Placez vos 11
 *    joueurs..." / "En attente du placement de X..." avec spinner.
 *
 * Extraits de `play/[id]/page.tsx` dans le cadre du refactor S26.0l.
 */

import { type ExtendedGameState } from "@bb/game-engine";

interface TurnStatusBannerProps {
  state: ExtendedGameState | null;
  isMyTurn: boolean;
  moveSubmitting: boolean;
}

export function TurnStatusBanner({
  state,
  isMyTurn,
  moveSubmitting,
}: TurnStatusBannerProps) {
  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 text-center py-2 text-sm font-bold flex items-center justify-center gap-4 ${
        isMyTurn ? "bg-green-500 text-white" : "bg-yellow-400 text-gray-900"
      }`}
    >
      <span>
        {moveSubmitting
          ? "Envoi du coup..."
          : isMyTurn
            ? "C'est votre tour !"
            : "En attente de l'adversaire..."}
      </span>
      {state && state.pendingReroll && isMyTurn && (
        <span className="bg-orange-500 text-white px-2 py-0.5 rounded text-xs animate-pulse">
          Relance disponible !
        </span>
      )}
      {state && state.pendingApothecary && isMyTurn && (
        <span className="bg-green-500 text-white px-2 py-0.5 rounded text-xs animate-pulse">
          Apothicaire disponible !
        </span>
      )}
      {state && state.gamePhase === "ended" && (
        <span className="bg-gray-700 text-white px-2 py-0.5 rounded text-xs">
          Match terminé — {state.score.teamA} - {state.score.teamB}
        </span>
      )}
    </div>
  );
}

interface PreMatchSetupBannerProps {
  state: ExtendedGameState;
  isMyTurn: boolean;
}

export function PreMatchSetupBanner({
  state,
  isMyTurn,
}: PreMatchSetupBannerProps) {
  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 text-center py-3 text-sm font-bold flex items-center justify-center gap-4 transition-colors duration-300 ${
        isMyTurn ? "bg-green-600 text-white" : "bg-yellow-400 text-gray-900"
      }`}
    >
      <span>
        {isMyTurn
          ? "Placez vos 11 joueurs puis cliquez Prêt !"
          : `En attente du placement de ${
              state.preMatch?.currentCoach === "A"
                ? state.teamNames.teamA
                : state.teamNames.teamB
            }...`}
      </span>
      {!isMyTurn && (
        <span className="inline-block w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  );
}
