/**
 * Helper qui factorise la logique du `handleDrop` du board en phase
 * de setup pre-match.
 *
 * Etapes :
 *  1. Bloque si pas en setup ou si on n'est pas le coach courant
 *     (sinon affiche showSetupError et reset draggedPlayerId).
 *  2. Convertit la position pixel du drop -> coordonnee grid via le
 *     rect du canvas Pixi (pas le wrapper div qui peut etre plus large).
 *  3. Valide le placement via validatePlacement (LOS, wide zones,
 *     max 11, doublons).
 *  4. Applique le placement via placePlayerInSetup (engine).
 *  5. Reset draggedPlayerId quand 11 joueurs sont places ou apres
 *     le drop.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0o.
 */

import {
  type ExtendedGameState,
  type Position,
  placePlayerInSetup,
} from "@bb/game-engine";
import { getMySide, validatePlacement } from "./setup-validation";

interface HandleDropContext {
  e: React.DragEvent;
  state: ExtendedGameState;
  draggedPlayerId: string | null;
  boardEl: HTMLElement | null;
  teamNameA: string | null | undefined;
  teamNameB: string | null | undefined;
  currentCellSize: number;
  showSetupError: (msg: string) => void;
  setState: (s: ExtendedGameState) => void;
  setDraggedPlayerId: (id: string | null) => void;
}

export function handleSetupDrop(ctx: HandleDropContext): void {
  const {
    e,
    state,
    draggedPlayerId,
    boardEl,
    teamNameA,
    teamNameB,
    currentCellSize,
    showSetupError,
    setState,
    setDraggedPlayerId,
  } = ctx;
  e.preventDefault();
  if (!state || !draggedPlayerId || !boardEl) return;

  if (state.preMatch?.phase !== "setup") return;

  // Bloquer si je ne suis pas le coach courant ou que le joueur drag
  // n'appartient pas a mon equipe.
  if (teamNameA && teamNameB) {
    const mySide: "A" | "B" =
      teamNameA === state.teamNames.teamA ? "A" : "B";
    if (mySide !== state.preMatch.currentCoach) {
      setDraggedPlayerId(null);
      showSetupError("Ce n'est pas votre tour de placer");
      return;
    }
    const playerTeam = state.players.find((p) => p.id === draggedPlayerId)
      ?.team;
    if (playerTeam !== mySide) {
      setDraggedPlayerId(null);
      showSetupError("Vous ne pouvez placer que vos joueurs");
      return;
    }
  }

  // Utiliser rect du canvas Pixi (pas le wrapper div qui peut etre
  // plus large et fausser la conversion pixel -> cellule).
  const canvas = boardEl.querySelector("canvas");
  const rect = (canvas || boardEl).getBoundingClientRect();
  const nativeEvent = e.nativeEvent;
  const pixelX = nativeEvent.clientX - rect.left;
  const pixelY = nativeEvent.clientY - rect.top;
  // pixelX -> colonne (y), pixelY -> ligne (x) — meme logique que
  // PixiBoard.handleStageClick.
  const gridCol = Math.floor(pixelX / currentCellSize);
  const gridRow = Math.floor(pixelY / currentCellSize);

  if (
    gridCol >= 0 &&
    gridCol < state.height &&
    gridRow >= 0 &&
    gridRow < state.width
  ) {
    const pos: Position = { x: gridRow, y: gridCol };

    const err = validatePlacement(
      state,
      draggedPlayerId,
      pos,
      getMySide(state, teamNameA, teamNameB),
    );
    if (err) {
      showSetupError(err);
      setDraggedPlayerId(null);
      return;
    }

    const result = placePlayerInSetup(state, draggedPlayerId, pos);
    if (!result.success) {
      showSetupError("Placement refusé");
      setDraggedPlayerId(null);
      return;
    }

    const newState = result.state;
    setState(newState as ExtendedGameState);
    if ((newState as ExtendedGameState).preMatch?.placedPlayers.length === 11) {
      setDraggedPlayerId(null);
    }
  }
  setDraggedPlayerId(null);
}
