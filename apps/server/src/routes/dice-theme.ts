/**
 * Thème de dés du coach connecté (Dé de Blocage + D6).
 *
 *  - GET /dice-themes/me  (authUser) → thème effectif + catalogue possédé
 *  - PUT /dice-themes/me  (authUser) → choisit un thème possédé
 *
 * Monté derrière `requireFeatureFlag(DICE_THEMES_FLAG)` (cf. index.ts) :
 * flag OFF, tout le monde voit le thème par défaut et ne peut pas en changer.
 */

import { Router } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import {
  diceThemePreferenceSchema,
  type DiceThemePreferenceInput,
} from "../schemas/dice-theme.schemas";
import {
  DiceThemeError,
  getDiceThemePreference,
  setDiceThemePreference,
} from "../services/dice-theme-preference";
import { serverLog } from "../utils/server-log";

const router = Router();

const STATUS_BY_CODE: Record<DiceThemeError["code"], number> = {
  "unknown-theme": 400,
  "theme-not-owned": 403,
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
          .status(STATUS_BY_CODE[e.code])
          .json({ error: e.message, code: e.code });
      }
      serverLog.error("[dice-theme] écriture échouée", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

export default router;
