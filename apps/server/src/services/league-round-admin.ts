/**
 * Renommer / supprimer une JOURNÉE de ligue (commissaire).
 *
 * L'éditeur de calendrier crée des journées et y ajoute des rencontres, mais
 * ne savait ni les renommer ni les supprimer. Ce service porte les deux
 * opérations ; la décision de suppression est la règle PURE de
 * `league-round-removal`.
 *
 * Autorisation : même posture que les routes voisines de saisie manuelle
 * (`ensureLeagueCreatorByRound`) — le COMMISSAIRE (créateur) de la ligue.
 * Une ligue privée reste INTROUVABLE (404) pour qui ne la voit pas.
 *
 * Renommer est une règle de LECTURE (seul le libellé change, rien de
 * persisté n'en dépend) : ouvert à tout moment, saison clôturée comprise.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import {
  LEAGUE_VISIBILITY_SELECT,
  canViewLeagueRow,
  type LeagueVisibilityRow,
} from "./league-access";
import {
  decideRoundRemoval,
  normalizeRoundName,
  type RoundRemovalRefusalCode,
} from "./league-round-removal";

export type LeagueRoundAdminErrorCode =
  | "round_not_found"
  | "forbidden"
  | "invalid_dates"
  | RoundRemovalRefusalCode;

export class LeagueRoundAdminError extends Error {
  constructor(
    public readonly code: LeagueRoundAdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LeagueRoundAdminError";
  }
}

export interface RoundActor {
  readonly userId: string;
  readonly isAdmin: boolean;
}

interface ManageableRound {
  readonly id: string;
  readonly seasonId: string;
  readonly roundNumber: number;
  readonly name: string | null;
  readonly kind: string;
  readonly bracketSlot: string | null;
  readonly startDate: Date | null;
  readonly endDate: Date | null;
  readonly season: {
    readonly status: string;
    readonly league: LeagueVisibilityRow;
  };
}

async function loadManageableRound(
  roundId: string,
  actor: RoundActor,
): Promise<ManageableRound> {
  const round = (await prisma.leagueRound.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      seasonId: true,
      roundNumber: true,
      name: true,
      kind: true,
      bracketSlot: true,
      startDate: true,
      endDate: true,
      season: {
        select: { status: true, league: { select: LEAGUE_VISIBILITY_SELECT } },
      },
    },
  })) as ManageableRound | null;
  if (!round || !(await canViewLeagueRow(round.season.league, actor))) {
    throw new LeagueRoundAdminError("round_not_found", "Journee introuvable");
  }
  if (round.season.league.creatorId !== actor.userId) {
    throw new LeagueRoundAdminError(
      "forbidden",
      "Seul le commissaire de la ligue peut modifier ses journees",
    );
  }
  return round;
}

export interface UpdateLeagueRoundInput {
  readonly roundId: string;
  readonly actor: RoundActor;
  /** `undefined` = inchangé ; `null` / chaîne vide = nom par défaut. */
  readonly name?: string | null;
  readonly startDate?: Date | null;
  readonly endDate?: Date | null;
}

/** Renomme une journée et/ou change ses dates. */
export async function updateLeagueRound(input: UpdateLeagueRoundInput) {
  const round = await loadManageableRound(input.roundId, input.actor);

  const startDate =
    input.startDate !== undefined ? input.startDate : round.startDate;
  const endDate = input.endDate !== undefined ? input.endDate : round.endDate;
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw new LeagueRoundAdminError(
      "invalid_dates",
      "La date de fin precede la date de debut",
    );
  }

  const data: {
    name?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
  } = {};
  const name = normalizeRoundName(input.name);
  if (name !== undefined) data.name = name;
  if (input.startDate !== undefined) data.startDate = input.startDate;
  if (input.endDate !== undefined) data.endDate = input.endDate;

  const updated = await prisma.leagueRound.update({
    where: { id: round.id },
    data,
  });
  serverLog.info(
    `[league-round-admin] round=${round.id} updated by user=${input.actor.userId} fields=${Object.keys(data).join(",")}`,
  );
  return { round: updated, before: round };
}

export interface DeleteLeagueRoundResult {
  readonly deleted: true;
  readonly roundId: string;
  readonly seasonId: string;
  readonly roundNumber: number;
  readonly name: string | null;
  readonly pairingsRemoved: number;
  readonly draftSheetsRemoved: number;
  readonly predictionsRemoved: number;
}

interface RoundPairingRow {
  readonly status: string;
  readonly match: { readonly id: string } | null;
  readonly matchSheet: { readonly status: string } | null;
  readonly _count?: { readonly predictions?: number };
}

/**
 * Supprime une journée et, en cascade, ses rencontres À JOUER, leurs feuilles
 * en brouillon et leurs pronostics. Refus typé (cf. `decideRoundRemoval`)
 * dès qu'une rencontre a un effet engagé.
 */
export async function deleteLeagueRound(input: {
  readonly roundId: string;
  readonly actor: RoundActor;
}): Promise<DeleteLeagueRoundResult> {
  const round = await loadManageableRound(input.roundId, input.actor);

  const [pairings, scoredMatches] = await Promise.all([
    prisma.leaguePairing.findMany({
      where: { roundId: round.id },
      select: {
        status: true,
        match: { select: { id: true } },
        matchSheet: { select: { status: true } },
        _count: { select: { predictions: true } },
      },
    }) as Promise<RoundPairingRow[]>,
    prisma.match.count({
      where: {
        OR: [
          { leagueRoundId: round.id },
          { leaguePairing: { roundId: round.id } },
        ],
        leagueScoredAt: { not: null },
      },
    }),
  ]);

  const decision = decideRoundRemoval({
    round: { kind: round.kind, bracketSlot: round.bracketSlot },
    seasonStatus: round.season.status,
    pairings: pairings.map((p) => ({
      status: p.status,
      hasMatch: p.match !== null,
      sheetStatus: p.matchSheet?.status ?? null,
      predictions: p._count?.predictions ?? 0,
    })),
    scoredMatches,
  });
  if (!decision.allowed) {
    throw new LeagueRoundAdminError(decision.code, decision.message);
  }

  await prisma.leagueRound.delete({ where: { id: round.id } });
  serverLog.info(
    `[league-round-admin] round=${round.id} (J${round.roundNumber}) deleted by user=${input.actor.userId} — ${decision.pairingsRemoved} rencontre(s), ${decision.draftSheetsRemoved} brouillon(s), ${decision.predictionsRemoved} pronostic(s)`,
  );
  return {
    deleted: true,
    roundId: round.id,
    seasonId: round.seasonId,
    roundNumber: round.roundNumber,
    name: round.name,
    pairingsRemoved: decision.pairingsRemoved,
    draftSheetsRemoved: decision.draftSheetsRemoved,
    predictionsRemoved: decision.predictionsRemoved,
  };
}
