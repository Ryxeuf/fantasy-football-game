/**
 * Équipes RETIRÉES d'une coupe (PUR).
 *
 * Le retrait supprime l'inscription mais pas les matchs joués : le
 * classement, dérivé des matchs, garde une ligne pour l'équipe retirée (et
 * ses adversaires gardent leurs points). « Au classement » n'est donc plus
 * synonyme d'« inscrite » — ces deux helpers sont la seule façon de les
 * distinguer :
 *
 *   - `registeredStandings` pour ce qui ne vaut QUE pour les inscrits
 *     (têtes de série du bracket, classements par poule) ;
 *   - `flagWithdrawnStandings` pour l'affichage du classement général.
 */

export interface TeamStandingRow {
  readonly teamId: string;
}

/** Lignes des seules équipes encore inscrites, dans l'ordre du classement. */
export function registeredStandings<T extends TeamStandingRow>(
  rows: readonly T[],
  registeredTeamIds: ReadonlySet<string>,
): T[] {
  return rows.filter((row) => registeredTeamIds.has(row.teamId));
}

/**
 * Classement général servi à l'écran : une équipe qui n'est plus inscrite
 * porte `withdrawn: true` (badge « retirée », sans lien vers une fiche
 * d'inscription qui n'existe plus). Les autres lignes sont rendues telles
 * quelles — un client antérieur ne voit aucune différence.
 */
export function flagWithdrawnStandings<T extends TeamStandingRow>(
  rows: readonly T[],
  registeredTeamIds: ReadonlySet<string>,
): Array<T & { withdrawn?: true }> {
  return rows.map((row) =>
    registeredTeamIds.has(row.teamId) ? row : { ...row, withdrawn: true as const },
  );
}
