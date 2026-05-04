/**
 * S27.2 — Helper Throw Team-Mate (mobile).
 *
 * Port pure de la logique web `handle-throw-team-mate-click.ts`
 * (S26.0q). Aucune dependance React Native : la fonction prend
 * l'etat et retourne une **decision** que le caller applique.
 *
 * Flow 2-clics :
 *  - Phase 1 : aucun coequipier selectionne -> retourne `selectThrown`
 *    si le clic touche un coequipier lancable.
 *  - Phase 2 : coequipier deja choisi -> retourne `submit` avec le
 *    Move legal si la case est dans les options.
 *
 * Pas de side-effects ici : le caller (page mobile) gere setState et
 * submit reseau via les decisions retournees.
 */

import type { GameState, Move, Position } from "@bb/game-engine";

/**
 * Type narrow du Move "THROW_TEAM_MATE". Re-exporte ici pour eviter
 * que les tests aient a importer le type complet.
 */
export interface LegalThrow {
  type: "THROW_TEAM_MATE";
  playerId: string;
  thrownPlayerId: string;
  targetPos: Position;
}

export interface ProcessThrowTeamMateClickInput {
  pos: Position;
  state: GameState;
  legal: readonly LegalThrow[];
  currentAction: "THROW_TEAM_MATE" | string | null;
  throwTeamMateThrownId: string | null;
}

export type ThrowTeamMateClickResult =
  | { kind: "inactive" }
  | { kind: "noop" }
  | { kind: "selectThrown"; thrownPlayerId: string }
  | { kind: "submit"; move: Extract<Move, { type: "THROW_TEAM_MATE" }> };

export function processThrowTeamMateClick(
  input: ProcessThrowTeamMateClickInput,
): ThrowTeamMateClickResult {
  const { pos, state, legal, currentAction, throwTeamMateThrownId } = input;

  if (currentAction !== "THROW_TEAM_MATE") return { kind: "inactive" };
  if (!state.selectedPlayerId) return { kind: "inactive" };

  if (!throwTeamMateThrownId) {
    // Phase 1 : selectionner un coequipier lancable.
    const clicked = state.players.find(
      (p) => p.pos.x === pos.x && p.pos.y === pos.y,
    );
    if (!clicked) return { kind: "noop" };
    if (clicked.team !== state.currentPlayer) return { kind: "noop" };
    if (clicked.id === state.selectedPlayerId) return { kind: "noop" };
    const lancable = legal.some(
      (m) =>
        m.type === "THROW_TEAM_MATE" &&
        m.playerId === state.selectedPlayerId &&
        m.thrownPlayerId === clicked.id,
    );
    if (!lancable) return { kind: "noop" };
    return { kind: "selectThrown", thrownPlayerId: clicked.id };
  }

  // Phase 2 : selectionner la position cible.
  const move = legal.find(
    (m): m is LegalThrow =>
      m.type === "THROW_TEAM_MATE" &&
      m.playerId === state.selectedPlayerId &&
      m.thrownPlayerId === throwTeamMateThrownId &&
      m.targetPos.x === pos.x &&
      m.targetPos.y === pos.y,
  );
  if (!move) return { kind: "noop" };
  return {
    kind: "submit",
    move: move as Extract<Move, { type: "THROW_TEAM_MATE" }>,
  };
}

/**
 * Indique si le joueur selectionne peut activer le flow Throw Team-Mate :
 * existe-t-il au moins une option legale `THROW_TEAM_MATE` pour lui ?
 *
 * Utilise par la page mobile pour decider d'afficher le bouton
 * "Lancer un coequipier" dans la barre d'actions.
 */
export function canActivateThrowTeamMate(
  legal: readonly LegalThrow[],
  playerId: string | null,
): boolean {
  if (!playerId) return false;
  return legal.some(
    (m) => m.type === "THROW_TEAM_MATE" && m.playerId === playerId,
  );
}
