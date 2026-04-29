/**
 * Helper qui factorise la branche THROW_TEAM_MATE du `onCellClick`.
 *
 * Flow 2-clics :
 *  1. Premier clic sur un coequipier lancable -> set
 *     `throwTeamMateThrownId`.
 *  2. Second clic sur une case cible -> trouve le Move legal et
 *     applique via applyOrSubmitMove, reset les states de tracking.
 *
 * Retourne `true` si la branche a traite le clic (caller doit
 * `return`), `false` si on n'est pas en flow THROW_TEAM_MATE.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0q.
 */

import {
  type ExtendedGameState,
  type Move,
  type Position,
  type RNG,
} from "@bb/game-engine";
import type { LegalAction } from "./legal-action";
import { applyOrSubmitMove } from "./apply-or-submit-move";
import type { ActivationAction } from "./available-actions";

interface HandleThrowTeamMateClickContext {
  pos: Position;
  state: ExtendedGameState;
  legal: readonly LegalAction[];
  currentAction: ActivationAction | null;
  throwTeamMateThrownId: string | null;
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
  setShowDicePopup: (v: boolean) => void;
  setThrowTeamMateThrownId: (id: string | null) => void;
  setCurrentAction: (a: ActivationAction | null) => void;
  createRNG: () => RNG;
}

/**
 * @returns `true` si la branche a traite le clic, `false` sinon.
 */
export function handleThrowTeamMateClick(
  ctx: HandleThrowTeamMateClickContext,
): boolean {
  const {
    pos,
    state,
    legal,
    currentAction,
    throwTeamMateThrownId,
    isActiveMatch,
    submitMove,
    setState,
    setIsMyTurn,
    setShowDicePopup,
    setThrowTeamMateThrownId,
    setCurrentAction,
    createRNG,
  } = ctx;

  if (currentAction !== "THROW_TEAM_MATE" || !state.selectedPlayerId) {
    return false;
  }

  const clickedPlayer = state.players.find(
    (p) => p.pos.x === pos.x && p.pos.y === pos.y,
  );

  if (!throwTeamMateThrownId) {
    // Phase 1 : selectionner un coequipier lancable.
    if (
      clickedPlayer &&
      clickedPlayer.team === state.currentPlayer &&
      clickedPlayer.id !== state.selectedPlayerId &&
      legal.some(
        (m) =>
          m.type === "THROW_TEAM_MATE" &&
          m.playerId === state.selectedPlayerId &&
          m.thrownPlayerId === clickedPlayer.id,
      )
    ) {
      setThrowTeamMateThrownId(clickedPlayer.id);
    }
    return true;
  }

  // Phase 2 : selectionner la position cible.
  const move = legal.find(
    (m): m is Extract<Move, { type: "THROW_TEAM_MATE" }> =>
      m.type === "THROW_TEAM_MATE" &&
      m.playerId === state.selectedPlayerId &&
      m.thrownPlayerId === throwTeamMateThrownId &&
      m.targetPos.x === pos.x &&
      m.targetPos.y === pos.y,
  );
  if (!move) return true; // hors portee : ignore le clic mais sort du flow

  applyOrSubmitMove({
    move,
    isActiveMatch,
    submitMove,
    setState,
    setIsMyTurn,
    createRNG,
    withDicePopup: true,
    setShowDicePopup,
  });
  setThrowTeamMateThrownId(null);
  setCurrentAction(null);
  return true;
}
