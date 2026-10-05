/**
 * Lot 2 « journal rejouable » — navigation par ACTIVATION dans un replay.
 *
 * Une activation = la suite contiguë des coups d'un même joueur (depuis le
 * lot 1, le moteur ne laisse pas deux activations s'entremêler). Les coups
 * de CHOIX (dé de blocage, poussée, suivi, relance…) prolongent
 * l'activation en cours ; `END_TURN` et les coups sans joueur ferment la
 * précédente et ouvrent un segment à part.
 *
 * Pur : ne connaît que la liste des coups, utilisable tel quel sur la
 * séquence brute ou compacte.
 */

import type { Move } from "@bb/game-engine";

const CHOICE_MOVE_TYPES: ReadonlySet<Move["type"]> = new Set<Move["type"]>([
  "BLOCK_CHOOSE",
  "PUSH_CHOOSE",
  "FOLLOW_UP_CHOOSE",
  "REROLL_CHOOSE",
  "APOTHECARY_CHOOSE",
  "DUMP_OFF_CHOOSE",
  "ON_THE_BALL_DECLINE",
  "ON_THE_BALL_MOVE",
]);

function actorOf(move: Move): string | null {
  if (CHOICE_MOVE_TYPES.has(move.type)) return null;
  if ("playerId" in move && typeof move.playerId === "string") {
    return move.playerId;
  }
  return null;
}

/**
 * Indices des coups qui OUVRENT une activation (ou un segment sans
 * joueur : fin de tour, remise en jeu). Croissants, `[]` si aucun coup.
 */
export function activationStarts(moves: readonly Move[]): readonly number[] {
  const starts: number[] = [];
  let current: string | null = null;
  let open = false;
  moves.forEach((move, index) => {
    const actor = actorOf(move);
    if (actor === null) {
      if (CHOICE_MOVE_TYPES.has(move.type) && open) return; // prolonge
      starts.push(index);
      open = false;
      current = null;
      return;
    }
    if (!open || actor !== current) {
      starts.push(index);
      open = true;
      current = actor;
    }
  });
  return starts;
}

/** Premier coup de l'activation suivant celle qui contient `index` (-1 = kickoff). */
export function nextActivationIndex(
  moves: readonly Move[],
  index: number,
): number {
  const starts = activationStarts(moves);
  const next = starts.find((s) => s > index);
  return next ?? Math.max(-1, moves.length - 1);
}

/**
 * Premier coup de l'activation précédente. Depuis le milieu d'une
 * activation, revient à SON début (comportement « piste précédente »).
 */
export function previousActivationIndex(
  moves: readonly Move[],
  index: number,
): number {
  const starts = activationStarts(moves);
  const before = starts.filter((s) => s < index);
  return before.length > 0 ? (before[before.length - 1] as number) : -1;
}
