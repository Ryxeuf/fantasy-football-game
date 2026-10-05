/**
 * Thème de dés du coach connecté (Dé de Blocage + D6).
 *
 *  - GET  /dice-themes/me                 (authUser) → thème effectif + boutique
 *  - PUT  /dice-themes/me                 (authUser) → choisit un thème possédé
 *  - POST /dice-themes/:themeId/purchase  (authUser + flag `crowns`) → achète
 *    le thème en Crowns et l'équipe
 *
 * Monté derrière `requireFeatureFlag(DICE_THEMES_FLAG)` (cf. index.ts) :
 * flag OFF, tout le monde voit le dé original et ne peut pas en changer.
 */

import { Router } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { requireFeatureFlag } from "../middleware/requireFeatureFlag";
import { validate, validateParams } from "../middleware/validate";
import {
  diceThemeParamsSchema,
  diceThemePreferenceSchema,
  type DiceThemeParams,
  type DiceThemePreferenceInput,
} from "../schemas/dice-theme.schemas";
import { CROWNS_FLAG } from "../services/featureFlags";
import {
  DiceThemeError,
  getDiceThemePreference,
  purchaseDiceTheme,
  setDiceThemePreference,
} from "../services/dice-theme-preference";
import { serverLog } from "../utils/server-log";

const router = Router();

export const DICE_THEME_STATUS_BY_CODE: Record<DiceThemeError["code"], number> = {
  "unknown-theme": 400,
  "theme-not-owned": 403,
  "theme-not-for-sale": 409,
  "theme-already-owned": 409,
  "insufficient-funds": 402,
  "user-not-found": 404,
};

router.get("/me", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    return res.json(await getDiceThemePreference(req.user!.id));
  } catch (e: unknown) {
    serverLog.error("[dice-theme] lecture échouée", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

router.put(
  "/me",
  authUser,
  validate(diceThemePreferenceSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { themeId }: DiceThemePreferenceInput = req.body;
      return res.json(await setDiceThemePreference(req.user!.id, themeId));
    } catch (e: unknown) {
      if (e instanceof DiceThemeError) {
        return res
          .status(DICE_THEME_STATUS_BY_CODE[e.code])
          .json({ error: e.message, code: e.code });
      }
      serverLog.error("[dice-theme] écriture échouée", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

router.post(
  "/:themeId/purchase",
  authUser,
  requireFeatureFlag(CROWNS_FLAG),
  validateParams(diceThemeParamsSchema),
  async (req: AuthenticatedRequest, res) => {
    // Un admin connecté « en tant que » un coach ne dépense pas ses Crowns.
    if (req.user!.impersonatorId) {
      return res.status(403).json({
        error: "Achat impossible pendant une impersonation",
        code: "impersonation-forbidden",
      });
    }
    try {
      const { themeId } = req.params as DiceThemeParams;
      return res.json(await purchaseDiceTheme(req.user!.id, themeId));
    } catch (e: unknown) {
      if (e instanceof DiceThemeError) {
        return res
          .status(DICE_THEME_STATUS_BY_CODE[e.code])
          .json({ error: e.message, code: e.code });
      }
      serverLog.error("[dice-theme] achat échoué", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

export default router;
