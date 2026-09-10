/**
 * Rondes d'une coupe. Monté sur `/cup` AVANT `cupRoutes`
 * (dont le `GET /:id` avalerait `/pairings/...`).
 *
 *   GET    /cup/:id/rounds                  rondes + rencontres (auth)
 *   POST   /cup/:id/rounds                  génère la ronde suivante, au choix
 *                                           tirée au sort / suisse / manuelle
 *   POST   /cup/:id/rounds/swiss            idem, forcé en suisse (historique)
 *   DELETE /cup/:id/rounds/last             supprime la dernière ronde (commissaire)
 *   PATCH  /cup/pairings/:pairingId/schedule date prévisionnelle (coachs / commissaire)
 *   POST   /cup/pairings/:pairingId/cancel  annule une rencontre (commissaire)
 *
 * L'autorisation vit dans `services/cup-rounds` (créateur ou admin, coachs
 * impliqués pour la date) ; ici on ne fait que mapper les erreurs typées.
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { hasRole } from "../utils/roles";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import {
  schedulePairingSchema,
  type SchedulePairingBody,
} from "../schemas/league-pairing-schedule.schemas";
import {
  cancelCupPairing,
  deleteLastCupRound,
  generateCupRound,
  generateSwissCupRound,
  listCupRounds,
  scheduleCupPairing,
  CupRoundError,
  type CupActor,
} from "../services/cup-rounds";
import {
  generateCupRoundSchema,
  type GenerateCupRoundBody,
} from "../schemas/cup-round.schemas";

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

function cupRoundError(res: Response, e: unknown): void {
  if (e instanceof CupRoundError) {
    const status =
      e.code === "cup_not_found" ||
      e.code === "round_not_found" ||
      e.code === "pairing_not_found"
        ? 404
        : e.code === "forbidden"
          ? 403
          : // Une saisie manuelle incohérente est une erreur de REQUÊTE
            // (l'appelant peut la corriger), pas un conflit d'état.
            e.code === "invalid_pairings" || e.code === "unknown_system"
            ? 400
            : 409;
    sendError(res, e.message, status);
    return;
  }
  serverLog.error("[cup-rounds] route failed", e);
  sendError(res, "Erreur serveur", 500);
}

export async function handleListCupRounds(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!actorFromRequest(req, res)) return;
  try {
    const rounds = await listCupRounds(req.params.id);
    sendSuccess(res, { rounds });
  } catch (e: unknown) {
    cupRoundError(res, e);
  }
}

export async function handleGenerateSwissRound(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  try {
    const round = await generateSwissCupRound({ cupId: req.params.id, actor });
    sendSuccess(res, { round }, 201);
  } catch (e: unknown) {
    cupRoundError(res, e);
  }
}

export async function handleGenerateCupRound(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  const body: GenerateCupRoundBody = req.body;
  try {
    const round = await generateCupRound({
      cupId: req.params.id,
      actor,
      system: body.system,
      pairings: body.pairings,
    });
    sendSuccess(res, { round }, 201);
  } catch (e: unknown) {
    cupRoundError(res, e);
  }
}

export async function handleDeleteLastCupRound(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  try {
    const out = await deleteLastCupRound({ cupId: req.params.id, actor });
    sendSuccess(res, out);
  } catch (e: unknown) {
    cupRoundError(res, e);
  }
}

export async function handleScheduleCupPairing(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  const body: SchedulePairingBody = req.body;
  try {
    const out = await scheduleCupPairing({
      pairingId: req.params.pairingId,
      actor,
      scheduledAt: body.scheduledAt,
    });
    sendSuccess(res, out);
  } catch (e: unknown) {
    cupRoundError(res, e);
  }
}

export async function handleCancelCupPairing(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const actor = actorFromRequest(req, res);
  if (!actor) return;
  try {
    const out = await cancelCupPairing({ pairingId: req.params.pairingId, actor });
    sendSuccess(res, out);
  } catch (e: unknown) {
    cupRoundError(res, e);
  }
}

const router = Router();
router.get("/:id/rounds", authUser, handleListCupRounds);
router.post(
  "/:id/rounds",
  authUser,
  validate(generateCupRoundSchema),
  handleGenerateCupRound,
);
router.post("/:id/rounds/swiss", authUser, handleGenerateSwissRound);
router.delete("/:id/rounds/last", authUser, handleDeleteLastCupRound);
router.patch(
  "/pairings/:pairingId/schedule",
  authUser,
  validate(schedulePairingSchema),
  handleScheduleCupPairing,
);
router.post("/pairings/:pairingId/cancel", authUser, handleCancelCupPairing);

export default router;
