/**
 * Routes admin des Couronnes (Crowns) et des wallets.
 *
 * Wallets :
 *  - GET  /admin/wallets                  — liste des coachs, filtre avec / sans wallet
 *  - POST /admin/wallets/create-missing   — crée le wallet de tous les coachs qui n'en ont pas
 *  - POST /admin/wallets/:userId          — crée le wallet d'un coach (idempotent)
 *
 * Couronnes :
 *  - GET  /admin/crowns/overview          — masse en circulation, flux par type, flag
 *  - GET  /admin/crowns/transactions      — journal global, filtrable par type / coach
 *
 * Le détail d'un wallet, l'ajustement de solde et le remboursement d'un pari
 * restent dans `admin-wallet.ts`. Chaque création laisse une trace dans le
 * journal admin (`AuditLog`).
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validateParams, validateQuery } from "../middleware/validate";
import {
  adminCrownsLedgerQuerySchema,
  adminCrownsOverviewQuerySchema,
  adminWalletListQuerySchema,
  adminWalletParamsSchema,
  type AdminCrownsLedgerQuery,
  type AdminCrownsOverviewQuery,
  type AdminWalletListQuery,
} from "../schemas/crowns-admin.schemas";
import {
  CrownsAdminError,
  createCoachWallet,
  createMissingWallets,
  getCrownsOverview,
  listCoachWallets,
  listCrownsLedger,
} from "../services/crowns-admin";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { serverLog } from "../utils/server-log";

const router = Router();

router.use(authUser, adminOnly);

const STATUS_BY_CODE: Record<CrownsAdminError["code"], number> = {
  "user-not-found": 404,
};

function fail(res: import("express").Response, e: unknown, context: string) {
  if (e instanceof CrownsAdminError) {
    return res.status(STATUS_BY_CODE[e.code]).json({ error: e.message, code: e.code });
  }
  serverLog.error(`[admin-crowns] ${context}`, e);
  return res.status(500).json({ error: "Erreur serveur" });
}

/* ── Wallets ─────────────────────────────────────────────────────────── */

router.get("/wallets", validateQuery(adminWalletListQuerySchema), async (req, res) => {
  try {
    // `validateQuery` a remplacé la query par sa version parsée (défauts compris).
    const query = req.query as unknown as AdminWalletListQuery;
    return res.json(await listCoachWallets(query));
  } catch (e: unknown) {
    return fail(res, e, "liste des wallets échouée");
  }
});

// Déclarée AVANT `/wallets/:userId` : sinon « create-missing » serait lu
// comme un identifiant de coach.
router.post("/wallets/create-missing", async (req: AuthenticatedRequest, res) => {
  try {
    const result = await createMissingWallets();
    if (result.created > 0) {
      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "wallet.create-missing",
        entity: "ProWallet",
        entityId: "*",
        newValue: { ...result },
      });
    }
    return res.json(result);
  } catch (e: unknown) {
    return fail(res, e, "création des wallets manquants échouée");
  }
});

router.post(
  "/wallets/:userId",
  validateParams(adminWalletParamsSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { userId } = req.params;
      const result = await createCoachWallet(userId);
      if (result.created) {
        await safeRecordAdminActionFromRequest(prisma, req, {
          action: "wallet.create",
          entity: "ProWallet",
          entityId: userId,
          newValue: { crowns: result.wallet.crowns },
        });
      }
      return res.status(result.created ? 201 : 200).json(result);
    } catch (e: unknown) {
      return fail(res, e, "création du wallet échouée");
    }
  },
);

/* ── Couronnes ───────────────────────────────────────────────────────── */

router.get("/crowns/overview", validateQuery(adminCrownsOverviewQuerySchema), async (req, res) => {
  try {
    const { days } = req.query as unknown as AdminCrownsOverviewQuery;
    return res.json(await getCrownsOverview(days));
  } catch (e: unknown) {
    return fail(res, e, "vue d'ensemble échouée");
  }
});

router.get("/crowns/transactions", validateQuery(adminCrownsLedgerQuerySchema), async (req, res) => {
  try {
    const query = req.query as unknown as AdminCrownsLedgerQuery;
    return res.json(await listCrownsLedger(query));
  } catch (e: unknown) {
    return fail(res, e, "journal des Couronnes échoué");
  }
});

export default router;
