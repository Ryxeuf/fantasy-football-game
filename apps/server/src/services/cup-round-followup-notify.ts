/**
 * Relance d'une ronde de COUPE (bouton « Relancer » du commissaire).
 *
 * Mêmes règles que la journée d'une ligue (`league-round-followup`, pur) et
 * même envoi (`dispatchRoundFollowups`) : seuls changent le chargement (une
 * rencontre de coupe porte ses équipes, et un exempt n'a personne à
 * relancer), les liens et le vocabulaire (« ronde »).
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import { selectReminderTargets } from "./league-round-followup";
import {
  dispatchRoundFollowups,
  type ReminderRunResult,
  type SideRow,
} from "./league-round-followup-notify";
import { CupRoundError, type CupActor } from "./cup-rounds";

const TEAM_SELECT = {
  select: {
    ownerId: true,
    name: true,
    owner: { select: { coachName: true, email: true } },
  },
} as const;

interface CupFollowupPairingRow {
  id: string;
  status: string;
  scheduledAt: Date | null;
  matchSheet: { status: string } | null;
  homeTeam: SideRow["team"];
  awayTeam: SideRow["team"] | null;
}

export async function sendCupRoundFollowups(input: {
  readonly roundId: string;
  readonly actor: CupActor;
  readonly baseUrl?: string | null;
  readonly now?: Date;
}): Promise<ReminderRunResult> {
  const round = (await prisma.cupRound.findUnique({
    where: { id: input.roundId },
    select: {
      id: true,
      roundNumber: true,
      cup: { select: { id: true, name: true, creatorId: true } },
      pairings: {
        orderBy: { tableNumber: "asc" },
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          matchSheet: { select: { status: true } },
          homeTeam: TEAM_SELECT,
          awayTeam: TEAM_SELECT,
        },
      },
    },
  })) as {
    id: string;
    roundNumber: number;
    cup: { id: string; name: string; creatorId: string };
    pairings: CupFollowupPairingRow[];
  } | null;
  if (!round) throw new CupRoundError("round_not_found", "Ronde introuvable");
  if (!input.actor.isAdmin && round.cup.creatorId !== input.actor.userId) {
    throw new CupRoundError(
      "forbidden",
      "Seul le commissaire de la coupe peut relancer une ronde",
    );
  }

  // Un exempt n'a pas de rencontre à jouer : personne à relancer.
  const pairings = round.pairings.filter(
    (p): p is CupFollowupPairingRow & { awayTeam: SideRow["team"] } =>
      p.awayTeam !== null,
  );
  const targets = selectReminderTargets(
    pairings.map((p) => ({ ...p, matchSheetStatus: p.matchSheet?.status ?? null })),
    input.now ?? new Date(),
  );

  const anchor = `/cups/${round.cup.id}#ronde-${round.roundNumber}`;
  const { reminders, coachesNotified } = await dispatchRoundFollowups({
    competition: "cup",
    competitionName: round.cup.name,
    roundId: round.id,
    roundNumber: round.roundNumber,
    inAppUrl: anchor,
    emailUrl: input.baseUrl ? `${input.baseUrl.replace(/\/+$/, "")}${anchor}` : null,
    meta: { cupId: round.cup.id },
    targets: targets.map(({ pairing, reason }) => ({
      pairingId: pairing.id,
      reason,
      home: { team: pairing.homeTeam },
      away: { team: pairing.awayTeam },
    })),
  });

  serverLog.info(
    `[cup-round-followup] round=${round.id} (R${round.roundNumber}) — ` +
      `${reminders.length}/${pairings.length} rencontre(s) relancée(s), ` +
      `${coachesNotified} coach(s) prévenu(s)`,
  );

  return {
    roundId: round.id,
    roundNumber: round.roundNumber,
    leagueId: round.cup.id,
    reminders,
    coachesNotified,
    pairingsChecked: pairings.length,
  };
}
