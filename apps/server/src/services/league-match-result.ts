/**
 * L.7 — Integration resultat match online -> ligue.
 *
 * Appele apres la fin d'un match (fin normale ou forfait) pour :
 *  - mettre a jour les compteurs materialises du LeagueParticipant
 *    (wins/draws/losses/points/touchdowns/casualties) en une seule
 *    transaction,
 *  - marquer `Match.leagueScoredAt` pour empecher la double comptabilisation,
 *  - promouvoir le round puis la saison en "completed" quand toutes les
 *    rencontres sont reportees.
 *
 * Ne fait rien pour les matchs non rattaches a une ligue : une ligue doit
 * avoir ete creee, une saison ouverte et des rounds planifies (L.3/L.4) et
 * le match doit porter `leagueSeasonId` (defini au moment de l'appariement).
 *
 * Contrats :
 *  - Idempotent : si `leagueScoredAt` est deja renseigne, on ignore.
 *  - Tolerant : si un participant a ete retire (withdrawn / supprime) entre
 *    temps, on n'ecrit rien (resultat neutre) plutot que de crasher.
 */

import { prisma } from "../prisma";
import {
  calculateSeasonEloChange,
  clampSeasonElo,
  isInPlacement,
  type SeasonMatchOutcome,
} from "./season-elo";

export interface RecordMatchResultInput {
  readonly matchId: string;
  readonly scoreA: number;
  readonly scoreB: number;
  readonly casualtiesA: number;
  readonly casualtiesB: number;
}

export type MatchWinner = "A" | "B" | "draw";

export interface SeasonEloSnapshot {
  readonly oldRatingA: number;
  readonly oldRatingB: number;
  readonly newRatingA: number;
  readonly newRatingB: number;
  readonly deltaA: number;
  readonly deltaB: number;
  readonly placementA: boolean;
  readonly placementB: boolean;
}

export type RecordMatchResultOutcome =
  | {
      readonly recorded: true;
      readonly winner: MatchWinner;
      readonly pointsDelta: { readonly teamA: number; readonly teamB: number };
      readonly roundCompleted: boolean;
      readonly seasonCompleted: boolean;
      readonly seasonElo: SeasonEloSnapshot;
    }
  | {
      readonly skipped: true;
      readonly reason:
        | "not-a-league-match"
        | "already-scored"
        | "participant-missing"
        | "match-missing";
    };

function computeWinner(scoreA: number, scoreB: number): MatchWinner {
  if (scoreA > scoreB) return "A";
  if (scoreB > scoreA) return "B";
  return "draw";
}

interface LeaguePointsBareme {
  readonly winPoints: number;
  readonly drawPoints: number;
  readonly lossPoints: number;
}

function pointsFor(winner: MatchWinner, side: "A" | "B", b: LeaguePointsBareme) {
  if (winner === "draw") return b.drawPoints;
  return winner === side ? b.winPoints : b.lossPoints;
}

