/**
 * Retrait d'une équipe d'une saison de ligue par son commissaire (ou un
 * admin), en cours de saison. Décision dans
 * `league-commissioner-withdrawal-rules` (pur) ; ici : chargement, écriture,
 * notification, journal.
 *
 * Le retrait réutilise `withdrawParticipant({ force: true })` : même statut
 * `withdrawn`, même reprise du Fan Dévoué offert par l'inscription
 * (`withLeagueFreeFanRevoked`). Les rencontres restantes passent ensuite par
 * le service de forfait existant (`recordForfeit` : barème de la ligue,
 * clôture de journée, avancement du bracket) ou sont annulées.
 *
 * Ordre : le statut d'abord. Un forfait peut compléter la dernière journée
 * et déclencher la génération du bracket (`maybeCompleteRoundAndSeason`) :
 * l'équipe doit déjà en être exclue (`resolveSeeds` ignore les retirés).
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import { withdrawParticipant } from "./league";
import { maybeCompleteRoundAndSeason, recordForfeit } from "./league-forfeit";
import { createInAppNotification } from "./in-app-notifications";
import {
  decideCommissionerWithdrawal,
  type CommissionerWithdrawalRefusal,
  type RemainingPairingsPolicy,
} from "./league-commissioner-withdrawal-rules";
import {
  PLAYOFF_PAIRING_STATE_SELECT,
  toPlayoffPairingState,
  type PlayoffPairingRow,
} from "./league-playoff-edit";

export type CommissionerWithdrawalErrorCode =
  | "season_not_found"
  | CommissionerWithdrawalRefusal;

export class CommissionerWithdrawalError extends Error {
  constructor(
    public readonly code: CommissionerWithdrawalErrorCode,
    message: string,
    public readonly engagedPairingIds?: readonly string[],
  ) {
    super(message);
    this.name = "CommissionerWithdrawalError";
  }
}

export interface CommissionerWithdrawalActor {
  readonly userId: string;
  readonly isAdmin: boolean;
}

export interface CommissionerWithdrawalInput {
  readonly seasonId: string;
  readonly participantId: string;
  readonly remaining: RemainingPairingsPolicy;
}

export interface CommissionerWithdrawalOutcome {
  readonly participantId: string;
  readonly teamId: string;
  readonly remaining: RemainingPairingsPolicy;
  /** Rencontres perdues par forfait par l'équipe retirée. */
  readonly forfeited: readonly string[];
  readonly cancelled: readonly string[];
  /** Forfaits non enregistrés (rencontre close entre-temps…). */
  readonly skipped: readonly string[];
  /** Placeholders de bracket à régler par « Remplacer une équipe ». */
  readonly placeholders: readonly string[];
}

const OPEN_STATUSES = ["scheduled", "in_progress"];

