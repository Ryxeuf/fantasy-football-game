/**
 * Poules d'une coupe. Monté sur `/cup` AVANT `cupRoutes`, dont le `GET /:id`
 * avalerait `/pools/...`.
 *
 *   GET    /cup/:id/pools               poules + effectifs (auth)
 *   POST   /cup/:id/pools               crée une poule (commissaire)
 *   POST   /cup/:id/pools/assign        affecte des équipes (commissaire)
 *   POST   /cup/:id/pools/auto-assign   répartition serpentin (commissaire)
 *   PATCH  /cup/pools/:poolId           renomme / quota / ordre / couleur
 *   DELETE /cup/pools/:poolId           supprime une poule vide
 *
 * L'autorisation et les fenêtres d'édition vivent dans `services/cup-pool` ;
 * ici on ne fait que traduire les erreurs typées en statuts HTTP.
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { hasRole } from "../utils/roles";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import {
  assignCupPools,
  autoAssignCupPools,
  createCupPool,
  CupPoolError,
  deleteCupPool,
  listCupPools,
  updateCupPool,
} from "../services/cup-pool";
import type { CupActor } from "../services/cup-rounds";
import {
  assignCupPoolsSchema,
  createCupPoolSchema,
  updateCupPoolSchema,
  type AssignCupPoolsBody,
  type CreateCupPoolBody,
  type UpdateCupPoolBody,
} from "../schemas/cup-pool.schemas";

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

function cupPoolError(res: Response, e: unknown): void {
  if (e instanceof CupPoolError) {
    const status =
      e.code === "cup_not_found" ||
      e.code === "pool_not_found" ||
      e.code === "participant_not_found"
        ? 404
        : e.code === "forbidden"
          ? 403
          : 409;
    sendError(res, e.message, status);
    return;
  }
  serverLog.error("[cup-pools] route failed", e);
  sendError(res, "Erreur serveur", 500);
}

export async function handleListCupPools(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!actorFromRequest(req, res)) return;
  try {
    sendSuccess(res, { pools: await listCupPools(req.params.id) });
  } catch (e: unknown) {
    cupPoolError(res, e);
  }
}

export async function handleCreateCupPool(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  const body: CreateCupPoolBody = req.body;
  try {
    const pool = await createCupPool({
      cupId: req.params.id,
      actor,
      name: body.name,
      qualifiesForPlayoffs: body.qualifiesForPlayoffs,
      // `null` efface la couleur, `undefined` la laisse au défaut.
      color: body.color ?? null,
      order: body.order,
    });
    sendSuccess(res, { pool }, 201);
  } catch (e: unknown) {
    cupPoolError(res, e);
  }
}

export async function handleUpdateCupPool(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  const body: UpdateCupPoolBody = req.body;
  try {
    const pool = await updateCupPool({
      poolId: req.params.poolId,
      actor,
      name: body.name,
      qualifiesForPlayoffs: body.qualifiesForPlayoffs,
      // Ici `undefined` signifie « ne touche pas » : une édition partielle ne
      // doit pas effacer une couleur qu'elle n'évoque pas.
      color: body.color ?? undefined,
      order: body.order,
    });
    sendSuccess(res, { pool });
  } catch (e: unknown) {
    cupPoolError(res, e);
  }
}

export async function handleDeleteCupPool(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  try {
    sendSuccess(res, await deleteCupPool({ poolId: req.params.poolId, actor }));
  } catch (e: unknown) {
    cupPoolError(res, e);
  }
}

export async function handleAssignCupPools(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  const body: AssignCupPoolsBody = req.body;
  try {
    sendSuccess(
      res,
      await assignCupPools({
        cupId: req.params.id,
        actor,
        assignments: body.assignments,
      }),
    );
  } catch (e: unknown) {
    cupPoolError(res, e);
  }
}

export async function handleAutoAssignCupPools(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  try {
    sendSuccess(res, await autoAssignCupPools({ cupId: req.params.id, actor }));
  } catch (e: unknown) {
    cupPoolError(res, e);
  }
}

const router = Router();
router.get("/:id/pools", authUser, handleListCupPools);
router.post(
  "/:id/pools",
  authUser,
  validate(createCupPoolSchema),
  handleCreateCupPool,
);
router.post(
  "/:id/pools/assign",
  authUser,
  validate(assignCupPoolsSchema),
  handleAssignCupPools,
);
router.post("/:id/pools/auto-assign", authUser, handleAutoAssignCupPools);
router.patch(
  "/pools/:poolId",
  authUser,
  validate(updateCupPoolSchema),
  handleUpdateCupPool,
);
router.delete("/pools/:poolId", authUser, handleDeleteCupPool);

export default router;
