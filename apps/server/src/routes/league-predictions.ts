/**
 * Pronostics de ligue — routes, montées sur `/leagues` à côté des autres
 * routeurs de ligue (`routes/league.ts` dépasse 3 600 lignes).
 *
 * Les handlers ne font que l'authentification, le parse et le format : les
 * règles (visibilité, portée, clôture, rien des autres avant la clôture)
 * vivent dans `services/league-predictions` et son module pur. Une ligue
 * privée invisible répond 404 sur TOUTES ces routes, lecture comme écriture.
 */

import { Router } from "express";
import type { Response } from "express";
import {
  authUser,
  optionalAuthUser,
  type AuthenticatedRequest,
} from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { hasRole } from "../utils/roles";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import type { LeagueViewer } from "../services/league-access";
import {
  LeaguePredictionError,
  closePairingPredictions,
  closeRoundPredictions,
  deletePrediction,
  getSeasonPredictionLeaderboard,
  getSeasonPredictions,
  setLeaguePredictionsScope,
  upsertPrediction,
  type LeaguePredictionErrorCode,
} from "../services/league-predictions";
import {
  predictionUpsertSchema,
  predictionsScopeSchema,
  type PredictionUpsertBody,
  type PredictionsScopeBody,
} from "../schemas/league-predictions.schemas";

const router = Router();

const STATUS_BY_CODE: Readonly<Record<LeaguePredictionErrorCode, number>> = {
  season_not_found: 404,
  pairing_not_found: 404,
  round_not_found: 404,
  league_not_found: 404,
  prediction_not_found: 404,
  forbidden: 403,
  predictions_off: 403,
  not_member: 403,
  own_match: 403,
  placeholder: 409,
  closed: 409,
  invalid_prediction: 400,
};

function viewerOf(req: AuthenticatedRequest): LeagueViewer {
  return {
    userId: req.user?.id ?? null,
    isAdmin: hasRole(req.user?.roles ?? [], "admin"),
  };
}

/** Lecteur connecté (derrière `authUser`) ; 401 sinon. */
function authenticatedViewer(
  req: AuthenticatedRequest,
  res: Response,
): (LeagueViewer & { readonly userId: string }) | null {
  const userId = req.user?.id;
  if (!userId) {
    sendError(res, "Non authentifie", 401);
    return null;
  }
  return { userId, isAdmin: hasRole(req.user?.roles ?? [], "admin") };
}

function predictionError(res: Response, e: unknown): void {
  if (e instanceof LeaguePredictionError) {
    sendError(res, e.message, STATUS_BY_CODE[e.code]);
    return;
  }
  serverLog.error("[league-predictions] erreur inattendue", e);
  sendError(res, "Erreur interne", 500);
}

/** GET /leagues/seasons/:seasonId/predictions — journées et pronostics. */
export async function handleGetSeasonPredictions(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const view = await getSeasonPredictions({
      seasonId: req.params.seasonId,
      viewer: viewerOf(req),
    });
    sendSuccess(res, view);
  } catch (e: unknown) {
    predictionError(res, e);
  }
}

/** GET /leagues/seasons/:seasonId/predictions/leaderboard — deux onglets. */
export async function handleGetPredictionLeaderboard(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const board = await getSeasonPredictionLeaderboard({
      seasonId: req.params.seasonId,
      viewer: viewerOf(req),
    });
    sendSuccess(res, board);
  } catch (e: unknown) {
    predictionError(res, e);
  }
}

/** PUT /leagues/pairings/:pairingId/prediction — pose ou modifie son pronostic. */
export async function handleUpsertPrediction(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const viewer = authenticatedViewer(req, res);
  if (!viewer) return;
  const body: PredictionUpsertBody = req.body;
  try {
    const prediction = await upsertPrediction({
      pairingId: req.params.pairingId,
      viewer,
      pick: body.pick,
      homeScore: body.homeScore ?? null,
      awayScore: body.awayScore ?? null,
    });
    sendSuccess(res, { prediction });
  } catch (e: unknown) {
    predictionError(res, e);
  }
}

/** DELETE /leagues/pairings/:pairingId/prediction — retire son pronostic. */
export async function handleDeletePrediction(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const viewer = authenticatedViewer(req, res);
  if (!viewer) return;
  try {
    sendSuccess(
      res,
      await deletePrediction({ pairingId: req.params.pairingId, viewer }),
    );
  } catch (e: unknown) {
    predictionError(res, e);
  }
}

/** POST /leagues/pairings/:pairingId/predictions/close — « Coup d'envoi ». */
export async function handleClosePairingPredictions(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const viewer = authenticatedViewer(req, res);
  if (!viewer) return;
  try {
    sendSuccess(
      res,
      await closePairingPredictions({ pairingId: req.params.pairingId, viewer }),
    );
  } catch (e: unknown) {
    predictionError(res, e);
  }
}

/** POST /leagues/rounds/:roundId/predictions/close — toute la journée. */
export async function handleCloseRoundPredictions(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const viewer = authenticatedViewer(req, res);
  if (!viewer) return;
  try {
    sendSuccess(
      res,
      await closeRoundPredictions({ roundId: req.params.roundId, viewer }),
    );
  } catch (e: unknown) {
    predictionError(res, e);
  }
}

/**
 * PATCH /leagues/:id/predictions-scope — commissaire ou admin, HORS verrou
 * d'édition : la portée est une règle de lecture, aucun compteur n'en dépend.
 */
export async function handleSetPredictionsScope(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const viewer = authenticatedViewer(req, res);
  if (!viewer) return;
  const body: PredictionsScopeBody = req.body;
  try {
    sendSuccess(
      res,
      await setLeaguePredictionsScope({
        leagueId: req.params.id,
        viewer,
        scope: body.scope,
      }),
    );
  } catch (e: unknown) {
    predictionError(res, e);
  }
}

router.get(
  "/seasons/:seasonId/predictions",
  optionalAuthUser,
  handleGetSeasonPredictions,
);
router.get(
  "/seasons/:seasonId/predictions/leaderboard",
  optionalAuthUser,
  handleGetPredictionLeaderboard,
);
router.put(
  "/pairings/:pairingId/prediction",
  authUser,
  validate(predictionUpsertSchema),
  handleUpsertPrediction,
);
router.delete(
  "/pairings/:pairingId/prediction",
  authUser,
  handleDeletePrediction,
);
router.post(
  "/pairings/:pairingId/predictions/close",
  authUser,
  handleClosePairingPredictions,
);
router.post(
  "/rounds/:roundId/predictions/close",
  authUser,
  handleCloseRoundPredictions,
);
router.patch(
  "/:id/predictions-scope",
  authUser,
  validate(predictionsScopeSchema),
  handleSetPredictionsScope,
);

export default router;
export { router as leaguePredictionsRouter };
