/**
 * Routes admin pour la supervision des feuilles de match (ligues ET coupes).
 *
 * Reservees aux admins (authUser + adminOnly) :
 *   - GET    /admin/match-sheets     : liste paginee + filtres (statut,
 *     famille, recherche equipe/competition) + compteurs par statut
 *   - DELETE /admin/match-sheets/:id : suppression d'une feuille NON
 *     validee (remise a zero : la rencontre repart sans feuille)
 *
 * Tout le reste — saisie, soumission, validation, invalidation — passe par
 * l'editeur standard (`/leagues|cup/pairings/:id/sheet/*`) : un admin y a les
 * droits du commissaire (cf. `isCommissioner`, services/league-match-sheet),
 * sauf sur un match ou il aligne lui-meme une equipe.
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validateQuery } from "../middleware/validate";
import { prisma } from "../prisma";
import {
  adminMatchSheetsQuerySchema,
  type AdminMatchSheetsQuery,
} from "../schemas/admin-match-sheets.schemas";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";

const router = Router();

router.use(authUser, adminOnly);

const TEAM_SELECT = {
  select: {
    id: true,
    name: true,
    owner: { select: { id: true, coachName: true } },
  },
} as const;

interface TeamRow {
  id: string;
  name: string;
  owner: { id: string; coachName: string | null } | null;
}

interface SheetRow {
  id: string;
  status: string;
  scoreHome: number;
  scoreAway: number;
  forfeitSide: string | null;
  submittedByHomeAt: Date | null;
  submittedByAwayAt: Date | null;
  validatedAt: Date | null;
  invalidatedAt: Date | null;
  invalidationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  pairingId: string | null;
  cupPairingId: string | null;
  _count: { events: number };
  pairing: {
    round: {
      roundNumber: number;
      name: string | null;
      season: {
        id: string;
        name: string;
        league: { id: string; name: string };
      };
    };
    homeParticipant: { team: TeamRow };
    awayParticipant: { team: TeamRow };
  } | null;
  cupPairing: {
    round: {
      roundNumber: number;
      name: string | null;
      cup: { id: string; name: string };
    };
    homeTeam: TeamRow;
    awayTeam: TeamRow | null;
  } | null;
}

export interface AdminMatchSheetTeam {
  teamId: string;
  teamName: string;
  coachName: string | null;
}

export interface AdminMatchSheetItem {
  id: string;
  kind: "league" | "cup";
  /** Id de la rencontre (LeaguePairing ou CupPairing) : clé de l'éditeur. */
  pairingId: string;
  status: string;
  scoreHome: number;
  scoreAway: number;
  forfeitSide: string | null;
  submittedByHomeAt: Date | null;
  submittedByAwayAt: Date | null;
  validatedAt: Date | null;
  invalidatedAt: Date | null;
  invalidationReason: string | null;
  eventsCount: number;
  competition: { id: string; name: string };
  seasonName: string | null;
  roundNumber: number;
  roundName: string | null;
  home: AdminMatchSheetTeam | null;
  away: AdminMatchSheetTeam | null;
  createdAt: Date;
  updatedAt: Date;
}

function toTeam(t: TeamRow | null | undefined): AdminMatchSheetTeam | null {
  if (!t) return null;
  return { teamId: t.id, teamName: t.name, coachName: t.owner?.coachName ?? null };
}

/**
 * Aplatie une ligne Prisma (ligue OU coupe) en entrée de console. Pur,
 * exporté pour test. `null` pour une feuille orpheline (aucune rencontre).
 */
export function toAdminMatchSheetItem(row: SheetRow): AdminMatchSheetItem | null {
  const base = {
    id: row.id,
    status: row.status,
    scoreHome: row.scoreHome,
    scoreAway: row.scoreAway,
    forfeitSide: row.forfeitSide,
    submittedByHomeAt: row.submittedByHomeAt,
    submittedByAwayAt: row.submittedByAwayAt,
    validatedAt: row.validatedAt,
    invalidatedAt: row.invalidatedAt,
    invalidationReason: row.invalidationReason,
    eventsCount: row._count.events,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  if (row.pairing && row.pairingId) {
    const { round } = row.pairing;
    return {
      ...base,
      kind: "league",
      pairingId: row.pairingId,
      competition: { id: round.season.league.id, name: round.season.league.name },
      seasonName: round.season.name,
      roundNumber: round.roundNumber,
      roundName: round.name,
      home: toTeam(row.pairing.homeParticipant.team),
      away: toTeam(row.pairing.awayParticipant.team),
    };
  }
  if (row.cupPairing && row.cupPairingId) {
    const { round } = row.cupPairing;
    return {
      ...base,
      kind: "cup",
      pairingId: row.cupPairingId,
      competition: { id: round.cup.id, name: round.cup.name },
      seasonName: null,
      roundNumber: round.roundNumber,
      roundName: round.name,
      home: toTeam(row.cupPairing.homeTeam),
      away: toTeam(row.cupPairing.awayTeam),
    };
  }
  return null;
}

/**
 * `where` Prisma de la liste. Pur, exporté pour test. La recherche porte
 * sur le nom des deux équipes et de la compétition, des deux familles.
 */
export function buildAdminMatchSheetsWhere(
  query: Pick<AdminMatchSheetsQuery, "status" | "kind" | "search">,
): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];
  if (query.status) and.push({ status: query.status });
  if (query.kind === "league") and.push({ pairingId: { not: null } });
  if (query.kind === "cup") and.push({ cupPairingId: { not: null } });
  const search = query.search?.trim();
  if (search) {
    const contains = { contains: search, mode: "insensitive" };
    const or: Record<string, unknown>[] = [];
    if (query.kind !== "cup") {
      or.push(
        { pairing: { homeParticipant: { team: { name: contains } } } },
        { pairing: { awayParticipant: { team: { name: contains } } } },
        { pairing: { round: { season: { league: { name: contains } } } } },
      );
    }
    if (query.kind !== "league") {
      or.push(
        { cupPairing: { homeTeam: { name: contains } } },
        { cupPairing: { awayTeam: { name: contains } } },
        { cupPairing: { round: { cup: { name: contains } } } },
      );
    }
    and.push({ OR: or });
  }
  return and.length > 0 ? { AND: and } : {};
}

