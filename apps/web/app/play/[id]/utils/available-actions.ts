/**
 * Determine la liste des actions disponibles pour le joueur
 * actuellement selectionne (avant qu'il choisisse). Le calcul depend
 * notamment du skill `THROW_TEAM_MATE` et de la presence d'un Move
 * legal correspondant.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0j.
 */

import {
  type ExtendedGameState,
  type GameState,
} from "@bb/game-engine";
import type { LegalAction } from "./legal-action";

export type ActivationAction =
  | "MOVE"
  | "BLOCK"
  | "BLITZ"
  | "PASS"
  | "HANDOFF"
  | "FOUL"
  | "THROW_TEAM_MATE";

const BASE_ACTIONS: ActivationAction[] = [
  "MOVE",
  "BLOCK",
  "BLITZ",
  "PASS",
  "HANDOFF",
  "FOUL",
];

/**
 * Retourne la liste d'actions affichables dans le `ActionPickerPopup`
 * pour `selectedPlayerId`. Inclut THROW_TEAM_MATE quand le joueur a
 * le skill correspondant ET qu'au moins un Move legal de ce type est
 * disponible (ex: il y a un coequipier liftable a portee).
 */
export function getAvailableActions(
  state: ExtendedGameState | GameState,
  legal: readonly LegalAction[],
  selectedPlayerId: string,
): ActivationAction[] {
  const sp = state.players.find((p) => p.id === selectedPlayerId);
  const canThrowTM =
    !!sp &&
    sp.skills.some((s) => s.toLowerCase() === "throw-team-mate") &&
    legal.some(
      (m) => m.type === "THROW_TEAM_MATE" && m.playerId === selectedPlayerId,
    );
  const available: ActivationAction[] = [...BASE_ACTIONS];
  if (canThrowTM) available.push("THROW_TEAM_MATE");
  return available;
}
