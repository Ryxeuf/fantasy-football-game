/**
 * Helper qui factorise la branche "phase setup" du `onCellClick` du
 * board. Place le `selectedFromReserve` sur la cellule cible si legal,
 * sinon deselectionne et reset selectedPlayerId.
 *
 * Retourne `true` si l'evenement a ete pris en charge (caller doit
 * sortir de onCellClick), `false` sinon.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0p.
 */

import {
  type ExtendedGameState,
  type Position,
  placePlayerInSetup,
} from "@bb/game-engine";
import { getMySide, validatePlacement } from "./setup-validation";

interface HandleSetupCellClickContext {
  pos: Position;
  state: ExtendedGameState;
  myTeamSide: "A" | "B" | null;
  teamNameA: string | null | undefined;
  teamNameB: string | null | undefined;
  setupSubmitting: boolean;
  selectedFromReserve: string | null;
  showSetupError: (msg: string) => void;
  setState: (
    s:
      | ExtendedGameState
      | ((prev: ExtendedGameState | null) => ExtendedGameState | null),
  ) => void;
  setSelectedFromReserve: (id: string | null) => void;
}

/**
 * @returns `true` si la branche setup a traite l'evenement (caller doit
 *   `return`), `false` si on n'est pas en setup ou qu'aucune action n'a
 *   ete prise.
 */
export function handleSetupCellClick(
  ctx: HandleSetupCellClickContext,
): boolean {
  const {
    pos,
    state,
    myTeamSide,
    teamNameA,
    teamNameB,
    setupSubmitting,
    selectedFromReserve,
    showSetupError,
    setState,
    setSelectedFromReserve,
  } = ctx;

  if (state.preMatch?.phase !== "setup") return false;

  // Bloquer les interactions setup quand ce n'est pas mon tour ou
  // soumission en cours.
  const mySide = myTeamSide || getMySide(state, teamNameA, teamNameB);
  if (mySide && mySide !== state.preMatch.currentCoach) return true;
  if (setupSubmitting) return true;

  // Mode setup : placer selectedFromReserve sur pos si legal.
  if (selectedFromReserve) {
    const err = validatePlacement(state, selectedFromReserve, pos, mySide);
    if (err) {
      showSetupError(err);
      setSelectedFromReserve(null);
      return true;
    }
    const result = placePlayerInSetup(state, selectedFromReserve, pos);
    if (!result.success) {
      showSetupError("Placement refusé");
      setSelectedFromReserve(null);
      return true;
    }

    setState(result.state as ExtendedGameState);
    setSelectedFromReserve(null);
    return true;
  }

  // Sinon, clic sur terrain vide : ignore ou deselect.
  setSelectedFromReserve(null);
  if (state.selectedPlayerId) {
    setState((s) => (s ? { ...s, selectedPlayerId: null } : null));
  }
  return true;
}
