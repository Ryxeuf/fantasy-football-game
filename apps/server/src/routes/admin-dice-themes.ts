/**
 * Routes admin des thèmes de dés et des cosmétiques des coachs.
 *
 * Catalogue :
 *  - GET   /admin/dice-themes                 — catalogue résolu + statistiques
 *  - PATCH /admin/dice-themes/:themeId        — libellés, prix, vente, ordre
 *  - POST  /admin/dice-themes/:themeId/reset  — retour au catalogue compilé
 *
 * Coachs :
 *  - GET    /admin/coach-cosmetics                          — liste paginée (solde, thèmes)
 *  - GET    /admin/coach-cosmetics/:userId                  — détail (acquisitions, journal)
 *  - POST   /admin/coach-cosmetics/:userId/dice-themes/:themeId   — offrir un thème
 *  - DELETE /admin/coach-cosmetics/:userId/dice-themes/:themeId   — retirer (± rembourser)
 *  - PUT    /admin/coach-cosmetics/:userId/dice-theme             — choisir son thème
 *  - GET    /admin/coach-cosmetics/:userId/crowns-rewards         — registre des récompenses
 *
 * Le solde de Crowns s'ajuste par `PATCH /admin/wallets/:userId/balance`.
 * Chaque mutation laisse une trace dans le journal admin (`AuditLog`).
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validate, validateParams, validateQuery } from "../middleware/validate";
import {
  adminCoachCosmeticsQuerySchema,
  adminCoachParamsSchema,
  adminCoachThemeParamsSchema,
  adminDiceThemeUpdateSchema,
  adminRevokeDiceThemeSchema,
  adminSetCoachDiceThemeSchema,
  diceThemeParamsSchema,
  type AdminCoachCosmeticsQuery,
  type AdminDiceThemeUpdateInput,
  type AdminRevokeDiceThemeInput,
  type AdminSetCoachDiceThemeInput,
} from "../schemas/dice-theme.schemas";
import {
  DiceThemeAdminError,
  getCoachCosmetics,
  grantDiceTheme,
  listCoachCosmetics,
  listDiceThemesForAdmin,
  resetDiceTheme,
  revokeDiceTheme,
  setCoachDiceTheme,
  updateDiceTheme,
} from "../services/dice-theme-admin";
import { listCrownsRewardsForAdmin } from "../services/crowns-rewards";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { serverLog } from "../utils/server-log";

const router = Router();

router.use(authUser, adminOnly);

const STATUS_BY_CODE: Record<DiceThemeAdminError["code"], number> = {
  "unknown-theme": 404,
  "default-theme-locked": 409,
  "user-not-found": 404,
  "theme-already-owned": 409,
  "theme-not-acquired": 404,
  "theme-not-owned": 409,
};

function fail(res: import("express").Response, e: unknown, context: string) {
  if (e instanceof DiceThemeAdminError) {
    return res.status(STATUS_BY_CODE[e.code]).json({ error: e.message, code: e.code });
  }
  serverLog.error(`[admin-dice-themes] ${context}`, e);
  return res.status(500).json({ error: "Erreur serveur" });
}

/* ── Catalogue ───────────────────────────────────────────────────────── */

router.get("/dice-themes", async (_req, res) => {
  try {
    return res.json({ themes: await listDiceThemesForAdmin() });
  } catch (e: unknown) {
    return fail(res, e, "lecture du catalogue échouée");
  }
});

router.patch(
  "/dice-themes/:themeId",
  validateParams(diceThemeParamsSchema),
  validate(adminDiceThemeUpdateSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { themeId } = req.params;
      const patch: AdminDiceThemeUpdateInput = req.body;
      const { before, after } = await updateDiceTheme(themeId, patch);
      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "dice-theme.update",
        entity: "DiceTheme",
        entityId: themeId,
        oldValue: { priceCrowns: before.priceCrowns, enabled: before.enabled, name: before.name },
        newValue: { patch },
      });
      return res.json({ theme: after });
    } catch (e: unknown) {
      return fail(res, e, "édition échouée");
    }
  },
);

