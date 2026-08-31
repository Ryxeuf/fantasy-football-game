/**
 * Feuille d'équipe = joueurs ENCORE au roster.
 *
 * `GET /team/:id` renvoie TOUTES les lignes `TeamPlayer` (l'historique de
 * carrière n'est jamais supprimé). Un joueur sorti du roster porte `firedAt` :
 * licencié à l'étape 4 de la séquence de fin de match, ou TUÉ — la mort le
 * retire de l'équipe dès la validation de la feuille (livre p.68 : le mort est
 * retiré avant toute autre action d'après-match, sa place et son numéro sont
 * libres pour un recrutement). Il ne fait donc plus partie de la composition
 * ni de son décompte.
 *
 * Un mort ANTÉRIEUR à cette règle (`dead` sans `firedAt`) reste listé : c'est
 * le bouton « Retirer » de la page qui le sort à la main.
 */
export function rosterPlayersOf<
  T extends { dead?: boolean | null; firedAt?: string | Date | null },
>(players: readonly T[] | null | undefined): T[] {
  return (players ?? []).filter((p) => !p.firedAt);
}
