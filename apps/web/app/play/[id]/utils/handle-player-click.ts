/**
 * Helper qui factorise la logique du `onPlayerClick` du board Pixi.
 *
 * Resoud les 3 cas :
 *  1. Phase setup : si le joueur clique appartient au coach courant et
 *     qu'aucun drag n'est en cours, le selectionne dans la reserve.
 *  2. Match actif + action BLOCK / BLITZ / FOUL : un clic sur un
 *     adversaire equivaut a un clic sur la cellule -> delegue
 *     onCellClick.
 *  3. Match actif + action THROW_TEAM_MATE : un clic sur un coequipier
 *     equivaut a un clic sur la cellule.
 *  4. Sinon : selectionne le joueur (mes joueurs uniquement).
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0m.
 */

import {
  type ExtendedGameState,
  type Position,
} from "@bb/game-engine";
import { webLog } from "../../../lib/log";
import type { ActivationAction } from "./available-actions";

interface HandlePlayerClickContext {
  state: ExtendedGameState;
  playerId: string;
  draggedPlayerId: string | null;
  currentAction: ActivationAction | null;
  setState: (
    s:
      | ExtendedGameState
      | ((prev: ExtendedGameState | null) => ExtendedGameState | null),
  ) => void;
  setCurrentAction: (a: ActivationAction | null) => void;
  setThrowTeamMateThrownId: (id: string | null) => void;
  setSelectedFromReserve: (id: string | null) => void;
  onCellClick: (pos: Position) => void;
}

export function handlePlayerClick(ctx: HandlePlayerClickContext): void {
  const {
    state,
    playerId,
    draggedPlayerId,
    currentAction,
    setState,
    setCurrentAction,
    setThrowTeamMateThrownId,
    setSelectedFromReserve,
    onCellClick,
  } = ctx;
  webLog.debug("onPlayerClick called:", {
    playerId,
    phase: state.preMatch?.phase,
    currentCoach: state.preMatch?.currentCoach,
  });

  if (state.preMatch?.phase === "setup") {
    const player = state.players.find((p) => p.id === playerId);
    if (player && player.team === state.preMatch.currentCoach) {
      if (!draggedPlayerId) {
        webLog.debug("Setting selectedFromReserve:", playerId);
        setSelectedFromReserve(playerId);
      }
      return;
    }
    webLog.debug("Ignoring player click in setup phase");
    return;
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  if (
    player.team !== state.currentPlayer &&
    state.selectedPlayerId &&
    (currentAction === "BLOCK" ||
      currentAction === "BLITZ" ||
      currentAction === "FOUL")
  ) {
    onCellClick(player.pos);
    return;
  }

  if (
    currentAction === "THROW_TEAM_MATE" &&
    state.selectedPlayerId &&
    player.team === state.currentPlayer &&
    player.id !== state.selectedPlayerId
  ) {
    onCellClick(player.pos);
    return;
  }

  if (
    player.team === state.currentPlayer &&
    (!state.preMatch || (state.preMatch.phase as string) !== "setup")
  ) {
    setState((s) => (s ? { ...s, selectedPlayerId: player.id } : null));
    setCurrentAction(null);
    setThrowTeamMateThrownId(null);
    setSelectedFromReserve(null);
  }
}
