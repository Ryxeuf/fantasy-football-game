/**
 * Lot A — Routes API pour les invitations de ligue.
 *
 * Endpoints :
 *  - POST   /leagues/:leagueId/invitations         (commissaire)
 *  - GET    /leagues/:leagueId/invitations         (commissaire)
 *  - DELETE /leagues/invitations/:invitationId     (commissaire ou admin)
 *  - GET    /leagues/invitations/:code             (public, info pre-acceptation)
 *  - POST   /leagues/invitations/:code/accept      (authenticated)
 *  - POST   /leagues/invitations/:code/decline     (authenticated)
 *  - GET    /leagues/me/invitations                (authenticated, mes pending)
 *  - GET    /leagues/coaches/search                (authenticated, autocomplete)
 *
 * Les erreurs typees du service sont mappees ici sur les status HTTP
 * appropries (404 / 409 / 403 / 400).
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate, validateQuery } from "../middleware/validate";
import { prisma } from "../prisma";
import { hasRole } from "../utils/roles";
import {
  createInvitation,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,
  listInvitationsForLeague,
  listPendingInvitationsForUser,
  getInvitationByCode,
  LeagueInvitationError,
  type LeagueInvitationStatus,
} from "../services/league-invitation";
import { searchUsersByCoachName } from "../services/user-lookup";
import {
  createInvitationSchema,
  acceptInvitationSchema,
  searchCoachesQuerySchema,
  type CreateInvitationBody,
  type AcceptInvitationBody,
  type SearchCoachesQuery,
} from "../schemas/league-invitation.schemas";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";

const router = Router();

function requireUserId(
  req: AuthenticatedRequest,
  res: Response,
): string | null {
  const id = req.user?.id;
  if (!id) {
    sendError(res, "Non authentifie", 401);
    return null;
  }
  return id;
}

function isAdminReq(req: AuthenticatedRequest): boolean {
  return hasRole(req.user?.roles ?? [], "admin");
}

/**
 * Verifie que l'user est createur de la ligue (ou admin). Retourne
 * la ligue minimale ; ecrit la reponse d'erreur et retourne null si
 * non autorise.
 */
async function requireCommissioner(
  req: AuthenticatedRequest,
  res: Response,
  leagueId: string,
): Promise<{ id: string; creatorId: string } | null> {
  const userId = requireUserId(req, res);
  if (!userId) return null;
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, creatorId: true },
  });
  if (!league) {
    sendError(res, "Ligue introuvable", 404);
    return null;
  }
  if (league.creatorId !== userId && !isAdminReq(req)) {
    sendError(res, "Seul le commissaire peut effectuer cette action", 403);
    return null;
  }
  return league;
}

function mapInvitationError(res: Response, e: unknown): void {
  if (e instanceof LeagueInvitationError) {
    const status =
      e.code === "league_not_found" ||
      e.code === "season_not_found" ||
      e.code === "invitation_not_found" ||
      e.code === "team_not_found"
        ? 404
        : e.code === "season_closed" ||
            e.code === "invitation_already_consumed" ||
            e.code === "invitation_expired" ||
            e.code === "team_already_registered" ||
            e.code === "league_full"
          ? 409
          : e.code === "forbidden" ||
              e.code === "invitation_not_for_user" ||
              e.code === "team_not_owned_by_user"
            ? 403
            : 400;
    sendError(res, e.message, status);
    return;
  }
  const msg = e instanceof Error ? e.message : "Erreur inconnue";
  serverLog.error("[league-invitation]", msg);
  sendError(res, msg, 500);
}

