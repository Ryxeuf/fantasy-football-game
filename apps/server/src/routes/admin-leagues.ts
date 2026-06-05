/**
 * L2.C.6 — Sprint Ligues v2 PR10 : routes admin pour la gestion
 * globale des ligues.
 *
 * Reservees aux admins (authUser + adminOnly). Fournissent les
 * leviers pour superviser et nettoyer le catalogue de ligues sans
 * passer par l'identite du creator :
 *   - GET  /admin/leagues : liste paginee + filtres + counts
 *   - PATCH /admin/leagues/:id/status : force status
 *     ("draft"|"open"|"in_progress"|"completed"|"archived")
 *   - POST /admin/leagues/:id/archive : raccourci status=archived
 *   - PATCH /admin/leagues/:id/creator : transferer le creator a un
 *     autre user (ex: coach disparu)
 *
 * Ne deplace pas les actions saison (start / regenerate / close) :
 * elles existent deja sous /league/seasons/:id/* gates par
 * `requireLeagueCreator`. Pour qu'un admin force ces actions sans
 * etre creator, il peut d'abord transferer le creator vers son
 * propre compte.
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validate, validateQuery } from "../middleware/validate";
import { prisma } from "../prisma";
import {
  adminLeaguesQuerySchema,
  adminLeagueStatusSchema,
  adminLeagueTransferSchema,
  adminLeagueMatchModeSchema,
  type AdminLeagueMatchModeBody,
  type AdminLeaguesQuery,
  type AdminLeagueStatusBody,
  type AdminLeagueTransferBody,
} from "../schemas/admin-leagues.schemas";
import {
  withdrawParticipant,
  LeagueWithdrawError,
} from "../services/league";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";

const router = Router();

router.use(authUser, adminOnly);

interface AdminLeagueRow {
  id: string;
  name: string;
  description: string | null;
  ruleset: string;
  status: string;
  isPublic: boolean;
  maxParticipants: number;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  creator: {
    id: string;
    coachName: string | null;
    email: string;
  };
  _count: {
    seasons: number;
  };
}

/**
 * GET /admin/leagues
 *
 * Liste paginee des ligues. Filtres :
 *   - status : filtre exact sur League.status
 *   - search : substring (case-insensitive) dans le nom
 *   - publicOnly : "true" / "false" / undefined (default : tous)
 *   - limit / offset (pagination)
 *
 * Renvoie aussi le `seasonsCount` materialise pour permettre au front
 * d'identifier rapidement les ligues vides (eligibles a l'archivage).
 */
export async function handleListAdminLeagues(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const query = req.query as unknown as AdminLeaguesQuery;
  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (typeof query.publicOnly === "boolean") {
    where.isPublic = query.publicOnly;
  }
  if (query.search && query.search.length > 0) {
    where.name = { contains: query.search, mode: "insensitive" };
  }
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);

  try {
    const [items, total] = await Promise.all([
      prisma.league.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          creator: {
            select: { id: true, coachName: true, email: true },
          },
          _count: { select: { seasons: true } },
        },
      }),
      prisma.league.count({ where }),
    ]);
    res.status(200).json({
      success: true,
      data: {
        leagues: (items as AdminLeagueRow[]).map((l) => ({
          id: l.id,
          name: l.name,
          description: l.description,
          ruleset: l.ruleset,
          status: l.status,
          isPublic: l.isPublic,
          maxParticipants: l.maxParticipants,
          creatorId: l.creatorId,
          creator: l.creator,
          seasonsCount: l._count.seasons,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
        })),
      },
      meta: { total, limit, page: Math.floor(offset / limit) },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    serverLog.error("[admin-leagues] list failed:", msg);
    sendError(res, "Erreur serveur", 500);
  }
}

/**
 * PATCH /admin/leagues/:id/status
 *
 * Force le `status` d'une ligue, peu importe le creator. Utile pour :
 *   - desarchiver une ligue (archived -> draft)
 *   - forcer "completed" sur une ligue zombie qui n'avance plus
 *   - re-ouvrir une ligue (in_progress -> open)
 */
export async function handleForceLeagueStatus(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  const body = req.body as AdminLeagueStatusBody;

  const league = await prisma.league.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!league) {
    sendError(res, "Ligue introuvable", 404);
    return;
  }
  if (league.status === body.status) {
    // No-op : on retourne tel quel, idempotent.
    sendSuccess(res, { leagueId: id, status: body.status, changed: false });
    return;
  }

  await prisma.league.update({
    where: { id },
    data: { status: body.status },
  });
  serverLog.info(
    `[admin-leagues] status changed: id=${id} ${league.status} -> ${body.status} by user=${req.user?.id}`,
  );
  sendSuccess(res, {
    leagueId: id,
    status: body.status,
    changed: true,
    previousStatus: league.status,
  });
}

/**
 * POST /admin/leagues/:id/archive
 *
 * Raccourci : passe le status a "archived". Idempotent.
 */