export async function handleListAdminMatchSheets(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const query = req.query as unknown as AdminMatchSheetsQuery;
  const where = buildAdminMatchSheetsWhere(query);
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  try {
    const [rows, total, byStatus] = await Promise.all([
      prisma.leagueMatchSheet.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          status: true,
          scoreHome: true,
          scoreAway: true,
          forfeitSide: true,
          submittedByHomeAt: true,
          submittedByAwayAt: true,
          validatedAt: true,
          invalidatedAt: true,
          invalidationReason: true,
          createdAt: true,
          updatedAt: true,
          pairingId: true,
          cupPairingId: true,
          _count: { select: { events: true } },
          pairing: {
            select: {
              round: {
                select: {
                  roundNumber: true,
                  name: true,
                  season: {
                    select: {
                      id: true,
                      name: true,
                      league: { select: { id: true, name: true } },
                    },
                  },
                },
              },
              homeParticipant: { select: { team: TEAM_SELECT } },
              awayParticipant: { select: { team: TEAM_SELECT } },
            },
          },
          cupPairing: {
            select: {
              round: {
                select: {
                  roundNumber: true,
                  name: true,
                  cup: { select: { id: true, name: true } },
                },
              },
              homeTeam: TEAM_SELECT,
              awayTeam: TEAM_SELECT,
            },
          },
        },
      }),
      prisma.leagueMatchSheet.count({ where }),
      prisma.leagueMatchSheet.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const status: Record<string, number> = {};
    let all = 0;
    for (const row of byStatus as Array<{
      status: string;
      _count: { _all: number };
    }>) {
      status[row.status] = row._count._all;
      all += row._count._all;
    }

    res.status(200).json({
      success: true,
      data: {
        sheets: (rows as SheetRow[])
          .map(toAdminMatchSheetItem)
          .filter((s): s is AdminMatchSheetItem => s !== null),
        counts: { total: all, status },
      },
      meta: { total, limit, page: Math.floor(offset / limit) },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    serverLog.error("[admin-match-sheets] list failed:", msg);
    sendError(res, "Erreur serveur", 500);
  }
}

/**
 * DELETE /admin/match-sheets/:id
 *
 * Remet une rencontre à zéro en supprimant sa feuille (évènements compris,
 * cascade). Refusé (409) sur une feuille VALIDÉE : ses effets (score,
 * classement, PSP, blessures, trésorerie) sont écrits ; il faut d'abord
 * l'INVALIDER, ce qui les reverse proprement. Une feuille non validée n'a
 * rien écrit hors d'elle-même (les évolutions saisies restent en staging).
 */
export async function handleDeleteAdminMatchSheet(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  try {
    const sheet = await prisma.leagueMatchSheet.findUnique({
      where: { id },
      select: { id: true, status: true, pairingId: true, cupPairingId: true },
    });
    if (!sheet) {
      sendError(res, "Feuille introuvable", 404);
      return;
    }
    if (sheet.status === "validated") {
      sendError(
        res,
        "Feuille validee : invalidez-la d'abord pour reverser ses effets",
        409,
      );
      return;
    }
    await prisma.leagueMatchSheet.delete({ where: { id } });
    serverLog.info(
      `[admin-match-sheets] deleted: sheet=${id} status=${sheet.status} pairing=${sheet.pairingId ?? sheet.cupPairingId} by admin=${req.user?.id}`,
    );
    sendSuccess(res, { id, deleted: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    serverLog.error("[admin-match-sheets] delete failed:", msg);
    sendError(res, "Erreur serveur", 500);
  }
}

router.get(
  "/",
  validateQuery(adminMatchSheetsQuerySchema),
  handleListAdminMatchSheets,
);
router.delete("/:id", handleDeleteAdminMatchSheet);

export default router;