router.post(
  "/dice-themes/:themeId/reset",
  validateParams(diceThemeParamsSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { themeId } = req.params;
      const { before, after } = await resetDiceTheme(themeId);
      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "dice-theme.reset",
        entity: "DiceTheme",
        entityId: themeId,
        oldValue: { priceCrowns: before.priceCrowns, enabled: before.enabled, name: before.name },
        newValue: { priceCrowns: after.priceCrowns, enabled: after.enabled, name: after.name },
      });
      return res.json({ theme: after });
    } catch (e: unknown) {
      return fail(res, e, "réinitialisation échouée");
    }
  },
);

/* ── Coachs ──────────────────────────────────────────────────────────── */

router.get(
  "/coach-cosmetics",
  validateQuery(adminCoachCosmeticsQuerySchema),
  async (req, res) => {
    try {
      // `validateQuery` a remplacé la query par sa version parsée (défauts compris).
      const query = req.query as unknown as AdminCoachCosmeticsQuery;
      return res.json(await listCoachCosmetics(query));
    } catch (e: unknown) {
      return fail(res, e, "liste des coachs échouée");
    }
  },
);

router.get(
  "/coach-cosmetics/:userId",
  validateParams(adminCoachParamsSchema),
  async (req, res) => {
    try {
      return res.json(await getCoachCosmetics(req.params.userId));
    } catch (e: unknown) {
      return fail(res, e, "détail du coach échoué");
    }
  },
);

router.get(
  "/coach-cosmetics/:userId/crowns-rewards",
  validateParams(adminCoachParamsSchema),
  async (req, res) => {
    try {
      const rewards = await listCrownsRewardsForAdmin(req.params.userId);
      if (!rewards) {
        return res.status(404).json({ error: "Utilisateur introuvable", code: "user-not-found" });
      }
      return res.json({ rewards });
    } catch (e: unknown) {
      return fail(res, e, "récompenses du coach échouées");
    }
  },
);

router.post(
  "/coach-cosmetics/:userId/dice-themes/:themeId",
  validateParams(adminCoachThemeParamsSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { userId, themeId } = req.params;
      const detail = await grantDiceTheme(userId, themeId, req.user!.id);
      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "coach.dice-theme.grant",
        entity: "UserDiceTheme",
        entityId: userId,
        newValue: { themeId },
      });
      return res.json(detail);
    } catch (e: unknown) {
      return fail(res, e, "cadeau échoué");
    }
  },
);

router.delete(
  "/coach-cosmetics/:userId/dice-themes/:themeId",
  validateParams(adminCoachThemeParamsSchema),
  validate(adminRevokeDiceThemeSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { userId, themeId } = req.params;
      const { refund }: AdminRevokeDiceThemeInput = req.body;
      const { detail, refunded } = await revokeDiceTheme(userId, themeId, { refund });
      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "coach.dice-theme.revoke",
        entity: "UserDiceTheme",
        entityId: userId,
        oldValue: { themeId },
        newValue: { refunded },
      });
      return res.json({ ...detail, refunded });
    } catch (e: unknown) {
      return fail(res, e, "retrait échoué");
    }
  },
);

router.put(
  "/coach-cosmetics/:userId/dice-theme",
  validateParams(adminCoachParamsSchema),
  validate(adminSetCoachDiceThemeSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { userId } = req.params;
      const { themeId }: AdminSetCoachDiceThemeInput = req.body;
      const before = await getCoachCosmetics(userId);
      const detail = await setCoachDiceTheme(userId, themeId);
      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "coach.dice-theme.select",
        entity: "User",
        entityId: userId,
        oldValue: { diceTheme: before.storedThemeId },
        newValue: { diceTheme: themeId },
      });
      return res.json(detail);
    } catch (e: unknown) {
      return fail(res, e, "choix du thème échoué");
    }
  },
);

export default router;
