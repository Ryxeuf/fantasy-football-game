/**
 * Lecture du bilan d'une équipe TOUTES compétitions (cf. `team-match-stats`
 * pour la règle) : partagée par la fiche d'équipe (`GET /team/:id`) et la
 * page carrière (`GET /career-stats/team/:teamId`), qui ne peuvent donc pas
 * annoncer deux bilans différents.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import {
  buildTeamMatchStats,
  summarizeLocalMatchStats,
  type LeagueCounterSums,
  type LocalMatchStats,
  type TeamMatchStats,
} from "./team-match-stats";

export interface LoadedTeamMatchStats {
  /** Contrat historique : les seuls `LocalMatch` (counts par statut). */
  readonly localMatchStats: LocalMatchStats;
  /** Bilan ligue + coupe + amical. */
  readonly matchStats: TeamMatchStats;
}

export async function loadTeamMatchStats(
  teamId: string,
): Promise<LoadedTeamMatchStats> {
  const localMatches = await prisma.localMatch.findMany({
    where: {
      OR: [{ teamAId: teamId }, { teamBId: teamId }],
    },
    select: {
      id: true,
      status: true,
      teamAId: true,
      teamBId: true,
      scoreTeamA: true,
      scoreTeamB: true,
      cupId: true,
      cupPairingId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // Les rencontres de LIGUE ne passent jamais par `LocalMatch` : leur
  // résultat vit dans les compteurs du participant (ceux du classement).
  // Sans eux, une équipe qui a joué une saison entière affichait 0 match.
  // Enrichissement d'affichage : le bilan se sert sans.
  let leagueSums: LeagueCounterSums | null = null;
  try {
    const aggregate = await prisma.leagueParticipant.aggregate({
      where: { teamId },
      _sum: {
        wins: true,
        draws: true,
        losses: true,
        touchdownsFor: true,
        touchdownsAgainst: true,
      },
    });
    leagueSums = aggregate?._sum ?? null;
  } catch (e: unknown) {
    serverLog.error("[team-match-stats] bilan de ligue", e);
  }

  return {
    localMatchStats: summarizeLocalMatchStats(teamId, localMatches),
    matchStats: buildTeamMatchStats({ teamId, localMatches, leagueSums }),
  };
}
