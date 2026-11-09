/**
 * Suppression d'une saison de ligue par son commissaire (ou un admin).
 *
 * La règle (rien de joué) est PURE : `league-season-deletion-rules`. Ce
 * module ne fait que lire, supprimer et notifier, sur le patron de
 * `competition-lifecycle` (suppression d'une ligue) :
 *
 *   - ligue privée INVISIBLE ⇒ « Saison introuvable » (404), jamais un 403 ;
 *   - destinataires résolus AVANT l'effacement (la cascade emporte les
 *     inscriptions), notifiés APRÈS sa réussite ;
 *   - le Fan Dévoué offert par chaque inscription est repris dans la MÊME
 *     transaction (`withLeagueFreeFansRevokedForSeason`, motif
 *     `season_deleted`) — ou transféré à une inscription d'une autre saison ;
 *   - les invitations EN ATTENTE ciblant la saison sont annulées : la FK
 *     `LeagueInvitation.seasonId` passe à NULL, ce qui les aurait changées en
 *     invitations « toute la ligue » que personne n'a émises.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import {
  LEAGUE_VISIBILITY_SELECT,
  canViewLeagueRow,
  type LeagueVisibilityRow,
} from "./league-access";
import { withLeagueFreeFansRevokedForSeason } from "./league-free-fan";
import { createInAppNotifications } from "./in-app-notifications";
import {
  decideSeasonDeletion,
  EFFECTFUL_SHEET_STATUSES,
  RESULT_PAIRING_STATUSES,
  type SeasonDeletionRefusalCode,
} from "./league-season-deletion-rules";

export type LeagueSeasonDeletionErrorCode =
  | "season_not_found"
  | SeasonDeletionRefusalCode;

export class LeagueSeasonDeletionError extends Error {
  constructor(
    public readonly code: LeagueSeasonDeletionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LeagueSeasonDeletionError";
  }
}

export interface SeasonDeletionActor {
  readonly userId: string;
  readonly isAdmin: boolean;
}

export interface DeleteLeagueSeasonResult {
  readonly deleted: true;
  readonly seasonId: string;
  readonly leagueId: string;
  readonly name: string;
  readonly seasonNumber: number;
  readonly participantsRemoved: number;
  readonly invitationsCancelled: number;
  readonly notified: number;
}

interface SeasonHead {
  readonly id: string;
  readonly name: string;
  readonly seasonNumber: number;
  readonly status: string;
  readonly league: LeagueVisibilityRow & { readonly name: string };
}

/** Comptages des effets persistés, en parallèle (aucun N+1). */
async function countSeasonEffects(seasonId: string) {
  const [validatedSheets, scoredMatches, resultPairings, postMatchSequences] =
    await Promise.all([
      prisma.leagueMatchSheet.count({
        where: {
          pairing: { round: { seasonId } },
          status: { in: [...EFFECTFUL_SHEET_STATUSES] },
        },
      }),
      prisma.match.count({
        where: {
          OR: [
            { leagueSeasonId: seasonId },
            { leaguePairing: { round: { seasonId } } },
          ],
          leagueScoredAt: { not: null },
        },
      }),
      prisma.leaguePairing.count({
        where: {
          round: { seasonId },
          status: { in: [...RESULT_PAIRING_STATUSES] },
        },
      }),
      prisma.leaguePostMatchSequence.count({ where: { seasonId } }),
    ]);
  return { validatedSheets, scoredMatches, resultPairings, postMatchSequences };
}

/** Coachs dont une équipe est inscrite (active) à la saison, dédoublonnés. */
async function listSeasonCoachIds(seasonId: string): Promise<string[]> {
  const rows = (await prisma.leagueParticipant.findMany({
    where: { seasonId, status: "active" },
    select: { team: { select: { ownerId: true } } },
  })) as Array<{ team: { ownerId: string } | null }>;
  return Array.from(
    new Set(
      rows
        .map((r) => r.team?.ownerId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
}

export async function deleteLeagueSeason(input: {
  readonly seasonId: string;
  readonly actor: SeasonDeletionActor;
}): Promise<DeleteLeagueSeasonResult> {
  const { seasonId, actor } = input;
  const season = (await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      name: true,
      seasonNumber: true,
      status: true,
      league: { select: { ...LEAGUE_VISIBILITY_SELECT, name: true } },
    },
  })) as SeasonHead | null;
  if (!season || !(await canViewLeagueRow(season.league, actor))) {
    throw new LeagueSeasonDeletionError("season_not_found", "Saison introuvable");
  }

  const effects = await countSeasonEffects(seasonId);
  const decision = decideSeasonDeletion({
    actor: {
      isCommissioner: season.league.creatorId === actor.userId,
      isAdmin: actor.isAdmin,
    },
    ...effects,
  });
  if (!decision.allowed) {
    throw new LeagueSeasonDeletionError(decision.code, decision.message);
  }

  // Résolus AVANT l'effacement : la cascade emporte les inscriptions.
  const recipients = await listSeasonCoachIds(seasonId);
  const participantsRemoved = await prisma.leagueParticipant.count({
    where: { seasonId },
  });

  const invitationsCancelled = await withLeagueFreeFansRevokedForSeason(
    seasonId,
    async (db) => {
      const cancelled = await db.leagueInvitation.updateMany({
        where: { seasonId, status: "pending" },
        data: { status: "cancelled" },
      });
      await db.leagueSeason.delete({ where: { id: seasonId } });
      return (cancelled as { count: number }).count;
    },
  );

  const actorLabel =
    actor.userId === season.league.creatorId
      ? "par le commissaire"
      : "par un administrateur";
  const notified = await createInAppNotifications(
    recipients.filter((id) => id !== actor.userId),
    {
      kind: "league.season.deleted",
      title: "Saison supprimée",
      body: `La saison « ${season.name} » de la ligue « ${season.league.name} » a été supprimée ${actorLabel}. Votre équipe n'y est plus inscrite.`,
      url: `/leagues/${season.league.id}`,
      meta: {
        leagueId: season.league.id,
        seasonName: season.name,
        seasonNumber: season.seasonNumber,
      },
    },
  );

  serverLog.info(
    `[league-season-deletion] season=${seasonId} (S${season.seasonNumber} "${season.name}", was ${season.status}) of league=${season.league.id} deleted by user=${actor.userId}${actor.isAdmin ? " (admin)" : ""} — ${participantsRemoved} inscription(s), ${invitationsCancelled} invitation(s) annulee(s), ${notified} coach(s) notifie(s)`,
  );
  return {
    deleted: true,
    seasonId,
    leagueId: season.league.id,
    name: season.name,
    seasonNumber: season.seasonNumber,
    participantsRemoved,
    invitationsCancelled,
    notified,
  };
}
