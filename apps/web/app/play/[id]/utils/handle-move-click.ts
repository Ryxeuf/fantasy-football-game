/**
 * Helper qui factorise la branche MOVE du `onCellClick` :
 * un clic sur une cellule cible cherche un Move legal MOVE pour le
 * joueur selectionne et l'applique. Apres l'application, deselectionne
 * le joueur s'il n'a plus de PM.
 *
 * Retourne `true` si la branche a soumis un MOVE Move (caller doit
 * `return`), `false` si aucun candidate MOVE n'existe ou que l'action
 * courante ne permet pas un MOVE.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0s.
 */

import {
  type ExtendedGameState,
  type Move,
  type Position,
  type RNG,
  applyMove,
} from "@bb/game-engine";
import type { LegalAction } from "./legal-action";
import { normalizeState } from "./normalize-state";
import type { ActivationAction } from "./available-actions";

interface HandleMoveClickContext {
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
  setSelectedFromReserve: (id: string | null) => void;
  createRNG: () => RNG;
}

/**
 * @returns `true` si la branche a soumis un MOVE Move, `false` sinon.
 */
export function handleMoveClick(ctx: HandleMoveClickContext): boolean {
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
    setSelectedFromReserve,
    createRNG,
  } = ctx;

  const candidate = legal.find(
    (m): m is Extract<Move, { type: "MOVE" }> =>
      m.type === "MOVE" &&
      m.playerId === state.selectedPlayerId &&
      m.to.x === pos.x &&
      m.to.y === pos.y,
  );
  if (
    !candidate ||
    !(
      currentAction === "MOVE" ||
      currentAction === "BLITZ" ||
      currentAction === null
    )
  ) {
    return false;
  }

  if (isActiveMatch) {
    submitMove(candidate).then((result) => {
      if (result?.success && result.gameState) {
        const ns = normalizeState(result.gameState);
        setState(ns);
        if (typeof result.isMyTurn === "boolean") setIsMyTurn(result.isMyTurn);
        const p = ns.players.find((pl) => pl.id === candidate.playerId);
        if (!p || p.pm <= 0)
          setState((s) => (s ? { ...s, selectedPlayerId: null } : null));
        if (ns.lastDiceResult) setShowDicePopup(true);
        setSelectedFromReserve(null);
      }
    });
  } else {
    setState((s) => {
      if (!s) return null;
      let s2 = applyMove(s, candidate, createRNG());
      const p = s2.players.find((pl) => pl.id === candidate.playerId);
      if (!p || p.pm <= 0) s2 = { ...s2, selectedPlayerId: null };
      if (s2.lastDiceResult) setShowDicePopup(true);
      setSelectedFromReserve(null);
      return s2 as ExtendedGameState;
    });
  }
  return true;
}
