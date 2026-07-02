/**
 * Routes API des invitations de coupe (miroir de league-invitation.ts).
 *
 * Endpoints (montés sous `/cup`) :
 *  - POST   /cup/:cupId/invitations       (commissaire)
 *  - GET    /cup/:cupId/invitations       (commissaire)
 *  - DELETE /cup/invitations/:invitationId (commissaire ou admin)
 *  - GET    /cup/invitations/:code        (public, info pré-acceptation)
 *  - POST   /cup/invitations/:code/accept (authentifié)
 *  - POST   /cup/invitations/:code/decline (authentifié)
 *  - GET    /cup/me/invitations           (authentifié)
 *  - GET    /cup/coaches/search           (authentifié, autocomplete)
 *
 * ORDRE : ce routeur DOIT être monté AVANT `cupRoutes` (les routes littérales
 * `/invitations/...`, `/me/...`, `/coaches/...` ne doivent pas être shadowées
 * par `/:id` de cup.ts).
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate, validateQuery } from "../middleware/validate";
import { prisma } from "../prisma";
import { hasRole } from "../utils/roles";
import {
  createCupInvitation,
  acceptCupInvitation,
  declineCupInvitation,
  cancelCupInvitation,
  listCupInvitations,
  listPendingCupInvitationsForUser,
  getCupInvitationByCode,
  CupInvitationError,
} from "../services/cup-invitation";
import { searchUsersByCoachName } from "../services/user-lookup";
import {
  createCupInvitationSchema,
  acceptCupInvitationSchema,
  searchCoachesQuerySchema,
  type CreateCupInvitationBody,
  type AcceptCupInvitationBody,
  type SearchCoachesQuery,
} from "../schemas/cup-invitation.schemas";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import { resolveWebOrigin } from "../config";

const router = Router();

function requireUserId(req: AuthenticatedRequest, res: Response): string | null {
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

/** Vérifie que l'user est créateur de la coupe (ou admin). */
async function requireCommissioner(
  req: AuthenticatedRequest,
  res: Response,
  cupId: string,
): Promise<{ id: string; creatorId: string } | null> {
  const userId = requireUserId(req, res);
  if (!userId) return null;
  const cup = await prisma.cup.findUnique({
    where: { id: cupId },
    select: { id: true, creatorId: true },
  });
  if (!cup) {
    sendError(res, "Coupe introuvable", 404);
    return null;
  }
  if (cup.creatorId !== userId && !isAdminReq(req)) {
    sendError(res, "Seul le commissaire de la coupe peut effectuer cette action", 403);
    return null;
  }
  return cup;
}

function mapInvitationError(res: Response, e: unknown): void {
  if (e instanceof CupInvitationError) {
    const status =
      e.code === "not_found" || e.code === "cup_not_found"
        ? 404
        : e.code === "cup_closed" ||
            e.code === "already_consumed" ||
            e.code === "expired" ||
            e.code === "already_registered" ||
            e.code === "already_engaged"
          ? 409
          : e.code === "forbidden" || e.code === "not_for_user"
            ? 403
            : e.code === "budget_exceeded" || e.code === "psp_exceeded"
              ? 422
              : 400;
    sendError(res, e.message, status);
    return;
  }
  const msg = e instanceof Error ? e.message : "Erreur inconnue";
  serverLog.error("[cup-invitation]", msg);
  sendError(res, msg, 500);
}

export async function handleCreateCupInvitation(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const cupId = req.params.cupId;
  const cup = await requireCommissioner(req, res, cupId);
  if (!cup) return;
  const body: CreateCupInvitationBody = req.body;
  try {
    const inv = await createCupInvitation({
      cupId,
      inviterUserId: req.user!.id,
      inviteeUserId: body.inviteeUserId ?? null,
      inviteeEmail: body.inviteeEmail ?? null,
      inviteeTeamId: body.inviteeTeamId ?? null,
      message: body.message ?? null,
      expiresInDays: body.expiresInDays,
      baseUrl: resolveWebOrigin(req.get("Origin")),
    });
    sendSuccess(res, inv, 201);
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

export async function handleListCupInvitations(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const cupId = req.params.cupId;
  const cup = await requireCommissioner(req, res, cupId);
  if (!cup) return;
  try {
    const items = await listCupInvitations(cupId);
    sendSuccess(res, { invitations: items });
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

export async function handleCancelCupInvitation(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const out = await cancelCupInvitation({
      invitationId: req.params.invitationId,
      byUserId: userId,
      isAdmin: isAdminReq(req),
    });
    sendSuccess(res, out);
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

export async function handleGetCupInvitationByCode(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const inv = await getCupInvitationByCode(req.params.code);
    sendSuccess(res, inv);
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

export async function handleAcceptCupInvitation(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const body: AcceptCupInvitationBody = req.body;
  try {
    const out = await acceptCupInvitation({
      code: req.params.code,
      userId,
      teamId: body.teamId,
    });
    sendSuccess(res, out);
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

export async function handleDeclineCupInvitation(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const out = await declineCupInvitation({ code: req.params.code, userId });
    sendSuccess(res, out);
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

export async function handleListMyCupInvitations(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const items = await listPendingCupInvitationsForUser(userId);
    sendSuccess(res, { invitations: items });
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

export async function handleSearchCoaches(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const query = req.query as unknown as SearchCoachesQuery;
  try {
    const results = await searchUsersByCoachName(query.q, query.limit ?? 10);
    sendSuccess(res, {
      coaches: results.map((r) => ({ id: r.id, coachName: r.coachName })),
    });
  } catch (e: unknown) {
    mapInvitationError(res, e);
  }
}

// ---- Bindings (littérales AVANT la paramétrique `/:cupId/...`) ----
router.get("/me/invitations", authUser, handleListMyCupInvitations);
router.delete("/invitations/:invitationId", authUser, handleCancelCupInvitation);
router.get("/invitations/:code", handleGetCupInvitationByCode); // public
router.post(
  "/invitations/:code/accept",
  authUser,
  validate(acceptCupInvitationSchema),
  handleAcceptCupInvitation,
);
router.post("/invitations/:code/decline", authUser, handleDeclineCupInvitation);
router.get(
  "/coaches/search",
  authUser,
  validateQuery(searchCoachesQuerySchema),
  handleSearchCoaches,
);

router.post(
  "/:cupId/invitations",
  authUser,
  validate(createCupInvitationSchema),
  handleCreateCupInvitation,
);
router.get("/:cupId/invitations", authUser, handleListCupInvitations);

export default router;
export { router as cupInvitationRouter };
