/**
 * Play-offs d'une coupe. Monté sur `/cup` AVANT `cupRoutes`, dont le
 * `GET /:id` avalerait `/playoffs`.
 *
 *   GET    /cup/:id/playoffs          bracket (gaté par la publication)
 *   POST   /cup/:id/playoffs/start    génère le premier tour (commissaire)
 *   PATCH  /cup/:id/playoffs/publish  publie / dépublie (commissaire)
 *   PATCH  /cup/:id/playoffs/seeds    réécrit les têtes de série (commissaire)
 *
 * La lecture est ouverte à tout utilisateur connecté : c'est le SERVICE qui
 * décide de ce qu'il sert selon le lecteur (un bracket non publié n'est
 * visible que du commissaire).
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { hasRole } from "../utils/roles";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import {
  CupPlayoffError,
  getCupBracket,
  overrideCupPlayoffSeeds,
  setCupPlayoffsPublished,
  startCupPlayoffs,
} from "../services/cup-playoffs";
import type { CupActor } from "../services/cup-rounds";
import {
  cupPlayoffSeedsSchema,
  publishCupPlayoffsSchema,
  startCupPlayoffsSchema,
  type CupPlayoffSeedsBody,
  type PublishCupPlayoffsBody,
  type StartCupPlayoffsBody,
} from "../schemas/cup-playoff.schemas";

function actorFromRequest(
  req: AuthenticatedRequest,
  res: Response,
): CupActor | null {
  const user = req.user;
  if (!user?.id) {
    sendError(res, "Non authentifie", 401);
    return null;
  }
  return { userId: user.id, isAdmin: hasRole(user.roles, "admin") };
}

function cupPlayoffError(res: Response, e: unknown): void {
  if (e instanceof CupPlayoffError) {
    const status =
      e.code === "cup_not_found"
        ? 404
        : e.code === "forbidden"
          ? 403
          : // Une configuration invalide vient de l'appelant : il peut la
            // corriger, ce n'est pas un conflit d'état.
            e.code === "playoffs_disabled" ||
              e.code === "size_mismatch" ||
              e.code === "duplicate_team" ||
              e.code === "team_not_in_cup"
            ? 400
            : 409;
    sendError(res, e.message, status);
    return;
  }
  serverLog.error("[cup-playoffs] route failed", e);
  sendError(res, "Erreur serveur", 500);
}

export async function handleGetCupBracket(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  try {
    sendSuccess(
      res,
      await getCupBracket({
        cupId: req.params.id,
        viewerId: actor.userId,
        isAdmin: actor.isAdmin,
      }),
    );
  } catch (e: unknown) {
    cupPlayoffError(res, e);
  }
}

export async function handleStartCupPlayoffs(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  const body: StartCupPlayoffsBody = req.body;
  try {
    const out = await startCupPlayoffs({
      cupId: req.params.id,
      actor,
      force: body.force === true,
    });
    sendSuccess(res, out, 201);
  } catch (e: unknown) {
    cupPlayoffError(res, e);
  }
}

export async function handlePublishCupPlayoffs(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  const body: PublishCupPlayoffsBody = req.body;
  try {
    sendSuccess(
      res,
      await setCupPlayoffsPublished({
        cupId: req.params.id,
        actor,
        published: body.published,
      }),
    );
  } catch (e: unknown) {
    cupPlayoffError(res, e);
  }
}

export async function handleOverrideCupPlayoffSeeds(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  const body: CupPlayoffSeedsBody = req.body;
  try {
    sendSuccess(
      res,
      await overrideCupPlayoffSeeds({
        cupId: req.params.id,
        actor,
        teamIds: body.teamIds,
      }),
    );
  } catch (e: unknown) {
    cupPlayoffError(res, e);
  }
}

const router = Router();
router.get("/:id/playoffs", authUser, handleGetCupBracket);
router.post(
  "/:id/playoffs/start",
  authUser,
  validate(startCupPlayoffsSchema),
  handleStartCupPlayoffs,
);
router.patch(
  "/:id/playoffs/publish",
  authUser,
  validate(publishCupPlayoffsSchema),
  handlePublishCupPlayoffs,
);
router.patch(
  "/:id/playoffs/seeds",
  authUser,
  validate(cupPlayoffSeedsSchema),
  handleOverrideCupPlayoffSeeds,
);

export default router;