export async function withdrawParticipantByCommissioner(
  input: CommissionerWithdrawalInput,
  actor: CommissionerWithdrawalActor,
): Promise<CommissionerWithdrawalOutcome> {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: input.seasonId },
    select: {
      id: true,
      status: true,
      league: { select: { id: true, name: true, creatorId: true } },
    },
  });
  if (!season) {
    throw new CommissionerWithdrawalError(
      "season_not_found",
      "Saison introuvable",
    );
  }

  const [participant, pairingRows] = await Promise.all([
    prisma.leagueParticipant.findUnique({
      where: { id: input.participantId },
      select: {
        id: true,
        seasonId: true,
        status: true,
        teamId: true,
        team: { select: { name: true, ownerId: true } },
      },
    }),
    prisma.leaguePairing.findMany({
      where: {
        round: { seasonId: input.seasonId },
        status: { in: OPEN_STATUSES },
        OR: [
          { homeParticipantId: input.participantId },
          { awayParticipantId: input.participantId },
        ],
      },
      select: {
        ...PLAYOFF_PAIRING_STATE_SELECT,
        roundId: true,
        round: { select: { kind: true, bracketSlot: true } },
      },
    }) as unknown as Promise<
      Array<
        PlayoffPairingRow & {
          roundId: string;
          round: { kind: string; bracketSlot: string | null };
        }
      >
    >,
  ]);

  const decision = decideCommissionerWithdrawal({
    isCommissioner: season.league.creatorId === actor.userId,
    isAdmin: actor.isAdmin,
    seasonId: input.seasonId,
    seasonStatus: season.status,
    participant,
    remaining: input.remaining,
    openPairings: pairingRows.map((row) => ({
      ...toPlayoffPairingState(row),
      roundId: row.roundId,
      isBracket: row.round.kind === "playoff" || row.round.bracketSlot !== null,
    })),
  });
  if (!decision.ok) {
    throw new CommissionerWithdrawalError(
      decision.code,
      decision.message,
      decision.engagedPairingIds,
    );
  }
  // `participant` est non nul : la décision l'a vérifié.
  const registered = participant as NonNullable<typeof participant>;
  const { plan } = decision;

  await withdrawParticipant({
    seasonId: input.seasonId,
    teamId: registered.teamId,
    force: true,
  });

  const cancelled: string[] = [];
  if (plan.cancel.length > 0) {
    await prisma.leaguePairing.updateMany({
      where: {
        id: { in: plan.cancel.map((c) => c.pairingId) },
        status: { in: OPEN_STATUSES },
      },
      data: { status: "cancelled" },
    });
    cancelled.push(...plan.cancel.map((c) => c.pairingId));
    // Une journée dont c'était la dernière rencontre ouverte se complète
    // (et la dernière journée régulière lance les play-offs, comme ailleurs).
    const roundIds = Array.from(new Set(plan.cancel.map((c) => c.roundId)));
    for (const roundId of roundIds) {
      await maybeCompleteRoundAndSeason(roundId, input.seasonId);
    }
  }

  const forfeited: string[] = [];
  const skipped: string[] = [];
  for (const f of plan.forfeit) {
    const out = await recordForfeit({ pairingId: f.pairingId, side: f.side });
    if ("recorded" in out) forfeited.push(f.pairingId);
    else skipped.push(f.pairingId);
  }

  serverLog.info(
    `[league-commissioner-withdrawal] season=${input.seasonId} participant=${registered.id} remaining=${input.remaining} forfeited=${forfeited.length} cancelled=${cancelled.length} placeholders=${plan.placeholders.length} by=${actor.userId}`,
  );

  try {
    await (
      prisma as unknown as {
        auditLog: { create: (args: unknown) => Promise<unknown> };
      }
    ).auditLog.create({
      data: {
        userId: actor.userId,
        action: "league.participant:commissioner-withdraw",
        entity: "LeagueParticipant",
        entityId: registered.id,
        newValue: {
          leagueId: season.league.id,
          seasonId: input.seasonId,
          teamId: registered.teamId,
          remaining: input.remaining,
          forfeited,
          cancelled,
          placeholders: plan.placeholders,
        },
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.error(`[league-commissioner-withdrawal] audit failed: ${msg}`);
  }

  // Le coach apprend le retrait de SON équipe (jamais bloquant).
  const ownerId = registered.team?.ownerId ?? null;
  if (ownerId && ownerId !== actor.userId) {
    await createInAppNotification({
      userId: ownerId,
      kind: "league.team_withdrawn",
      title: "Équipe retirée d'une ligue",
      body: `« ${registered.team?.name ?? "Votre équipe"} » a été retirée de la ligue « ${season.league.name} » par son commissaire. ${
        input.remaining === "forfeit"
          ? "Ses rencontres restantes sont perdues par forfait."
          : "Ses rencontres restantes sont annulées."
      }`,
      url: `/leagues/${season.league.id}`,
      meta: {
        leagueId: season.league.id,
        seasonId: input.seasonId,
        teamId: registered.teamId,
      },
    });
  }

  return {
    participantId: registered.id,
    teamId: registered.teamId,
    remaining: input.remaining,
    forfeited,
    cancelled,
    skipped,
    placeholders: plan.placeholders,
  };
}
