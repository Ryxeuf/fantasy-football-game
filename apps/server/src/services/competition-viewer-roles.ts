/**
 * Rôle du lecteur sur chaque compétition d'un listing (`viewerRoles`).
 *
 * La règle est PURE (`buildViewerRoles`, `competition-membership`) ; ici on
 * charge ce qu'elle lit, en bloc pour toute la page — jamais par élément :
 *
 *  - ligues : UNE requête des inscriptions des équipes du lecteur sur les
 *    ligues de la page + UN `groupBy` du numéro de saison max (l'édition
 *    courante d'une ligue est sa saison de plus haut numéro) ;
 *  - coupes : aucune requête — le listing charge déjà chaque inscrit avec
 *    son propriétaire (`buildCupViewerRoles`, pur). Une coupe n'a qu'une
 *    édition et pas de statut de retrait (la désinscription supprime la
 *    ligne).
 *
 * Le filtre suit le propriétaire COURANT de l'équipe (`team.ownerId`), sans
 * `deletedAt` : une équipe supprimée garde son historique.
 */

import { prisma } from "../prisma";
import { buildViewerRoles, type ViewerRoles } from "./competition-membership";

export interface ListedCompetition {
  readonly id: string;
  readonly creatorId: string;
}

const NO_ROLES = (
  viewerId: string | null | undefined,
  creatorId: string,
): ViewerRoles =>
  buildViewerRoles({
    viewerId,
    creatorId,
    currentEdition: null,
    participations: [],
  });

export async function loadLeagueViewerRoles(
  viewerId: string | null | undefined,
  leagues: readonly ListedCompetition[],
): Promise<Map<string, ViewerRoles>> {
  const out = new Map<string, ViewerRoles>();
  if (leagues.length === 0) return out;
  if (!viewerId) {
    for (const l of leagues) out.set(l.id, NO_ROLES(viewerId, l.creatorId));
    return out;
  }
  const ids = leagues.map((l) => l.id);
  const [rows, editions] = await Promise.all([
    prisma.leagueParticipant.findMany({
      where: { team: { ownerId: viewerId }, season: { leagueId: { in: ids } } },
      select: {
        status: true,
        team: { select: { id: true, name: true } },
        season: { select: { leagueId: true, seasonNumber: true } },
      },
    }) as unknown as Promise<
      Array<{
        status: string;
        team: { id: string; name: string };
        season: { leagueId: string; seasonNumber: number };
      }>
    >,
    prisma.leagueSeason.groupBy({
      by: ["leagueId"],
      where: { leagueId: { in: ids } },
      _max: { seasonNumber: true },
    }) as unknown as Promise<
      Array<{ leagueId: string; _max: { seasonNumber: number | null } }>
    >,
  ]);
  const currentByLeague = new Map<string, number | null>();
  for (const e of editions) {
    currentByLeague.set(e.leagueId, e._max.seasonNumber ?? null);
  }
  for (const l of leagues) {
    out.set(
      l.id,
      buildViewerRoles({
        viewerId,
        creatorId: l.creatorId,
        currentEdition: currentByLeague.get(l.id) ?? null,
        participations: rows
          .filter((r) => r.season.leagueId === l.id)
          .map((r) => ({
            edition: r.season.seasonNumber,
            status: r.status,
            team: r.team,
          })),
      }),
    );
  }
  return out;
}

/** Une coupe telle que `GET /cup` la charge (inscrits avec propriétaire). */
export interface ListedCup extends ListedCompetition {
  readonly participants: ReadonlyArray<{
    readonly team: {
      readonly id: string;
      readonly name: string;
      readonly owner: { readonly id: string } | null;
    };
  }>;
}

/** PUR : rôle du lecteur sur une coupe dont les inscrits sont déjà chargés. */
export function buildCupViewerRoles(
  viewerId: string | null | undefined,
  cup: ListedCup,
): ViewerRoles {
  const CUP_EDITION = 1;
  return buildViewerRoles({
    viewerId,
    creatorId: cup.creatorId,
    currentEdition: CUP_EDITION,
    participations: viewerId
      ? cup.participants
          .filter((p) => p.team.owner?.id === viewerId)
          .map((p) => ({
            edition: CUP_EDITION,
            status: "active",
            team: { id: p.team.id, name: p.team.name },
          }))
      : [],
  });
}