export async function handleArchiveLeague(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  const league = await prisma.league.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!league) {
    sendError(res, "Ligue introuvable", 404);
    return;
  }
  if (league.status === "archived") {
    sendSuccess(res, { leagueId: id, status: "archived", changed: false });
    return;
  }
  await prisma.league.update({
    where: { id },
    data: { status: "archived" },
  });
  serverLog.info(
    `[admin-leagues] archived: id=${id} (was ${league.status}) by user=${req.user?.id}`,
  );
  sendSuccess(res, {
    leagueId: id,
    status: "archived",
    changed: true,
    previousStatus: league.status,
  });
}

/**
 * PATCH /admin/leagues/:id/creator
 *
 * Transfere le creator d'une ligue a un autre user (typiquement
 * pour reassigner une ligue dont le creator a quitte). Verifie que
 * le user cible existe.
 */
export async function handleTransferLeagueCreator(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  const body = req.body as AdminLeagueTransferBody;

  const [league, target] = await Promise.all([
    prisma.league.findUnique({
      where: { id },
      select: { id: true, creatorId: true },
    }),
    prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, coachName: true },
    }),
  ]);
  if (!league) {
    sendError(res, "Ligue introuvable", 404);
    return;
  }
  if (!target) {
    sendError(res, "Utilisateur cible introuvable", 404);
    return;
  }
  if (league.creatorId === body.userId) {
    sendSuccess(res, { leagueId: id, creatorId: body.userId, changed: false });
    return;
  }
  await prisma.league.update({
    where: { id },
    data: { creatorId: body.userId },
  });
  serverLog.info(
    `[admin-leagues] creator transferred: league=${id} ${league.creatorId} -> ${body.userId} by admin=${req.user?.id}`,
  );
  sendSuccess(res, {
    leagueId: id,
    creatorId: body.userId,
    changed: true,
    previousCreatorId: league.creatorId,
  });
}

/**
 * Sprint R lot R.E.3 — PATCH /admin/leagues/:id/match-mode.
 *
 * Configure le mode de jeu (realtime/async) + duree par tour pour
 * la ligue. Refuse si status='in_progress'/'completed' (les matches
 * existants ne sont pas reconfigures). Les futurs matches crees via
 * `league-match-from-pairing` heriteront du nouveau mode.
 */
export async function handlePatchLeagueMatchMode(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  const body = req.body as AdminLeagueMatchModeBody;
  const league = await prisma.league.findUnique({
    where: { id },
    select: { id: true, status: true, matchMode: true, turnDeadlineHours: true },
  });
  if (!league) {
    res.status(404).json({ error: "league-not-found" });
    return;
  }
  if (league.status === "in_progress" || league.status === "completed") {
    res.status(409).json({
      error: "league-already-started",
      message:
        "La ligue a deja demarre : les matches existants ne sont pas reconfigures.",
    });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (body.matchMode !== undefined) data.matchMode = body.matchMode;
  if (body.turnDeadlineHours !== undefined)
    data.turnDeadlineHours = body.turnDeadlineHours;
  const updated = await prisma.league.update({
    where: { id },
    data,
    select: { id: true, matchMode: true, turnDeadlineHours: true },
  });
  sendSuccess(res, updated);
}

/**
 * Lot B — POST /admin/leagues/seasons/:seasonId/participants/:teamId/force-withdraw
 *
 * Permet a un admin de retirer une equipe d'une saison meme apres
 * son demarrage (cas de desistement tardif que le commissaire ne
 * peut plus gerer via le flow standard). Cette action est auditee
 * via `serverLog` (cf. CLAUDE.md — toute action commissaire
 * destructive doit etre traceable).
 */
export async function handleAdminForceWithdraw(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { seasonId, teamId } = req.params;
  try {
    const updated = await withdrawParticipant({
      seasonId,
      teamId,
      force: true,
    });
    serverLog.info(
      `[admin-leagues] force-withdraw: season=${seasonId} team=${teamId} by admin=${req.user?.id}`,
    );
    sendSuccess(res, updated);
  } catch (e: unknown) {
    if (e instanceof LeagueWithdrawError) {
      const status =
        e.code === "season_not_found" || e.code === "not_registered"
          ? 404
          : e.code === "season_completed"
            ? 409
            : 400;
      sendError(res, e.message, status);
      return;
    }
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    serverLog.error("[admin-leagues] force-withdraw failed:", msg);
    sendError(res, msg, 500);
  }
}

router.get(
  "/",
  validateQuery(adminLeaguesQuerySchema),
  handleListAdminLeagues,
);
router.patch(
  "/:id/status",
  validate(adminLeagueStatusSchema),
  handleForceLeagueStatus,
);
router.post("/:id/archive", handleArchiveLeague);
router.patch(
  "/:id/creator",
  validate(adminLeagueTransferSchema),
  handleTransferLeagueCreator,
);

// Sprint R lot R.E.3 — configure le mode de jeu (realtime/async) +
// duree par tour pour une ligue. Refuse si status='in_progress' ou
// 'completed' (les matches existants ne sont pas reconfigures).
router.patch(
  "/:id/match-mode",
  validate(adminLeagueMatchModeSchema),
  handlePatchLeagueMatchMode,
);

// Lot B — retrait force d'une equipe par admin (bypass de la regle
// "saison non demarree"). Tracable via serverLog.
router.post(
  "/seasons/:seasonId/participants/:teamId/force-withdraw",
  handleAdminForceWithdraw,
);

export default router;
