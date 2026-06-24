/**
 * Suppression d'équipe par son coach (soft delete).
 *
 * Règles métier :
 *  - Refus si l'équipe est encore engagée dans une compétition NON terminée
 *    (ligue dont la saison n'est pas `completed`, ou coupe dont le statut
 *    n'est pas `terminee`/`archivee`) — qu'elle soit en cours ou à venir.
 *  - Sinon soft delete : on positionne `deletedAt`. On NE hard-delete PAS car
 *    l'équipe reste référencée par l'historique des compétitions terminées
 *    (LeagueParticipant, CupParticipant) qu'on veut préserver.
 *
 * Erreurs typées (`TeamDeleteError.code`) pour que la route mappe le bon
 * status HTTP et que l'UI affiche le message tel quel.
 */

import { prisma } from "../prisma";

export type TeamDeleteErrorCode =
  | "not_found"
  | "in_active_league"
  | "in_active_cup";

export class TeamDeleteError extends Error {
  constructor(
    public readonly code: TeamDeleteErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TeamDeleteError";
  }
}

/** Statut de saison de ligue considéré comme terminé (autorise la suppression). */
const LEAGUE_SEASON_DONE = "completed";
/** Statuts de coupe considérés comme terminés (autorisent la suppression). */
const CUP_DONE_STATUSES = ["terminee", "archivee"];

export async function deleteTeam(input: {
  teamId: string;
  userId: string;
}): Promise<void> {
  const { teamId, userId } = input;

  // Ownership + non déjà supprimée. `findFirst` filtre `deletedAt: null` pour
  // qu'une double suppression renvoie "introuvable" plutôt qu'un succès muet.
  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId: userId, deletedAt: null },
    select: { id: true },
  });
  if (!team) {
    throw new TeamDeleteError("not_found", "Équipe introuvable");
  }

  // Ligue : participant encore actif sur une saison non terminée.
  const activeLeague = await prisma.leagueParticipant.findFirst({
    where: {
      teamId,
      status: "active",
      season: { status: { not: LEAGUE_SEASON_DONE } },
    },
    select: {
      season: { select: { league: { select: { name: true } } } },
    },
  });
  if (activeLeague) {
    const name = activeLeague.season?.league?.name ?? "une ligue";
    throw new TeamDeleteError(
      "in_active_league",
      `Impossible de supprimer : l'équipe est engagée dans la ligue « ${name} » (en cours ou à venir). Retire-la d'abord.`,
    );
  }

  // Coupe : rattachement à une coupe non terminée.
  const activeCup = await prisma.cupParticipant.findFirst({
    where: {
      teamId,
      cup: { status: { notIn: CUP_DONE_STATUSES } },
    },
    select: { cup: { select: { name: true } } },
  });
  if (activeCup) {
    const name = activeCup.cup?.name ?? "une coupe";
    throw new TeamDeleteError(
      "in_active_cup",
      `Impossible de supprimer : l'équipe est engagée dans la coupe « ${name} » (en cours ou à venir). Retire-la d'abord.`,
    );
  }

  // Soft delete : préserve l'historique des compétitions terminées.
  await prisma.team.update({
    where: { id: teamId },
    data: { deletedAt: new Date() },
  });
}
