"use client";

/**
 * Barre flottante d'activation du joueur (en bas de l'ecran).
 *
 * Affiche les PM restants (cap MA + GFI bonus) et un bouton
 * "Terminer l'activation" quand le joueur a deja agi (a un Move
 * dans `playerActions`).
 *
 * Le clic sur le bouton soumet un move END_PLAYER_TURN via le helper
 * applyOrSubmitMove (factorise online/offline).
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0k.
 */

import { type ExtendedGameState, type Move, type RNG } from "@bb/game-engine";
import { applyOrSubmitMove } from "../utils/apply-or-submit-move";

interface PlayerActivationBarProps {
  state: ExtendedGameState;
  isActiveMatch: boolean;
  submitMove: (move: Move) => Promise<
    | { success?: boolean; gameState?: ExtendedGameState; isMyTurn?: boolean }
    | null
    | undefined
  >;
  setState: (
    s:
      | ExtendedGameState
      | ((prev: ExtendedGameState | null) => ExtendedGameState | null),
  ) => void;
  setIsMyTurn: (v: boolean) => void;
  createRNG: () => RNG;
}

export function PlayerActivationBar({
  state,
  isActiveMatch,
  submitMove,
  setState,
  setIsMyTurn,
  createRNG,
}: PlayerActivationBarProps) {
  const selectedPlayerId = state.selectedPlayerId;
  if (!selectedPlayerId) return null;
  const selectedPlayer = state.players.find((p) => p.id === selectedPlayerId);
  if (!selectedPlayer) return null;
  const hasActed = !!state.playerActions?.[selectedPlayerId];

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3">
      {/* Compteur de mouvements restants */}
      <div className="bg-gray-900/90 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-mono flex items-center gap-2">
        <span className="text-xs text-gray-400">PM</span>
        <span
          className={`font-bold ${selectedPlayer.pm > 0 ? "text-green-400" : "text-red-400"}`}
        >
          {selectedPlayer.pm}/{selectedPlayer.ma}
        </span>
        {(selectedPlayer.gfiUsed ?? 0) < 2 && selectedPlayer.pm <= 0 && (
          <span className="text-xs text-yellow-400 ml-1">
            +{2 - (selectedPlayer.gfiUsed ?? 0)} GFI
          </span>
        )}
      </div>

      {/* Bouton terminer l'activation */}
      {hasActed && (
        <button
          onClick={() => {
            applyOrSubmitMove({
              move: { type: "END_PLAYER_TURN", playerId: selectedPlayerId },
              isActiveMatch,
              submitMove,
              setState,
              setIsMyTurn,
              createRNG,
            });
          }}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-lg transition-all text-sm"
        >
          Terminer l&apos;activation
        </button>
      )}
    </div>
  );
}
