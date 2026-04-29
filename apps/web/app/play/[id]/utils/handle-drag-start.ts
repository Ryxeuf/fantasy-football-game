/**
 * Helper qui factorise la logique du `handleDragStart` du board en
 * phase de setup pre-match.
 *
 * Bloque le drag :
 *  - quand on n'est pas en phase setup
 *  - pendant la soumission du placement (`setupSubmitting`)
 *  - quand on n'est pas le coach courant ou que le joueur drag
 *    n'appartient pas a notre equipe
 *
 * Sinon, ecrit le `playerId` dans le `dataTransfer` et expose le
 * `draggedPlayerId` pour le drop handler.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0n.
 */

import { type ExtendedGameState } from "@bb/game-engine";

interface HandleDragStartContext {
  e: React.DragEvent;
  playerId: string;
  state: ExtendedGameState | null;
  teamNameA: string | null | undefined;
  teamNameB: string | null | undefined;
  setupSubmitting: boolean;
  setDraggedPlayerId: (id: string | null) => void;
}

export function handleSetupDragStart(ctx: HandleDragStartContext): void {
  const {
    e,
    playerId,
    state,
    teamNameA,
    teamNameB,
    setupSubmitting,
    setDraggedPlayerId,
  } = ctx;
  if (!state || state.preMatch?.phase !== "setup") return;
  if (setupSubmitting) return;

  const isMyTeam = (() => {
    if (!teamNameA || !teamNameB) return true; // fallback permissif
    const mySide: "A" | "B" =
      teamNameA === state.teamNames.teamA ? "A" : "B";
    const playerTeam = state.players.find((p) => p.id === playerId)?.team;
    return mySide === state.preMatch?.currentCoach && playerTeam === mySide;
  })();
  if (!isMyTeam) return;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  e.dataTransfer.setData("text/plain", playerId);
  setDraggedPlayerId(playerId);
}
