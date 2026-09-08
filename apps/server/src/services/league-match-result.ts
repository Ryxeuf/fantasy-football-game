/**
 * L.7 — Integration resultat match online -> ligue.
 *
 * Appele apres la fin d'un match (fin normale ou forfait) pour :
 *  - mettre a jour les compteurs materialises du LeagueParticipant
 *    (wins/draws/losses/points/touchdowns/casualties) en une seule
 *    transaction,
 *  - marquer `Match.leagueScoredAt` pour empecher la double comptabilisation,
 *  - promouvoir le round en "completed" quand toutes ses rencontres sont
 *    reportees, et demarrer les playoffs quand la phase reguliere s'acheve.
 *
 * La SAISON, elle, n'est jamais cloturee ici : sa cloture est un acte du
 * commissaire (`closeSeason`, `POST /leagues/seasons/:id/close`). Quand le
 * dernier resultat fermait la saison de lui-meme, une erreur de saisie sur
 * ce dernier match devenait definitive (« Reversion impossible:
 * season-completed »). Le resultat expose `seasonReadyToClose` pour que
 * l'UI invite le commissaire a cloturer.
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
import { runPostMatchLeagueSequence } from "./post-match-league-sequence";
import {
  startPlayoffs,
  advancePlayoffsWithWinner,
} from "./league-playoffs";
import {
  evaluateBonusRules,
  parseBonusConfig,
  type MatchBonusContext,
} from "./league-bonus-points";
import { serverLog } from "../utils/server-log";

export interface RecordMatchResultInput {
  readonly matchId: string;
  readonly scoreA: number;
  readonly scoreB: number;
  readonly casualtiesA: number;
  readonly casualtiesB: number;
  /**
   * Si true, ne fait PAS evoluer le `seasonElo` des participants. Utilise par
   * les saisies offline : un resultat saisi a la main (systeme de confiance)
   * ne doit pas alimenter un rating ELO. Le snapshot retourne alors des deltas
   * nuls (oldRating === newRating).
   */
  readonly skipSeasonElo?: boolean;
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
      /**
       * Toutes les journees (playoffs compris) sont jouees : la saison
       * reste `in_progress` et attend la cloture du commissaire.
       */
      readonly seasonReadyToClose: boolean;
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
      leaguePairingId: true,
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
              // Lot E — config bonus utilisee plus bas pour
              // calculer un delta supplementaire de points.
              bonusPointsConfig: true,
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
  const basePointsA = pointsFor(winner, "A", bareme);
  const basePointsB = pointsFor(winner, "B", bareme);

  // Lot E — applique les regles de bonus configurees au niveau de
  // la ligue. Le cote "A" = home pour le scoring du pairing
  // (convention historique du modele).
  //
  // Les points bonus ne sont PAS ajoutes aux points generiques
  // (`LeagueParticipant.points` reste le bareme win/draw/loss pur) :
  // ils sont snapshotes sur le pairing (`bonusPointsHome/Away`) et
  // exposes au classement dans la colonne dediee `Bo`.
  const bonusRules = parseBonusConfig(
    (bareme as { bonusPointsConfig?: unknown }).bonusPointsConfig,
  );
  const bonusCtx: MatchBonusContext = {
    tdsHome: input.scoreA,
    tdsAway: input.scoreB,
    casualtiesInflictedHome: input.casualtiesA,
    casualtiesInflictedAway: input.casualtiesB,
    winner: winner === "A" ? "home" : winner === "B" ? "away" : "draw",
  };
  const bonus = evaluateBonusRules(bonusRules, bonusCtx);

  // L.8 — ELO saisonnier : calcul des deltas en utilisant le K-factor de
  // placement (48) tant que le participant n'a pas joue 5 matchs, sinon 32.
  // Le snapshot est calcule AVANT la mise a jour des compteurs, d'ou l'etat
  // de placement base sur (wins+draws+losses) courant.
  const placementA = isInPlacement(participantA);
  const placementB = isInPlacement(participantB);
  const seasonOutcome: SeasonMatchOutcome =
    winner === "A" ? "win" : winner === "B" ? "loss" : "draw";
  // skipSeasonElo (saisie offline) : on neutralise le delta -> seasonElo
  // inchange (l'ecriture `seasonElo: old` plus bas est alors un no-op).
  const { deltaA: seasonDeltaA, deltaB: seasonDeltaB } = input.skipSeasonElo
    ? { deltaA: 0, deltaB: 0 }
    : calculateSeasonEloChange({
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
      points: { increment: basePointsA },
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
      points: { increment: basePointsB },
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

  // L2.A.5 — Si le match est rattache a un pairing pre-genere du
  // calendrier round-robin, on bascule le pairing en `played` dans la
  // meme transaction. Sans pairing (matchs Sprint 17 attaches a la
  // main via `attachMatch`), on conserve le comportement legacy.
  const updates =
    match.leaguePairingId !== null && match.leaguePairingId !== undefined
      ? [
          updateA,
          updateB,
          markMatch,
          prisma.leaguePairing.update({
            where: { id: match.leaguePairingId },
            data: {
              status: "played",
              // Lot E — snapshot des bonus appliques (audit / UI).
              bonusPointsHome: bonus.homeBonus,
              bonusPointsAway: bonus.awayBonus,
              bonusBreakdown:
                bonus.applied.length > 0
                  ? (bonus.applied as unknown as Record<string, unknown>[])
                  : null,
            },
          }),
        ]
      : [updateA, updateB, markMatch];
  await prisma.$transaction(updates);

  let roundCompleted = false;
  let seasonReadyToClose = false;

  if (match.leagueRoundId) {
    // L2.A.5 — La completion du round se base desormais sur les
    // pairings (nouveau modele) plutot que sur les matchs : un round
    // est complet quand TOUS ses pairings sont dans un etat terminal
    // (`played`, `forfeit_home`, `forfeit_away`, `cancelled`). Pour les
    // saisons legacy sans pairing (Sprint 17), aucune ligne ne sera
    // trouvee et on retombe sur le compteur historique base matchs.
    const pendingPairings = await prisma.leaguePairing.count({
      where: {
        roundId: match.leagueRoundId,
        status: { in: ["scheduled", "in_progress"] },
      },
    });
    const totalPairings = await prisma.leaguePairing.count({
      where: { roundId: match.leagueRoundId },
    });
    const pending =
      totalPairings > 0
        ? pendingPairings
        : await prisma.match.count({
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
        // L2.C.3 — playoffs : si la saison a `playoffSize > 0` et
        // qu'aucun round playoff n'a encore ete cree, on declenche
        // le bracket. Dans tous les cas la saison reste `in_progress` :
        // seul le commissaire la cloture.
        const seasonRow = await prisma.leagueSeason.findUnique({
          where: { id: seasonId },
          select: { playoffSize: true },
        });
        const playoffSize: number = seasonRow?.playoffSize ?? 0;
        const playoffRoundsExisting = await prisma.leagueRound.count({
          where: { seasonId, kind: "playoff" },
        });
        if (playoffSize > 0 && playoffRoundsExisting === 0) {
          // Demarre les playoffs ; la saison reste in_progress.
          startPlayoffs(seasonId).catch((e: unknown) => {
            const msg = e instanceof Error ? e.message : "unknown";
            serverLog.error(
              `[league-playoffs] startPlayoffs failed: ${msg}`,
            );
          });
        } else {
          // Toutes les journees sont jouees : la saison RESTE `in_progress`.
          // La cloture (classement fige, palmares, cloture thematique) est
          // un acte du commissaire — cf. `closeSeason`. Cloturer ici rendait
          // le dernier resultat non-invalidable (`season-completed`).
          seasonReadyToClose = true;
          serverLog.info(
            `[league-match-result] season=${seasonId} all rounds completed, awaiting commissioner closure`,
          );
        }
      }
    }
  }

  // L2.C.3 — propagation du winner dans le bracket playoff. Si le
  // pairing termine est un pairing playoff (kind="playoff"), on
  // avance le winner dans le slot suivant. Echec non-bloquant.
  if (match.leaguePairingId && winner !== "draw") {
    const winnerSide: "home" | "away" = winner === "A" ? "home" : "away";
    advancePlayoffsWithWinner(match.leaguePairingId, winnerSide).catch(
      (e: unknown) => {
        const msg = e instanceof Error ? e.message : "unknown";
        serverLog.error(`[league-playoffs] advance failed: ${msg}`);
      },
    );
  }

  // L2.B.2b — fire-and-forget : cree la LeaguePostMatchSequence pour
  // alimenter les pendingChoices de level-up. Non-bloquant : un echec
  // ici ne doit pas casser la comptabilisation deja transactionnelle
  // ci-dessus (winners/points/ELO/match.leagueScoredAt).
  runPostMatchLeagueSequence({ matchId: match.id })
    .then((r) => {
      if ("created" in r && r.created) {
        serverLog.info(
          `[league-match-result] post-match sequence created: matchId=${match.id} status=${r.status} pending=${r.pendingChoices.length}`,
        );
      }
    })
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "unknown";
      serverLog.error(
        `[league-match-result] post-match sequence failed: ${msg}`,
      );
    });

  return {
    recorded: true,
    winner,
    pointsDelta: { teamA: basePointsA, teamB: basePointsB },
    roundCompleted,
    seasonReadyToClose,
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
