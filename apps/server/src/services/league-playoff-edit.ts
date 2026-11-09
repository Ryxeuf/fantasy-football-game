/**
 * Édition d'un bracket de play-offs de ligue déjà généré (commissaire ou
 * admin). Les décisions vivent dans `league-playoff-edit-rules` (pur) ; ici
 * on charge, on autorise, on écrit, on journalise.
 *
 * Un tour de bracket se reconnaît par `bracketRoundsWhere` (`kind=playoff`
 * OU `bracketSlot`) : un tour créé à la main n'a que son slot, et la taille
 * du bracket (`PATCH /seasons/:id/config`) se rouvre sur la MÊME définition.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import { bracketRoundsWhere } from "./league-pool";
import {
  decidePlayoffReset,
  type PlayoffPairingState,
  type PlayoffResetRefusal,
} from "./league-playoff-edit-rules";

export type PlayoffEditErrorCode =
  | "season_not_found"
  | "forbidden"
  | PlayoffResetRefusal;

export class PlayoffEditError extends Error {
  constructor(
    public readonly code: PlayoffEditErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PlayoffEditError";
  }
}

/** Qui agit : le commissaire (créateur de la ligue) ou un admin. */
export interface PlayoffEditActor {
  readonly userId: string;
  readonly isAdmin: boolean;
}

interface SeasonForEdit {
  id: string;
  status: string;
  league: { id: string; creatorId: string };
}

/**
 * Charge la saison et vérifie que l'acteur la commande. Saison inconnue ⇒
 * 404 ; ni créateur ni admin ⇒ 403 (la saison est visible du commissaire,
 * c'est l'action qui lui est refusée).
 */
export async function loadSeasonForCommissioner(
  seasonId: string,
  actor: PlayoffEditActor,
): Promise<SeasonForEdit> {
  const season = (await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      status: true,
      league: { select: { id: true, creatorId: true } },
    },
  })) as SeasonForEdit | null;
  if (!season) {
    throw new PlayoffEditError("season_not_found", "Saison introuvable");
  }
  if (season.league.creatorId !== actor.userId && !actor.isAdmin) {
    throw new PlayoffEditError(
      "forbidden",
      "Seul le commissaire de la ligue (ou un admin) peut faire cette action",
    );
  }
  return season;
}

/** Sélection Prisma commune : ce qui dit si une rencontre est engagée. */
export const PLAYOFF_PAIRING_STATE_SELECT = {
  id: true,
  status: true,
  homeParticipantId: true,
  awayParticipantId: true,
  match: { select: { id: true } },
  matchSheet: {
    select: { status: true, _count: { select: { events: true } } },
  },
} as const;

export interface PlayoffPairingRow {
  id: string;
  status: string;
  homeParticipantId: string;
  awayParticipantId: string;
  match: { id: string } | null;
  matchSheet: { status: string; _count: { events: number } } | null;
}

export function toPlayoffPairingState(
  row: PlayoffPairingRow,
): PlayoffPairingState {
  return {
    id: row.id,
    status: row.status,
    homeParticipantId: row.homeParticipantId,
    awayParticipantId: row.awayParticipantId,
    matchId: row.match?.id ?? null,
    sheetStatus: row.matchSheet?.status ?? null,
    sheetEventCount: row.matchSheet?._count.events ?? 0,
  };
}

async function auditPlayoffEdit(
  actor: PlayoffEditActor,
  action: string,
  seasonId: string,
  newValue: Record<string, unknown>,
): Promise<void> {
  try {
    await (
      prisma as unknown as {
        auditLog: { create: (args: unknown) => Promise<unknown> };
      }
    ).auditLog.create({
      data: {
        userId: actor.userId,
        action: `league.playoff:${action}`,
        entity: "LeagueSeason",
        entityId: seasonId,
        newValue,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.error(`[league-playoff-edit] audit ${action} failed: ${msg}`);
  }
}

export interface ResetPlayoffBracketOutcome {
  readonly seasonId: string;
  readonly roundsDeleted: number;
}

/**
 * Réinitialise le bracket : supprime TOUS ses tours (rencontres, feuilles
 * vides et pronostics partent en cascade) tant qu'aucune rencontre n'est
 * engagée. La taille du bracket redevient éditable, le commissaire relance.
 *
 * `playoffsPublished` repasse à `null` (« rien à masquer ») : sans bracket
 * l'état de publication ne gouverne rien, et `startPlayoffs` réécrit le
 * `false` explicite à la prochaine génération — le nouveau bracket naît donc
 * NON publié, comme le premier.
 *
 * Les rencontres régulières annulées par une clôture anticipée ne sont PAS
 * rétablies : la phase régulière reste close.
 */
export async function resetPlayoffBracket(
  seasonId: string,
  actor: PlayoffEditActor,
): Promise<ResetPlayoffBracketOutcome> {
  const season = await loadSeasonForCommissioner(seasonId, actor);
  const rounds = (await prisma.leagueRound.findMany({
    where: bracketRoundsWhere(seasonId),
    select: { id: true, pairings: { select: PLAYOFF_PAIRING_STATE_SELECT } },
  })) as unknown as Array<{ id: string; pairings: PlayoffPairingRow[] }>;

  const decision = decidePlayoffReset({
    seasonStatus: season.status,
    rounds: rounds.map((r) => ({
      pairings: r.pairings.map(toPlayoffPairingState),
    })),
  });
  if (!decision.ok) throw new PlayoffEditError(decision.code, decision.message);

  await prisma.$transaction([
    prisma.leagueRound.deleteMany({ where: bracketRoundsWhere(seasonId) }),
    prisma.leagueSeason.update({
      where: { id: seasonId },
      data: { playoffsPublished: null },
    }),
  ]);

  serverLog.info(
    `[league-playoff-edit] season=${seasonId} bracket reset rounds=${rounds.length} by=${actor.userId}`,
  );
  await auditPlayoffEdit(actor, "reset", seasonId, {
    leagueId: season.league.id,
    roundsDeleted: rounds.length,
  });
  return { seasonId, roundsDeleted: rounds.length };
}
