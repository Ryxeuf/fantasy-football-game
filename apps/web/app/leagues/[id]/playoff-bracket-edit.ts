/**
 * Édition d'un bracket de play-offs généré — règles d'AFFICHAGE (pures).
 *
 * Le serveur reste seul juge (`services/league-playoff-edit-rules`) : ces
 * prédicats ne servent qu'à proposer ou griser une action. Une feuille en
 * brouillon qui porte déjà des évènements n'est pas visible d'ici — le
 * serveur la refuse, l'écran affiche alors son message.
 */

/** Ce que l'écran sait d'une rencontre de bracket. */
export interface BracketPairingLike {
  readonly id: string;
  readonly status: string;
  readonly match: { readonly id: string } | null;
  readonly matchSheet?: { readonly status: string } | null;
  readonly homeParticipant: { readonly id: string };
  readonly awayParticipant: { readonly id: string };
}

export interface BracketRoundLike {
  readonly pairings: readonly BracketPairingLike[];
}

const SHEET_ENGAGED = new Set([
  "submitted_home",
  "submitted_away",
  "both_submitted",
  "validated",
  "invalidated",
]);

/** Quelque chose a été joué ou saisi sur cette rencontre. */
export function isBracketPairingEngaged(p: BracketPairingLike): boolean {
  if (p.status !== "scheduled" && p.status !== "cancelled") return true;
  if (p.match) return true;
  return !!p.matchSheet && SHEET_ENGAGED.has(p.matchSheet.status);
}

/** Le bracket entier peut être réinitialisé (aucune rencontre engagée). */
export function canResetBracket(rounds: readonly BracketRoundLike[]): boolean {
  return (
    rounds.length > 0 &&
    rounds.every((r) => r.pairings.every((p) => !isBracketPairingEngaged(p)))
  );
}
