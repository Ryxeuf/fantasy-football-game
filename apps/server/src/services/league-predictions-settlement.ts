/**
 * Pronostics de ligue — règlement, clôture et notification de journée,
 * appelés par la saisie de la feuille et par l'entonnoir des résultats.
 *
 * Module LÉGER (Prisma, journal, notifications internes, règles pures) :
 * `league-match-sheet`, `league-match-result`, `league-offline-edit` et
 * `league-forfeit` l'importent sans rebondir vers `services/league` — ce qui
 * formait un cycle d'import (et cassait les mocks de test) tant que ces
 * fonctions vivaient avec le service exposé aux routes.
 *
 * Tout y est BEST-EFFORT : rien ne lève, le résultat de la rencontre est déjà
 * committé quand on arrive ici.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import { createInAppNotification } from "./in-app-notifications";
import {
  gradePrediction,
  isSettledGrade,
  outcomeOf,
  parsePredictionScope,
  type GradablePrediction,
} from "./league-predictions-rules";

// ---------------------------------------------------------------------------
// Clôture
// ---------------------------------------------------------------------------

/**
 * Pose la clôture d'une rencontre si elle ne l'est pas encore (write-once).
 * Appelé au premier évènement de la feuille, à la première soumission et au
 * résultat. Ne lève JAMAIS.
 */
