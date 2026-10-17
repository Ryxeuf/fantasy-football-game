/**
 * Feuilles d'une coupe en attente du commissaire (PUR) : les deux coachs ont
 * soumis, il reste à valider. Dérivé des rondes déjà chargées — pas de
 * lecture de plus pour afficher le raccourci de la page de coupe.
 */

interface RoundWithSheets {
  readonly pairings: ReadonlyArray<{
    readonly matchSheet?: { readonly status: string } | null;
  }>;
}

export function cupSheetsAwaitingValidation(
  rounds: readonly RoundWithSheets[],
): number {
  let count = 0;
  for (const round of rounds) {
    for (const pairing of round.pairings) {
      if (pairing.matchSheet?.status === "both_submitted") count += 1;
    }
  }
  return count;
}
