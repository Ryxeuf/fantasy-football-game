/**
 * Helper qui factorise la branche BLOCK / BLITZ du `onCellClick` :
 * un clic sur un adversaire avec une action BLOCK ou BLITZ active
 * declenche le bloc.
 *
 * Retourne `true` si la branche a traite le clic (caller doit
 * `return`), `false` si on n'est pas sur un adversaire ou qu'aucun
 * Move BLOCK legal n'existe pour la cible.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0r.
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

interface HandleBlockClickContext {
  pos: Position;
  state: ExtendedGameState;
  legal: readonly LegalAction[];
  currentAction: ActivationAction | null;
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
  createRNG: () => RNG;
}

/**
 * @returns `true` si la branche a soumis un BLOCK Move, `false` sinon.
 */
export function handleBlockClick(ctx: HandleBlockClickContext): boolean {
  const {
    pos,
    state,
    legal,
    currentAction,
    isActiveMatch,
    submitMove,
    setState,
    setIsMyTurn,
    setShowDicePopup,
    createRNG,
  } = ctx;

  const target = state.players.find(
    (p) =>
      p.team !== state.currentPlayer && p.pos.x === pos.x && p.pos.y === pos.y,
  );
  if (!target || (currentAction !== "BLOCK" && currentAction !== "BLITZ")) {
    return false;
  }

  const blockMove = legal.find(
    (m): m is Extract<Move, { type: "BLOCK" }> =>
      m.type === "BLOCK" &&
      m.playerId === state.selectedPlayerId &&
      m.targetId === target.id,
  );
  if (!blockMove) return false;

  applyOrSubmitMove({
    move: blockMove,
    isActiveMatch,
    submitMove,
    setState,
    setIsMyTurn,
    createRNG,
    withDicePopup: true,
    setShowDicePopup,
  });
  return true;
}
