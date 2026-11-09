/**
 * Retrait d'une équipe d'une saison de ligue par son commissaire (ou un
 * admin), en cours de saison, avec le sort de ses rencontres restantes.
 * Monté sur `/leagues` avant le routeur historique (route littérale, aucun
 * recouvrement) :
 *
 *   POST /leagues/seasons/:seasonId/participants/:participantId/withdraw
 *        { remaining: "forfeit" | "cancel" }
 *
 * Le retrait par le coach lui-même (`POST /seasons/:id/leave`) reste réservé
 * à l'avant-saison ; le retrait admin historique
 * (`/admin/leagues/.../force-withdraw`) reste en place.
 */

import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { hasRole } from "../utils/roles";
import { apiError, sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import { LeagueWithdrawError } from "../services/league";
import {
  CommissionerWithdrawalError,
  withdrawParticipantByCommissioner,
  type CommissionerWithdrawalErrorCode,
} from "../services/league-commissioner-withdrawal";

export const commissionerWithdrawSchema = z.object({
  remaining: z.enum(["forfeit", "cancel"]),
});
export type CommissionerWithdrawBody = z.infer<
  typeof commissionerWithdrawSchema
>;

export function commissionerWithdrawalStatus(
  code: CommissionerWithdrawalErrorCode,
): number {
  if (code === "season_not_found" || code === "participant_not_found") {
    return 404;
  }
  if (code === "forbidden") return 403;
  return 409;
}

/** POST /leagues/seasons/:seasonId/participants/:participantId/withdraw */
export async function handleCommissionerWithdraw(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const user = req.user;
  if (!user?.id) {
    sendError(res, "Non authentifie", 401);
    return;
  }
  const body: CommissionerWithdrawBody = req.body;
  try {
    const out = await withdrawParticipantByCommissioner(
      {
        seasonId: req.params.seasonId,
        participantId: req.params.participantId,
        remaining: body.remaining,
      },
      { userId: user.id, isAdmin: hasRole(user.roles ?? [], "admin") },
    );
    sendSuccess(res, out);
  } catch (e: unknown) {
    if (e instanceof CommissionerWithdrawalError) {
      res.status(commissionerWithdrawalStatus(e.code)).json({
        ...apiError(e.message),
        code: e.code,
        ...(e.engagedPairingIds
          ? { details: { engagedPairingIds: e.engagedPairingIds } }
          : {}),
      });
      return;
    }
    if (e instanceof LeagueWithdrawError) {
      sendError(res, e.message, e.code === "not_registered" ? 404 : 409);
      return;
    }
    serverLog.error("[league-commissioner-withdrawal] route failed", e);
    sendError(res, "Erreur serveur", 500);
  }
}

const router = Router();

router.post(
  "/seasons/:seasonId/participants/:participantId/withdraw",
  authUser,
  validate(commissionerWithdrawSchema),
  handleCommissionerWithdraw,
);

export default router;