export async function recordLeagueMatchResult(
  input: RecordMatchResultInput,
): Promise<RecordMatchResultOutcome> {
  const match = await prisma.match.findUnique({
    where: { id: input.matchId },
    select: {
      id: true,
      leagueSeasonId: true,
      leagueRoundId: true,
      leagueScoredAt: true,
      leagueSeason: {
        select: {
          id: true,
          leagueId: true,
          league: {
            select: {
              winPoints: true,
              drawPoints: true,
              lossPoints: true,
            },
          },
        },
      },
    },
  });

  if (!match) {
    return { skipped: true, reason: "match-missing" };
  }
  if (!match.leagueSeasonId || !match.leagueSeason) {
    return { skipped: true, reason: "not-a-league-match" };
  }
  if (match.leagueScoredAt) {
    return { skipped: true, reason: "already-scored" };
  }

  const selections = await prisma.teamSelection.findMany({
    where: { matchId: match.id },
    orderBy: { createdAt: "asc" },
    select: { teamId: true, userId: true },
  });
  const teamAId = selections[0]?.teamId ?? null;
  const teamBId = selections[1]?.teamId ?? null;
  if (!teamAId || !teamBId) {
    return { skipped: true, reason: "participant-missing" };
  }

  const seasonId = match.leagueSeasonId;
  const participantSelect = {
    id: true,
    teamId: true,
    seasonElo: true,
    wins: true,
    draws: true,
    losses: true,
  } as const;
  const [participantA, participantB] = await Promise.all([
    prisma.leagueParticipant.findUnique({
      where: { seasonId_teamId: { seasonId, teamId: teamAId } },
      select: participantSelect,
    }),
    prisma.leagueParticipant.findUnique({
      where: { seasonId_teamId: { seasonId, teamId: teamBId } },
      select: participantSelect,
    }),
  ]);

  if (!participantA || !participantB) {
    return { skipped: true, reason: "participant-missing" };
  }

  const bareme = match.leagueSeason.league;
  const winner = computeWinner(input.scoreA, input.scoreB);
  const pointsA = pointsFor(winner, "A", bareme);
  const pointsB = pointsFor(winner, "B", bareme);

  // L.8 — ELO saisonnier : calcul des deltas en utilisant le K-factor de
  // placement (48) tant que le participant n'a pas joue 5 matchs, sinon 32.
  // Le snapshot est calcule AVANT la mise a jour des compteurs, d'ou l'etat
  // de placement base sur (wins+draws+losses) courant.
  const placementA = isInPlacement(participantA);
  const placementB = isInPlacement(participantB);
  const seasonOutcome: SeasonMatchOutcome =
    winner === "A" ? "win" : winner === "B" ? "loss" : "draw";
  const { deltaA: seasonDeltaA, deltaB: seasonDeltaB } =
    calculateSeasonEloChange({
      ratingA: participantA.seasonElo,
      ratingB: participantB.seasonElo,
      outcome: seasonOutcome,
      inPlacementA: placementA,
      inPlacementB: placementB,
    });
  const newSeasonEloA = clampSeasonElo(participantA.seasonElo + seasonDeltaA);
  const newSeasonEloB = clampSeasonElo(participantB.seasonElo + seasonDeltaB);

  const updateA = prisma.leagueParticipant.update({
    where: { id: participantA.id },
    data: {
      wins: { increment: winner === "A" ? 1 : 0 },
      draws: { increment: winner === "draw" ? 1 : 0 },
      losses: { increment: winner === "B" ? 1 : 0 },
      points: { increment: pointsA },
      touchdownsFor: { increment: input.scoreA },
      touchdownsAgainst: { increment: input.scoreB },
      casualtiesFor: { increment: input.casualtiesA },
      casualtiesAgainst: { increment: input.casualtiesB },
      seasonElo: newSeasonEloA,
    },
  });

  const updateB = prisma.leagueParticipant.update({
    where: { id: participantB.id },
    data: {
      wins: { increment: winner === "B" ? 1 : 0 },
      draws: { increment: winner === "draw" ? 1 : 0 },
      losses: { increment: winner === "A" ? 1 : 0 },
      points: { increment: pointsB },
      touchdownsFor: { increment: input.scoreB },
      touchdownsAgainst: { increment: input.scoreA },
      casualtiesFor: { increment: input.casualtiesB },
      casualtiesAgainst: { increment: input.casualtiesA },
      seasonElo: newSeasonEloB,
    },
  });

  const markMatch = prisma.match.update({
    where: { id: match.id },
    data: { leagueScoredAt: new Date() },
  });

  await prisma.$transaction([updateA, updateB, markMatch]);

  let roundCompleted = false;
  let seasonCompleted = false;

  if (match.leagueRoundId) {
    const pending = await prisma.match.count({
      where: {
        leagueRoundId: match.leagueRoundId,
        leagueScoredAt: null,
      },
    });
    if (pending === 0) {
      await prisma.leagueRound.update({
        where: { id: match.leagueRoundId },
        data: { status: "completed" },
      });
      roundCompleted = true;

      const remainingRounds = await prisma.leagueRound.findMany({
        where: { seasonId, status: { not: "completed" } },
        select: { id: true },
      });
      if (remainingRounds.length === 0) {
        await prisma.leagueSeason.update({
          where: { id: seasonId },
          data: { status: "completed" },
        });
        seasonCompleted = true;
      }
    }
  }

  return {
    recorded: true,
    winner,
    pointsDelta: { teamA: pointsA, teamB: pointsB },
    roundCompleted,
    seasonCompleted,
    seasonElo: {
      oldRatingA: participantA.seasonElo,
      oldRatingB: participantB.seasonElo,
      newRatingA: newSeasonEloA,
      newRatingB: newSeasonEloB,
      deltaA: newSeasonEloA - participantA.seasonElo,
      deltaB: newSeasonEloB - participantB.seasonElo,
      placementA,
      placementB,
    },
  };
}