export async function markPairingPredictionsClosed(
  pairingId: string,
  now: Date = new Date(),
): Promise<boolean> {
  try {
    const out = await prisma.leaguePairing.updateMany({
      where: { id: pairingId, predictionsClosedAt: null },
      data: { predictionsClosedAt: now },
    });
    return out.count > 0;
  } catch (e: unknown) {
    serverLog.error(
      `[league-predictions] clôture non posée pairing=${pairingId}`,
      e,
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Règlement
// ---------------------------------------------------------------------------

export interface ParticipantScore {
  readonly participantId: string;
  readonly score: number;
}

/**
 * Règle les pronostics d'une rencontre dont le résultat vient d'être
 * enregistré (`recordLeagueMatchResult`, entonnoir UNIQUE des résultats de
 * ligue). Copie l'issue et le score réel — jamais des points — et pose la
 * clôture : un résultat vu ne doit pas rouvrir la rencontre après une
 * invalidation.
 *
 * Les côtés se lisent par PARTICIPANT : l'entonnoir parle de « A » et « B »,
 * pas de domicile et d'extérieur. Un forfait en ligne (score synthétique)
 * est réglé `void`. Ne lève JAMAIS.
 */
export async function settleLeaguePredictionsForResult(input: {
  readonly pairingId: string;
  readonly scores: readonly ParticipantScore[];
  readonly forfeit?: boolean;
  readonly now?: Date;
}): Promise<{ readonly settled: number }> {
  const now = input.now ?? new Date();
  try {
    await markPairingPredictionsClosed(input.pairingId, now);
    if (input.forfeit) {
      const out = await prisma.competitionPrediction.updateMany({
        where: { pairingId: input.pairingId },
        data: {
          result: "void",
          resultHomeScore: null,
          resultAwayScore: null,
          settledAt: now,
        },
      });
      return { settled: out.count };
    }
    const pairing = (await prisma.leaguePairing.findUnique({
      where: { id: input.pairingId },
      select: { homeParticipantId: true, awayParticipantId: true },
    })) as { homeParticipantId: string; awayParticipantId: string } | null;
    if (!pairing) return { settled: 0 };
    const home = input.scores.find(
      (s) => s.participantId === pairing.homeParticipantId,
    );
    const away = input.scores.find(
      (s) => s.participantId === pairing.awayParticipantId,
    );
    if (!home || !away) {
      serverLog.warn(
        `[league-predictions] règlement ignoré, côtés introuvables pairing=${input.pairingId}`,
      );
      return { settled: 0 };
    }
    const out = await prisma.competitionPrediction.updateMany({
      where: { pairingId: input.pairingId },
      data: {
        result: outcomeOf(home.score, away.score),
        resultHomeScore: home.score,
        resultAwayScore: away.score,
        settledAt: now,
      },
    });
    return { settled: out.count };
  } catch (e: unknown) {
    serverLog.error(
      `[league-predictions] règlement échoué pairing=${input.pairingId}`,
      e,
    );
    return { settled: 0 };
  }
}

/**
 * Remet en attente les pronostics d'une rencontre dont le résultat est
 * annulé (`reverseOfflineLeagueResult` : invalidation, édition ex-post). La
 * clôture, elle, reste posée. Ne lève JAMAIS.
 */
export async function unsettleLeaguePredictions(
  pairingId: string,
): Promise<{ readonly unsettled: number }> {
  try {
    const out = await prisma.competitionPrediction.updateMany({
      where: { pairingId },
      data: {
        result: null,
        resultHomeScore: null,
        resultAwayScore: null,
        settledAt: null,
      },
    });
    return { unsettled: out.count };
  } catch (e: unknown) {
    serverLog.error(
      `[league-predictions] dérèglement échoué pairing=${pairingId}`,
      e,
    );
    return { unsettled: 0 };
  }
}

// ---------------------------------------------------------------------------
// Notification de journée
// ---------------------------------------------------------------------------

/** Rencontre d'une journée et ses pronostics, pour le bilan de la journée. */
export interface RoundPairingPredictions {
  readonly status: string;
  readonly predictions: ReadonlyArray<
    GradablePrediction & { readonly userId: string }
  >;
}

interface RoundNotificationRow {
  readonly id: string;
  readonly roundNumber: number;
  readonly name: string | null;
  readonly status: string;
  readonly predictionsNotifiedAt: Date | null;
  readonly season: {
    readonly id: string;
    readonly league: {
      readonly id: string;
      readonly name: string;
      readonly predictionsScope: string | null;
    };
  };
  readonly pairings: readonly RoundPairingPredictions[];
}

export interface RoundPredictionSummary {
  readonly userId: string;
  readonly points: number;
  readonly settled: number;
  readonly correct: number;
}

/** Bilan d'une journée par pronostiqueur (pur) : seuls les réglés comptent. */
export function summarizeRoundPredictions(
  pairings: readonly RoundPairingPredictions[],
): RoundPredictionSummary[] {
  const byUser = new Map<string, RoundPredictionSummary>();
  for (const pairing of pairings) {
    for (const row of pairing.predictions) {
      const { grade, points } = gradePrediction(row, pairing.status);
      if (!isSettledGrade(grade)) continue;
      const current = byUser.get(row.userId) ?? {
        userId: row.userId,
        points: 0,
        settled: 0,
        correct: 0,
      };
      byUser.set(row.userId, {
        ...current,
        points: current.points + points,
        settled: current.settled + 1,
        correct:
          current.correct + (grade === "exact" || grade === "outcome" ? 1 : 0),
      });
    }
  }
  return Array.from(byUser.values());
}

function roundLabel(round: { roundNumber: number; name: string | null }): string {
  return round.name?.trim() || `Journée ${round.roundNumber}`;
}

function plural(count: number, word: string): string {
  return count > 1 ? `${word}s` : word;
}

/**
 * Une notification par pronostiqueur quand une journée se complète — au plus
 * UNE fois par journée : `predictionsNotifiedAt` est réclamé avant l'envoi
 * (`updateMany … where null`), si bien qu'une invalidation suivie d'une
 * nouvelle saisie ne renvoie rien. Ne lève JAMAIS.
 */
export async function notifyRoundPredictionResults(
  roundId: string,
  now: Date = new Date(),
): Promise<number> {
  try {
    const round = (await prisma.leagueRound.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        roundNumber: true,
        name: true,
        status: true,
        predictionsNotifiedAt: true,
        season: {
          select: {
            id: true,
            league: {
              select: { id: true, name: true, predictionsScope: true },
            },
          },
        },
        pairings: {
          select: {
            status: true,
            predictions: {
              select: {
                userId: true,
                pick: true,
                homeScore: true,
                awayScore: true,
                result: true,
                resultHomeScore: true,
                resultAwayScore: true,
              },
            },
          },
        },
      },
    })) as RoundNotificationRow | null;
    if (!round || round.status !== "completed" || round.predictionsNotifiedAt) {
      return 0;
    }
    if (parsePredictionScope(round.season.league.predictionsScope) === "off") {
      return 0;
    }
    const summaries = summarizeRoundPredictions(round.pairings);
    if (summaries.length === 0) return 0;

    const claim = await prisma.leagueRound.updateMany({
      where: { id: round.id, predictionsNotifiedAt: null },
      data: { predictionsNotifiedAt: now },
    });
    if (claim.count === 0) return 0;

    const label = roundLabel(round);
    const league = round.season.league;
    const url = `/leagues/${league.id}/seasons/${round.season.id}/predictions`;
    let sent = 0;
    for (const s of summaries) {
      const created = await createInAppNotification({
        userId: s.userId,
        kind: "league.predictions_settled",
        title: `${label} : tes pronostics`,
        body: `${league.name} — ${s.points} ${plural(s.points, "pt")}, ${s.correct} ${plural(s.correct, "bon")} ${plural(s.correct, "résultat")} sur ${s.settled}.`,
        url,
        meta: {
          leagueId: league.id,
          seasonId: round.season.id,
          roundId: round.id,
          points: s.points,
        },
      });
      if (created) sent += 1;
    }
    return sent;
  } catch (e: unknown) {
    serverLog.error(
      `[league-predictions] notification de journée échouée round=${roundId}`,
      e,
    );
    return 0;
  }
}
