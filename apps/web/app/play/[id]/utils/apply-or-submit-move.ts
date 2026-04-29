/**
 * Helper qui factorise le pattern "submit move au serveur (online) OU
 * apply local (offline)" + dispatch state + dispatch dice popup.
 *
 * Utilise par les popups Block / Push / FollowUp / Reroll qui partagent
 * tous la meme logique de soumission / dispatch d'effet (~12 lignes
 * dupliquees x4 dans page.tsx avant ce refactor).
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0i.
 */

import { type ExtendedGameState, type Move, type RNG, applyMove } from "@bb/game-engine";
import { normalizeState } from "./normalize-state";

interface ApplyOrSubmitMoveOptions {
  move: Move;
  isActiveMatch: boolean;
  submitMove: (move: Move) => Promise<
    | {
        success?: boolean;
        gameState?: ExtendedGameState;
        isMyTurn?: boolean;
      }
    | null
    | undefined
  >;
  setState: (
    s:
      | ExtendedGameState
      | ((prev: ExtendedGameState | null) => ExtendedGameState | null),
  ) => void;
  setIsMyTurn: (v: boolean) => void;
  /** RNG factory pour le mode offline (apply local). */
  createRNG: () => RNG;
  /** Si true, declenche `setShowDicePopup(true)` quand le state final
   *  contient `lastDiceResult`. Tous les popups de choix Block /
   *  Reroll en ont besoin ; Push / FollowUp non. */
  withDicePopup?: boolean;
  setShowDicePopup?: (v: boolean) => void;
}

/**
 * Mode online (`isActiveMatch=true`) :
 *  - submit au serveur, normalise gameState, dispatch isMyTurn
 *  - declenche dice popup si present et `withDicePopup`
 * Mode offline :
 *  - apply local via applyMove, dispatch state
 *  - declenche dice popup si present et `withDicePopup`
 */
export function applyOrSubmitMove({
  move,
  isActiveMatch,
  submitMove,
  setState,
  setIsMyTurn,
  createRNG,
  withDicePopup = false,
  setShowDicePopup,
}: ApplyOrSubmitMoveOptions): void {
  if (isActiveMatch) {
    submitMove(move).then((res) => {
      if (res?.success && res.gameState) {
        setState(normalizeState(res.gameState));
        if (typeof res.isMyTurn === "boolean") setIsMyTurn(res.isMyTurn);
        if (
          withDicePopup &&
          res.gameState.lastDiceResult &&
          setShowDicePopup
        ) {
          setShowDicePopup(true);
        }
      }
    });
  } else {
    setState((s) => {
      if (!s) return null;
      const s2 = applyMove(s, move, createRNG());
      if (withDicePopup && s2.lastDiceResult && setShowDicePopup) {
        setShowDicePopup(true);
      }
      return s2 as ExtendedGameState;
    });
  }
}
