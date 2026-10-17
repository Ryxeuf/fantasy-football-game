/**
 * Pronostics de COUPE — clôture, règlement et bilan de ronde, appelés par
 * la feuille de match de coupe et les rondes. Pendant de
 * `league-predictions-settlement`, avec les mêmes règles pures.
 *
 * Module LÉGER (Prisma, journal, notifications internes, règles pures) :
 * `league-match-sheet` et `cup-rounds` l'importent sans cycle. Tout y est
 * BEST-EFFORT : rien ne lève, le résultat de la rencontre est déjà committé.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import { createInAppNotification } from "./in-app-notifications";
import { outcomeOf, parsePredictionScope } from "./league-predictions-rules";
import {
  summarizeRoundPredictions,
  type RoundPairingPredictions,
} from "./league-predictions-settlement";

/**
 * Pose la clôture d'une rencontre de coupe si elle ne l'est pas encore
 * (write-once). Premier évènement, première soumission, résultat. Ne lève
 * JAMAIS.
 */
export async function markCupPairingPredictionsClosed(
  cupPairingId: string,
  now: Date = new Date(),
): Promise<boolean> {
  try {
    const out = await prisma.cupPairing.updateMany({
      where: { id: cupPairingId, predictionsClosedAt: null },
      data: { predictionsClosedAt: now },
    });
    return out.count > 0;
  } catch (e: unknown) {
    serverLog.error(
      `[cup-predictions] clôture non posée pairing=${cupPairingId}`,
      e,
    );
    return false;
  }
}

/**
 * Règle les pronostics d'une rencontre de coupe validée : copie l'issue et
 * le score réel (jamais des points), et pose la clôture. Un forfait est
 * réglé `void` : l'issue n'est pas un résultat de terrain. Ne lève JAMAIS.
 */
export async function settleCupPredictionsForResult(input: {
  readonly cupPairingId: string;
  readonly scoreHome: number;
  readonly scoreAway: number;
  readonly forfeit?: boolean;
  readonly now?: Date;
}): Promise<{ readonly settled: number }> {
  const now = input.now ?? new Date();
  try {
    await markCupPairingPredictionsClosed(input.cupPairingId, now);
    const out = await prisma.competitionPrediction.updateMany({
      where: { cupPairingId: input.cupPairingId },
      data: input.forfeit
        ? { result: "void", resultHomeScore: null, resultAwayScore: null, settledAt: now }
        : {
            result: outcomeOf(input.scoreHome, input.scoreAway),
            resultHomeScore: input.scoreHome,
            resultAwayScore: input.scoreAway,
            settledAt: now,
          },
    });
    return { settled: out.count };
  } catch (e: unknown) {
    serverLog.error(
      `[cup-predictions] règlement échoué pairing=${input.cupPairingId}`,
      e,
    );
    return { settled: 0 };
  }
}

/**
 * Remet en attente les pronostics d'une rencontre de coupe dont la feuille
 * est invalidée. La clôture, elle, reste posée : le résultat a été vu.
 * Ne lève JAMAIS.
 */
export async function unsettleCupPredictions(
  cupPairingId: string,
): Promise<{ readonly unsettled: number }> {
  try {
    const out = await prisma.competitionPrediction.updateMany({
      where: { cupPairingId },
      data: { result: null, resultHomeScore: null, resultAwayScore: null, settledAt: null },
    });
    return { unsettled: out.count };
  } catch (e: unknown) {
    serverLog.error(
      `[cup-predictions] dérèglement échoué pairing=${cupPairingId}`,
      e,
    );
    return { unsettled: 0 };
  }
}

interface CupRoundNotificationRow {
  readonly id: string;
  readonly roundNumber: number;
  readonly name: string | null;
  readonly status: string;
  readonly predictionsNotifiedAt: Date | null;
  readonly cup: {
    readonly id: string;
    readonly name: string;
    readonly predictionsScope: string | null;
  };
  readonly pairings: readonly RoundPairingPredictions[];
}

function plural(count: number, word: string): string {
  return count > 1 ? `${word}s` : word;
}

/**
 * Bilan d'une ronde complétée : une notification par pronostiqueur, au plus
 * UNE fois (`predictionsNotifiedAt` réclamé avant l'envoi). Ne lève JAMAIS.
 */
export async function notifyCupRoundPredictionResults(
  roundId: string,
  now: Date = new Date(),
): Promise<number> {
  try {
    const round = (await prisma.cupRound.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        roundNumber: true,
        name: true,
        status: true,
        predictionsNotifiedAt: true,
        cup: { select: { id: true, name: true, predictionsScope: true } },
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
    })) as CupRoundNotificationRow | null;
    if (!round || round.status !== "completed" || round.predictionsNotifiedAt) {
      return 0;
    }
    if (parsePredictionScope(round.cup.predictionsScope) === "off") return 0;
    const summaries = summarizeRoundPredictions(round.pairings);
    if (summaries.length === 0) return 0;

    const claim = await prisma.cupRound.updateMany({
      where: { id: round.id, predictionsNotifiedAt: null },
      data: { predictionsNotifiedAt: now },
    });
    if (claim.count === 0) return 0;

    const label = round.name?.trim() || `Ronde ${round.roundNumber}`;
    const url = `/cups/${round.cup.id}/predictions`;
    let sent = 0;
    for (const s of summaries) {
      const created = await createInAppNotification({
        userId: s.userId,
        kind: "cup.predictions_settled",
        title: `${label} : tes pronostics`,
        body: `${round.cup.name} — ${s.points} ${plural(s.points, "pt")}, ${s.correct} ${plural(s.correct, "bon")} ${plural(s.correct, "résultat")} sur ${s.settled}.`,
        url,
        meta: { cupId: round.cup.id, roundId: round.id, points: s.points },
      });
      if (created) sent += 1;
    }
    return sent;
  } catch (e: unknown) {
    serverLog.error(
      `[cup-predictions] bilan de ronde échoué round=${roundId}`,
      e,
    );
    return 0;
  }
}

/** Bilan de la ronde d'une rencontre (après sa validation ou son annulation). */
export async function notifyCupRoundPredictionResultsForPairing(
  cupPairingId: string,
): Promise<number> {
  try {
    const pairing = (await prisma.cupPairing.findUnique({
      where: { id: cupPairingId },
      select: { roundId: true },
    })) as { roundId: string } | null;
    return pairing ? await notifyCupRoundPredictionResults(pairing.roundId) : 0;
  } catch (e: unknown) {
    serverLog.error(
      `[cup-predictions] ronde introuvable pairing=${cupPairingId}`,
      e,
    );
    return 0;
  }
}