/** POST /leagues/:leagueId/invitations — commissaire cree une invitation. */
export async function handleCreateInvitation(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const leagueId = req.params.leagueId;
  const league = await requireCommissioner(req, res, leagueId);
  if (!league) return;
  const body = req.body as CreateInvitationBody;
  try {
    const inv = await createInvitation({
      leagueId,
      inviterUserId: req.user!.id,
      seasonId: body.seasonId ?? null,
      inviteeUserId: body.inviteeUserId ?? null,
      inviteeEmail: body.inviteeEmail ?? null,
      inviteeTeamId: body.inviteeTeamId ?? null,
      message: body.message ?? null,
      expiresInDays: body.expiresInDays,
    });
    serverLog.info(
      `[league-invitation] created: league=${leagueId} code=${inv.code} by=${req.user?.id}`,
    );
    sendSuccess(res, inv, 201);
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

/** GET /leagues/:leagueId/invitations — commissaire liste les invitations. */
export async function handleListInvitations(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const leagueId = req.params.leagueId;
  const league = await requireCommissioner(req, res, leagueId);
  if (!league) return;
  const status = (req.query.status as string | undefined) as
    | LeagueInvitationStatus
    | undefined;
  try {
    const items = await listInvitationsForLeague({ leagueId, status });
    sendSuccess(res, { invitations: items });
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

/** DELETE /leagues/invitations/:invitationId — annulation. */
export async function handleCancelInvitation(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const out = await cancelInvitation({
      invitationId: req.params.invitationId,
      byUserId: userId,
      isAdmin: isAdminReq(req),
    });
    sendSuccess(res, out);
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

/**
 * GET /leagues/invitations/:code — vue publique de l'invitation (pour
 * la page d'acceptation). Pas d'auth requise car le code lui-meme
 * agit comme bearer.
 */
export async function handleGetInvitationByCode(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const code = req.params.code;
  try {
    const inv = await getInvitationByCode(code);
    if (!inv) {
      sendError(res, "Invitation introuvable", 404);
      return;
    }
    sendSuccess(res, inv);
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

/** POST /leagues/invitations/:code/accept. */
export async function handleAcceptInvitation(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const body = req.body as AcceptInvitationBody;
  try {
    const out = await acceptInvitation({
      code: req.params.code,
      userId,
      teamId: body.teamId,
      seasonId: body.seasonId,
    });
    serverLog.info(
      `[league-invitation] accepted: code=${req.params.code} by=${userId} team=${body.teamId}`,
    );
    sendSuccess(res, out);
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

/** POST /leagues/invitations/:code/decline. */
export async function handleDeclineInvitation(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const out = await declineInvitation({ code: req.params.code, userId });
    sendSuccess(res, out);
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

/** GET /leagues/me/invitations — invitations pending recues par l'user courant. */
export async function handleListMyInvitations(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const items = await listPendingInvitationsForUser(userId);
    sendSuccess(res, { invitations: items });
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

/**
 * GET /leagues/coaches/search?q=...&limit=...&seasonId=...
 *
 * Autocomplete : retourne les coaches (User) qui matchent par
 * coachName. Optionnellement, exclut les coaches dont une equipe
 * est deja inscrite a la saison `seasonId` (utile pour l'UI
 * "inviter de nouveaux coaches").
 *
 * Reservee aux users authentifies (anti-scraping cote API publique).
 */
export async function handleSearchCoaches(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const query = req.query as unknown as SearchCoachesQuery;
  try {
    const results = await searchUsersByCoachName(query.q, query.limit ?? 10);

    // Si seasonId fourni, exclure les coaches deja inscrits via une
    // de leurs equipes. groupBy pour eviter N+1 (cf. CLAUDE.md).
    let excluded = new Set<string>();
    if (query.seasonId && results.length > 0) {
      const teams = (await prisma.leagueParticipant.findMany({
        where: {
          seasonId: query.seasonId,
          status: "active",
          team: { ownerId: { in: results.map((r) => r.id) } },
        },
        select: { team: { select: { ownerId: true } } },
      })) as Array<{ team: { ownerId: string } | null }>;
      excluded = new Set(
        teams
          .map((t) => t.team?.ownerId)
          .filter((id): id is string => typeof id === "string"),
      );
    }

    sendSuccess(res, {
      coaches: results.map((r) => ({
        id: r.id,
        coachName: r.coachName,
        alreadyInSeason: excluded.has(r.id),
      })),
    });
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

// ---- Bindings ----

router.post(
  "/:leagueId/invitations",
  authUser,
  validate(createInvitationSchema),
  handleCreateInvitation,
);
router.get("/:leagueId/invitations", authUser, handleListInvitations);
router.delete(
  "/invitations/:invitationId",
  authUser,
  handleCancelInvitation,
);
router.get("/me/invitations", authUser, handleListMyInvitations);
router.get("/invitations/:code", handleGetInvitationByCode); // public
router.post(
  "/invitations/:code/accept",
  authUser,
  validate(acceptInvitationSchema),
  handleAcceptInvitation,
);
router.post("/invitations/:code/decline", authUser, handleDeclineInvitation);
router.get(
  "/coaches/search",
  authUser,
  validateQuery(searchCoachesQuerySchema),
  handleSearchCoaches,
);

export default router;
export { router as leagueInvitationRouter };
