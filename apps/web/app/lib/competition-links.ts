/**
 * Liens et libellés d'une COMPÉTITION (ligue ou coupe).
 *
 * La feuille de match est la même des deux côtés : mêmes routes serveur,
 * même page. Seuls le lien de retour et le vocabulaire changent. Concentrer
 * ces deux règles ici évite qu'une page de coupe ne renvoie « à la ligue »
 * — et qu'un troisième cas ne fasse pousser un `switch` de plus.
 *
 * 100 % PUR : ni React, ni fetch, testable tel quel.
 */

export type CompetitionKind = "league" | "cup";

/** `true` si la valeur servie par l'API désigne une coupe. */
export function isCupCompetition(kind: unknown): boolean {
  return kind === "cup";
}

/** Page de la compétition (lien retour depuis une feuille de match). */
export function competitionHref(kind: unknown, competitionId: string): string {
  return isCupCompetition(kind)
    ? `/cups/${competitionId}`
    : `/leagues/${competitionId}`;
}

/** Libellé du lien retour (« ← Retour à la coupe « X » »). */
export function competitionBackLabel(kind: unknown, name?: string | null): string {
  const what = isCupCompetition(kind) ? "à la coupe" : "à la ligue";
  return name ? `← Retour ${what} « ${name} »` : `← Retour ${what}`;
}

/**
 * Feuille de match d'une rencontre. Le préfixe suit la compétition pour que
 * l'URL reste lisible et que le retour navigateur tombe au bon endroit ; les
 * deux routes servent la même page.
 */
export function matchSheetHref(kind: unknown, pairingId: string): string {
  return isCupCompetition(kind)
    ? `/cups/pairings/${pairingId}/sheet`
    : `/leagues/pairings/${pairingId}/sheet`;
}
