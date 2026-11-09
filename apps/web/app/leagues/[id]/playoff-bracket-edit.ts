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

/** Rencontre sans résultat : un remplaçant ne peut pas y être déjà engagé. */
const OPEN_STATUSES = new Set(["scheduled", "in_progress"]);

/** La rencontre accepte un remplacement (à jouer, rien de saisi). */
export function canReplaceInPairing(p: BracketPairingLike): boolean {
  return p.status === "scheduled" && !isBracketPairingEngaged(p);
}

/** Un seul qualifié connu : il occupe les deux côtés. */
export function isPlaceholder(p: BracketPairingLike): boolean {
  return p.homeParticipant.id === p.awayParticipant.id;
}

/**
 * Équipes proposables pour remplacer un côté : actives (la liste fournie),
 * hors de toute rencontre de bracket encore à jouer — sauf le côté remplacé
 * lui-même, qui s'en va. Miroir de la règle serveur
 * (`decidePlayoffReplacement`), qui reste juge.
 */
export function replacementCandidates<T extends { readonly id: string }>(
  rounds: readonly BracketRoundLike[],
  pairing: BracketPairingLike,
  side: "home" | "away",
  eligible: readonly T[],
): T[] {
  const placeholder = isPlaceholder(pairing);
  const replaced = placeholder
    ? pairing.homeParticipant.id
    : side === "home"
      ? pairing.homeParticipant.id
      : pairing.awayParticipant.id;
  const busy = new Set<string>();
  for (const r of rounds) {
    for (const p of r.pairings) {
      if (!OPEN_STATUSES.has(p.status)) continue;
      busy.add(p.homeParticipant.id);
      busy.add(p.awayParticipant.id);
    }
  }
  busy.delete(replaced);
  if (!placeholder) {
    // L'adversaire reste dans la rencontre.
    busy.add(
      side === "home" ? pairing.awayParticipant.id : pairing.homeParticipant.id,
    );
  }
  return eligible.filter((e) => e.id !== replaced && !busy.has(e.id));
}
