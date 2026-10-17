/**
 * Rencontres de COUPE jouées par les équipes d'un coach, pour ses compteurs
 * de profil (« Matchs suivis » de l'accueil, profil web et mobile).
 *
 * Ces compteurs additionnaient les `Match` du coach (en ligne, et le `Match`
 * offline synthétique de chaque feuille de LIGUE validée, dont il est
 * joueur) et les `LocalMatch` qu'il a CRÉÉS. Or le `LocalMatch` que
 * matérialise une feuille de coupe validée est créé au nom du commissaire :
 * un coach qui avait joué toute une coupe n'en voyait aucun match. Les
 * rencontres créées par le coach lui-même sont déjà comptées
 * (`createdLocalMatches`) : on les écarte, pas de double compte.
 */

/** Filtre Prisma `LocalMatch` (PUR, testé à part). */
export function cupMatchesPlayedWhere(userId: string) {
  return {
    // Jouées : une rencontre en attente ou annulée (ancienne saisie
    // manuelle) n'a pas eu lieu — même filtre que le bilan d'équipe.
    status: "completed",
    creatorId: { not: userId },
    AND: [
      { OR: [{ cupId: { not: null } }, { cupPairingId: { not: null } }] },
      {
        OR: [
          { teamA: { ownerId: userId } },
          { teamB: { ownerId: userId } },
        ],
      },
    ],
  };
}

export interface CupMatchCountDb {
  readonly localMatch: { count: (args: unknown) => Promise<number> };
}

export async function countCupMatchesPlayed(
  db: CupMatchCountDb,
  userId: string,
): Promise<number> {
  return db.localMatch.count({ where: cupMatchesPlayedWhere(userId) });
}
