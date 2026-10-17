/**
 * Pronostics de COUPE — routes, montées sur `/cup` AVANT `cupRoutes`.
 *
 *   GET    /cup/:id/predictions                       rondes + pronostics du lecteur
 *   GET    /cup/:id/predictions/leaderboard           classement (Coachs / Tribunes)
 *   PUT    /cup/pairings/:pairingId/prediction        pronostiquer
 *   DELETE /cup/pairings/:pairingId/prediction        retirer son pronostic
 *   POST   /cup/pairings/:pairingId/predictions/close fermer une rencontre
 *   POST   /cup/rounds/:roundId/predictions/close     fermer une ronde (commissaire)
 *   PATCH  /cup/:id/predictions-scope                 portée (commissaire / admin)
 *
 * Mêmes schémas que la ligue ; les règles vivent dans `services/cup-predictions`
 * et le module pur partagé. Même porte que `GET /cup/:id` : compte connecté.
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { hasRole } from "../utils/roles";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import {
  CupPredictionError,
  closeCupPairingPredictions,
  closeCupRoundPredictions,
  deleteCupPrediction,
  getCupPredictionLeaderboard,
  getCupPredictions,
  setCupPredictionsScope,
  upsertCupPrediction,
  type CupPredictionErrorCode,
} from "../services/cup-predictions";
import {
  predictionUpsertSchema,
  predictionsScopeSchema,
  type PredictionUpsertBody,
  type PredictionsScopeBody,
} from "../schemas/league-predictions.schemas";

const STATUS_BY_CODE: Readonly<Record<CupPredictionErrorCode, number>> = {
  cup_not_found: 404,
  pairing_not_found: 404,
  round_not_found: 404,
  prediction_not_found: 404,
  forbidden: 403,
  predictions_off: 403,
  not_member: 403,
  own_match: 403,
  placeholder: 409,
  closed: 409,
  invalid_prediction: 400,
};

function viewerOf(
  req: AuthenticatedRequest,
  res: Response,
): { userId: string; isAdmin: boolean } | null {
  if (!req.user?.id) {
    sendError(res, "Non authentifie", 401);
    return null;
  }
  return { userId: req.user.id, isAdmin: hasRole(req.user.roles, "admin") };
}

function predictionError(res: Response, e: unknown): void {
  if (e instanceof CupPredictionError) {
    sendError(res, e.message, STATUS_BY_CODE[e.code]);
    return;
  }
  serverLog.error("[cup-predictions] route failed", e);
  sendError(res, "Erreur serveur", 500);
}

export async function handleGetCupPredictions(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const viewer = viewerOf(req, res);
  if (!viewer) return;
  try {
    sendSuccess(res, await getCupPredictions({ cupId: req.params.id, viewer }));
  } catch (e: unknown) {
    predictionError(res, e);
  }
}

export async function handleGetCupPredictionLeaderboard(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const viewer = viewerOf(req, res);
  if (!viewer) return;
  try {
    sendSuccess(res, await getCupPredictionLeaderboard({ cupId: req.params.id, viewer }));
  } catch (e: unknown) {
    predictionError(res, e);
  }
}

export async function handleUpsertCupPrediction(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const viewer = viewerOf(req, res);
  if (!viewer) return;
  const body: PredictionUpsertBody = req.body;
  try {
    sendSuccess(
      res,
      await upsertCupPrediction({
        cupPairingId: req.params.pairingId,
        userId: viewer.userId,
        pick: body.pick,
        homeScore: body.homeScore,
        awayScore: body.awayScore,
      }),
    );
  } catch (e: unknown) {
    predictionError(res, e);
  }
}

export async function handleDeleteCupPrediction(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const viewer = viewerOf(req, res);
  if (!viewer) return;
  try {
    sendSuccess(
      res,
      await deleteCupPrediction({ cupPairingId: req.params.pairingId, userId: viewer.userId }),
    );
  } catch (e: unknown) {
    predictionError(res, e);
  }
}

export async function handleCloseCupPairingPredictions(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const viewer = viewerOf(req, res);
  if (!viewer) return;
  try {
    sendSuccess(
      res,
      await closeCupPairingPredictions({ cupPairingId: req.params.pairingId, viewer }),
    );
  } catch (e: unknown) {
    predictionError(res, e);
  }
}

export async function handleCloseCupRoundPredictions(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const viewer = viewerOf(req, res);
  if (!viewer) return;
  try {
    sendSuccess(res, await closeCupRoundPredictions({ roundId: req.params.roundId, viewer }));
  } catch (e: unknown) {
    predictionError(res, e);
  }
}

export async function handleSetCupPredictionsScope(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const viewer = viewerOf(req, res);
  if (!viewer) return;
  const body: PredictionsScopeBody = req.body;
  try {
    sendSuccess(
      res,
      await setCupPredictionsScope({ cupId: req.params.id, viewer, scope: body.scope }),
    );
  } catch (e: unknown) {
    predictionError(res, e);
  }
}

const router = Router();
router.get("/:id/predictions", authUser, handleGetCupPredictions);
router.get("/:id/predictions/leaderboard", authUser, handleGetCupPredictionLeaderboard);
router.put(
  "/pairings/:pairingId/prediction",
  authUser,
  validate(predictionUpsertSchema),
  handleUpsertCupPrediction,
);
router.delete("/pairings/:pairingId/prediction", authUser, handleDeleteCupPrediction);
router.post(
  "/pairings/:pairingId/predictions/close",
  authUser,
  handleCloseCupPairingPredictions,
);
router.post("/rounds/:roundId/predictions/close", authUser, handleCloseCupRoundPredictions);
router.patch(
  "/:id/predictions-scope",
  authUser,
  validate(predictionsScopeSchema),
  handleSetCupPredictionsScope,
);

export default router;
