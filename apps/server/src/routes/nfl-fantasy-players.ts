/**
 * Routes publiques (auth user) du catalogue NFL Fantasy / Nuffle Coach.
 *
 * Sous `/api/nfl-fantasy/players`, protege par authUser uniquement
 * (pas adminOnly). Reutilise les services existants
 * `listNflPlayersForAdmin` et `getNflPlayerDetail` — le filtrage
 * `realName` (V1 prive) est applique par le service lui-meme via
 * `realNameDisplay`.
 *
 *   GET  /                  liste paginee + filtres (seasonId, teamCode,
 *                           bbPosition, nflPosition, status, search)
 *   GET  /:id?seasonId=     fiche player + stats agregees saison
 */

import { Router } from "express";
import { z } from "zod";

import { authUser } from "../middleware/authUser";
import { validateQuery } from "../middleware/validate";
import { prisma } from "../prisma";
import {
  getNflPlayerDetail,
  listNflPlayersForAdmin,
} from "../services/nfl-fantasy-admin-explorer";
import { getPlayerValueHistory } from "../services/nfl-fantasy-player-value";
import { sendNflError } from "../utils/nfl-error-mapper";
import { serverLog } from "../utils/server-log";

const router = Router();
router.use(authUser);

const seasonIdParam = z.string().regex(/^\d{4}$/).optional();

const playersListSchema = z.object({
  seasonId: seasonIdParam,
  teamCode: z.string().min(2).max(4).optional(),
  bbPosition: z.string().min(1).max(20).optional(),
  nflPosition: z.string().min(1).max(20).optional(),
  status: z.enum(["active", "ir", "retired", "suspended"]).optional(),
  search: z.string().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  // Filtres mercato (V3)
  bbRace: z.string().min(2).max(40).optional(),
  city: z.string().min(2).max(80).optional(),
  jerseyNumber: z.coerce.number().int().min(0).max(99).optional(),
  excludeFromLeagueId: z.string().min(1).max(40).optional(),
  // Tri
  sortBy: z
    .enum([
      "pseudonym",
      "bbPosition",
      "teamCode",
      "jerseyNumber",
      "currentValue",
    ])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

const playerDetailSchema = z.object({
  seasonId: seasonIdParam,
});

router.get("/", validateQuery(playersListSchema), async (req, res) => {
  try {
    const q = req.query as z.infer<typeof playersListSchema>;
    const out = await listNflPlayersForAdmin({
      seasonId: q.seasonId,
      teamCode: q.teamCode?.toUpperCase(),
      bbPosition: q.bbPosition,
      nflPosition: q.nflPosition?.toUpperCase(),
      status: q.status,
      search: q.search,
      page: q.page,
      pageSize: q.pageSize,
      bbRace: q.bbRace,
      city: q.city,
      jerseyNumber: q.jerseyNumber,
      excludeFromLeagueId: q.excludeFromLeagueId,
      sortBy: q.sortBy,
      sortDir: q.sortDir,
    });
    // V3 — Enrichi avec currentValue + previousValue (cote dynamique
    // mise a jour apres chaque settle week). Fournit aussi basePrice
    // comme alias de currentValue pour retro-compat UI V2.
    const ids = out.players.map((p) => p.id);
    const valueByPlayer = new Map<
      string,
      { current: number; previous: number }
    >();
    if (ids.length > 0) {
      const rows = await prisma.nflPlayer.findMany({
        where: { id: { in: ids } },
        select: { id: true, currentValue: true, previousValue: true },
      });
      type ValueRow = (typeof rows)[number];
      for (const r of rows as ValueRow[]) {
        valueByPlayer.set(r.id, {
          current: r.currentValue,
          previous: r.previousValue,
        });
      }
    }
    const players = out.players.map((p) => {
      const v = valueByPlayer.get(p.id) ?? { current: 50, previous: 50 };
      return {
        ...p,
        currentValue: v.current,
        previousValue: v.previous,
        basePrice: v.current,
      };
    });
    res.json({ ...out, players });
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-players] list failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.get(
  "/:id",
  validateQuery(playerDetailSchema),
  async (req, res) => {
    try {
      const q = req.query as z.infer<typeof playerDetailSchema>;
      const [detail, valueRow] = await Promise.all([
        getNflPlayerDetail({ id: req.params.id, seasonId: q.seasonId }),
        prisma.nflPlayer.findUnique({
          where: { id: req.params.id },
          select: {
            currentValue: true,
            previousValue: true,
            valueRecomputedAt: true,
          },
        }),
      ]);
      if (!detail) {
        res.status(404).json({
          error: `Joueur ${req.params.id} introuvable`,
          code: "PLAYER_NOT_FOUND",
        });
        return;
      }
      // Sanitize bio pour la voie publique : on ne fuit jamais l'image
      // officielle NFL (droit a l'image / NIL) ni la date de naissance
      // exacte (donnee perso directement identifiante). Le age estime
      // reste expose, ainsi que college/draft/exp qui sont des donnees
      // wikipedia-level partagees publiquement.
      const safeBio = {
        ...detail.bio,
        headshotUrl: null,
        birthDate: null,
      };
      res.json({
        ...detail,
        bio: safeBio,
        currentValue: valueRow?.currentValue ?? 50,
        previousValue: valueRow?.previousValue ?? 50,
        valueRecomputedAt: valueRow?.valueRecomputedAt ?? null,
      });
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[nfl-fantasy-players] detail failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

// V3 — historique des cotes (1 row par week ou la cote a change).
// Utilise par l'UI pour afficher un graph d'evolution.
const valueHistorySchema = z.object({
  seasonId: z.string().regex(/^\d{4}$/),
});

router.get(
  "/:id/value-history",
  validateQuery(valueHistorySchema),
  async (req, res) => {
    try {
      const q = req.query as z.infer<typeof valueHistorySchema>;
      const history = await getPlayerValueHistory({
        playerId: req.params.id,
        seasonId: q.seasonId,
      });
      res.json({ history });
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[nfl-fantasy-players] value-history failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

export default router;
