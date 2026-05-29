/**
 * Routes publiques (sans auth) NFL Fantasy — donnees de reference
 * statiques exposees pour la page de regles, la page carriere et les
 * autres surfaces de lecture qui ont besoin de la convention de
 * scoring.
 *
 *   GET /skill-effects   Catalogue des skills BB avec effet SPP
 */

import { Router } from "express";

import { NFL_FANTASY_SKILL_EFFECTS } from "../services/nfl-fantasy-skill-bonus";

const router = Router();

router.get("/skill-effects", (_req, res) => {
  res.json({ effects: NFL_FANTASY_SKILL_EFFECTS });
});

export default router;
