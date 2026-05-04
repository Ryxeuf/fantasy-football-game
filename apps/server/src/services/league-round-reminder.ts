/**
 * L2.A.12 — Notification "Vous avez ete apparie pour la J{n}".
 *
 * Sprint Ligues v2 PR3 : helper appele apres `startSeason` (et
 * `regenerateSchedule`) pour avertir chaque coach implique dans un
 * pairing du round 1. Lit les pairings nouvellement crees, deduit
 * (homeOwnerId, awayOwnerId) via les LeagueParticipants -> Team
 * -> Owner, puis declenche un push fire-and-forget par coach.
 *
 * Le push lui-meme respecte la preference utilisateur
 * `leagueRoundReminderNotification` (cf. push-notifications.ts).
 *
 * Idempotence : appeler ce service plusieurs fois pour la meme saison
 * envoie plusieurs notifications (les push n'ont pas de dedup natif).
 * Pour eviter le spam en cas de regenerate, le caller (`league-
 * scheduler.regenerateSchedule`) decide s'il appelle.
 *
 * Erreurs : on log mais on ne propage pas. La notification est un
 * effet secondaire — son echec ne doit jamais bloquer le startSeason.
 */

import { prisma } from "../prisma";
import { sendLeagueRoundReminderPush } from "./push-notifications";
import { serverLog } from "../utils/server-log";

export interface NotifySeasonStartedInput {
  readonly seasonId: string;
  /**
   * Numero du round dont les pairings sont notifies. Default : 1
   * (premier round, c'est le cas standard de `startSeason`).
   */
  readonly roundNumber?: number;
}

export interface NotifySeasonStartedOutcome {
  readonly notified: number;
}

interface PairingForNotification {
  id: string;
  deadlineAt: Date | null;
  homeParticipant: {
    team: {
      ownerId: string;
      owner: { coachName: string | null };
    };
  };
  awayParticipant: {
    team: {
      ownerId: string;
      owner: { coachName: string | null };
    };
  };
}

export async function notifyParticipantsOfFirstRound(
  input: NotifySeasonStartedInput,
): Promise<NotifySeasonStartedOutcome> {
  const targetRoundNumber = input.roundNumber ?? 1;

  const season = await prisma.leagueSeason.findUnique({
    where: { id: input.seasonId },
    select: { id: true, leagueId: true },
  });
  if (!season) {
    return { notified: 0 };
  }

  const round = await prisma.leagueRound.findUnique({
    where: {
      seasonId_roundNumber: {
        seasonId: input.seasonId,
        roundNumber: targetRoundNumber,
      },
    },
    select: { id: true },
  });
  if (!round) {
    return { notified: 0 };
  }

  const pairings = (await prisma.leaguePairing.findMany({
    where: { roundId: round.id, status: "scheduled" },
    select: {
      id: true,
      deadlineAt: true,
      homeParticipant: {
        select: {
          team: {
            select: {
              ownerId: true,
              owner: { select: { coachName: true } },
            },
          },
        },
      },
      awayParticipant: {
        select: {
          team: {
            select: {
              ownerId: true,
              owner: { select: { coachName: true } },
            },
          },
        },
      },
    },
  })) as PairingForNotification[];

  let notified = 0;
  for (const p of pairings) {
    const homeOwnerId = p.homeParticipant.team.ownerId;
    const awayOwnerId = p.awayParticipant.team.ownerId;
    const homeCoach = p.homeParticipant.team.owner.coachName ?? "Coach";
    const awayCoach = p.awayParticipant.team.owner.coachName ?? "Coach";

    sendLeagueRoundReminderPush({
      userId: homeOwnerId,
      leagueId: season.leagueId,
      seasonId: input.seasonId,
      opponentCoachName: awayCoach,
      roundNumber: targetRoundNumber,
      deadlineAt: p.deadlineAt,
    });
    sendLeagueRoundReminderPush({
      userId: awayOwnerId,
      leagueId: season.leagueId,
      seasonId: input.seasonId,
      opponentCoachName: homeCoach,
      roundNumber: targetRoundNumber,
      deadlineAt: p.deadlineAt,
    });
    notified += 2;
  }

  serverLog.info(
    `[league-round-reminder] season=${input.seasonId} round=${targetRoundNumber} notified=${notified}`,
  );

  return { notified };
}
