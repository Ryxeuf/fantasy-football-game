/**
 * Type-union des "actions legales" affichables dans l'UI play/[id].
 *
 * Le moteur expose `Move` (discriminated union) qui couvre toutes les
 * actions reelles d'un tour. En phase de setup pre-match, l'UI a aussi
 * besoin de representer un placement synthetique (pas une vraie action
 * du moteur, juste une position legale pour le drag/click). On modelise
 * ce cas via `PlaceAction` puis on union avec `Move` pour eviter les
 * `as any` partout dans `page.tsx`.
 *
 * Cree dans le cadre du refactor S26.0f.
 */

import type { Move, Position } from "@bb/game-engine";

/**
 * Action synthetique uniquement utilisee en phase de setup pour
 * representer un placement potentiel dans le tableau `legal` consomme
 * par les composants Pixi/board. Le moteur ne connait pas ce type.
 */
export interface PlaceAction {
  type: "PLACE";
  playerId: string;
  to: Position;
}

/** Union de tout ce qui peut apparaitre dans `legal[]` cote UI. */
export type LegalAction = Move | PlaceAction;

/** Type guard: vrai si l'action est un Move type "MOVE" pour le pid donne. */
export function isMoveForPlayer(
  action: LegalAction,
  playerId: string,
): action is Extract<Move, { type: "MOVE" }> {
  return action.type === "MOVE" && action.playerId === playerId;
}

/** Type guard: vrai si l'action est un placement setup synthetique. */
export function isPlaceAction(action: LegalAction): action is PlaceAction {
  return action.type === "PLACE";
}
