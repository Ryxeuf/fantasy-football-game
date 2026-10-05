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
 *   - PATCH /admin/leagues/:id/standings-order : reordonner les criteres
 *     de departage du classement, meme apres le verrou d'edition
 *   - GET   /admin/leagues/:id : fiche complete (saisons, verrou, creator)
 *   - PATCH /admin/leagues/:id : edition admin (identite, capacite,
 *     visibilite, bareme) sans etre commissaire
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
  adminLeagueUpdateSchema,
  type AdminLeagueUpdateBody,
  type AdminLeaguesQuery,
  type AdminLeagueStatusBody,
  type AdminLeagueTransferBody,
} from "../schemas/admin-leagues.schemas";
import {
  leagueStandingsOrderSchema,
  type LeagueStandingsOrderBody,
} from "../schemas/league.schemas";
import {
  hasLeagueScoredMatch,
  setLeagueStandingsOrder,
  updateLeague,
  withdrawParticipant,
  LeagueWithdrawError,
} from "../services/league";
import {
  normalizeLeagueTieBreakRules,
  parseLeagueTieBreakRules,
  readStoredLeagueTieBreakRules,
} from "../services/league-standings-order";
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
  tieBreakRules: string | null;
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
          // Critères de classement : la valeur BRUTE (ce que la console
          // re-poste) ET l'ordre EFFECTIF (ce qui s'applique réellement).
          tieBreakRules: normalizeLeagueTieBreakRules(
            readStoredLeagueTieBreakRules(l.tieBreakRules),
          ),
          effectiveTieBreakRules: parseLeagueTieBreakRules(l.tieBreakRules),
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
  const body: AdminLeagueStatusBody = req.body;

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
  const body: AdminLeagueTransferBody = req.body;

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
 * PATCH /admin/leagues/:id/standings-order
 *
 * Réordonne les critères de départage du classement d'une ligue. C'est le
 * SEUL chemin qui reste ouvert une fois qu'un match a été joué :
 * `PATCH /leagues/:id` (commissaire) se verrouille à ce moment-là, parce
 * qu'y toucher au barème réécrirait des points déjà attribués. L'ordre de
 * classement, lui, ne touche à RIEN de persisté — le classement est trié à
 * la lecture — donc un administrateur peut le corriger à tout moment, y
 * compris en cours de saison ou sur une ligue archivée.
 *
 * `tieBreakRules: null` (ou une liste vide) remet la ligue sur l'ordre par
 * défaut. La réponse porte l'ordre EFFECTIF pour que la console affiche ce
 * qui s'applique réellement.
 */
export async function handleSetLeagueStandingsOrder(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  const body: LeagueStandingsOrderBody = req.body;

  const result = await setLeagueStandingsOrder(id, body.tieBreakRules);
  if (!result) {
    sendError(res, "Ligue introuvable", 404);
    return;
  }
  serverLog.info(
    `[admin-leagues] standings order changed: id=${id} by admin=${req.user?.id}`,
  );
  sendSuccess(res, result);
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

interface AdminLeagueSeasonRow {
  id: string;
  seasonNumber: number;
  name: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  _count: { participants: number };
}

/**
 * GET /admin/leagues/:id
 *
 * Fiche d'une ligue pour la console admin : tous les reglages editables,
 * le creator (email compris — reserve aux admins), les saisons avec leur
 * nombre d'inscrits et le verrou d'edition du bareme (`scoringLocked`).
 * Aucune regle de visibilite : un admin voit aussi les ligues privees.
 */
export async function handleGetAdminLeague(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  try {
    const league = await prisma.league.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        ruleset: true,
        status: true,
        isPublic: true,
        maxParticipants: true,
        winPoints: true,
        drawPoints: true,
        lossPoints: true,
        forfeitPoints: true,
        creatorId: true,
        createdAt: true,
        updatedAt: true,
        creator: { select: { id: true, coachName: true, email: true } },
        seasons: {
          orderBy: { seasonNumber: "desc" },
          select: {
            id: true,
            seasonNumber: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            _count: { select: { participants: true } },
          },
        },
      },
    });
    if (!league) {
      sendError(res, "Ligue introuvable", 404);
      return;
    }
    const scoringLocked = await hasLeagueScoredMatch(id);
    const { seasons, ...rest } = league;
    sendSuccess(res, {
      ...rest,
      scoringLocked,
      seasons: (seasons as AdminLeagueSeasonRow[]).map(({ _count, ...s }) => ({
        ...s,
        participantsCount: _count.participants,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    serverLog.error("[admin-leagues] get failed:", msg);
    sendError(res, "Erreur serveur", 500);
  }
}

const SCORING_FIELDS = [
  "winPoints",
  "drawPoints",
  "lossPoints",
  "forfeitPoints",
] as const;

/**
 * PATCH /admin/leagues/:id
 *
 * Edition d'une ligue par un administrateur, sans etre son commissaire.
 * Nom, description, capacite et VISIBILITE se changent a tout moment (rien
 * de persiste n'en depend). Le bareme, lui, reste fige des qu'un match a ete
 * scoré : le modifier reecrirait des points deja attribues (meme verrou que
 * `PATCH /leagues/:id`, 409).
 */
export async function handleUpdateAdminLeague(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  const body: AdminLeagueUpdateBody = req.body;

  const league = await prisma.league.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!league) {
    sendError(res, "Ligue introuvable", 404);
    return;
  }
  const touchesScoring = SCORING_FIELDS.some((k) => body[k] !== undefined);
  if (touchesScoring && (await hasLeagueScoredMatch(id))) {
    sendError(
      res,
      "Bareme verrouille : un match a deja ete joue, les points ne peuvent plus etre modifies",
      409,
    );
    return;
  }
  try {
    const updated = await updateLeague(id, body);
    serverLog.info(
      `[admin-leagues] updated: id=${id} fields=${Object.keys(body).join(",")} by admin=${req.user?.id}`,
    );
    sendSuccess(res, {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isPublic: updated.isPublic,
      maxParticipants: updated.maxParticipants,
      winPoints: updated.winPoints,
      drawPoints: updated.drawPoints,
      lossPoints: updated.lossPoints,
      forfeitPoints: updated.forfeitPoints,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    sendError(res, msg, 400);
  }
}

router.get(
  "/",
  validateQuery(adminLeaguesQuerySchema),
  handleListAdminLeagues,
);
router.get("/:id", handleGetAdminLeague);
router.patch(
  "/:id",
  validate(adminLeagueUpdateSchema),
  handleUpdateAdminLeague,
);
router.patch(
  "/:id/status",
  validate(adminLeagueStatusSchema),
  handleForceLeagueStatus,
);
router.post("/:id/archive", handleArchiveLeague);
router.patch(
  "/:id/standings-order",
  validate(leagueStandingsOrderSchema),
  handleSetLeagueStandingsOrder,
);
router.patch(
  "/:id/creator",
  validate(adminLeagueTransferSchema),
  handleTransferLeagueCreator,
);

// Lot B — retrait force d'une equipe par admin (bypass de la regle
// "saison non demarree"). Tracable via serverLog.
router.post(
  "/seasons/:seasonId/participants/:teamId/force-withdraw",
  handleAdminForceWithdraw,
);

export default router;
