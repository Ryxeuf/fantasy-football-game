/**
 * Routes user-facing Phase 2.G pour les operations cote entry :
 * roster, lineup, rerolls, inducements. Toutes sous
 * /api/nfl-fantasy/entries/:entryId/* avec auth + ownership check.
 *
 *   GET  /:entryId/roster                       getRoster
 *   POST /:entryId/roster                       addPlayerToRoster
 *   DELETE /:entryId/roster/:playerId           removePlayerFromRoster
 *
 *   GET  /:entryId/lineup?weekId=...            getLineup
 *   PUT  /:entryId/lineup                       setLineup
 *
 *   GET  /:entryId/rerolls?used=...             listRerolls
 *   POST /:entryId/rerolls/consume              consumeReroll
 *
 *   GET  /:entryId/inducements?weekId=&matchupId=  listInducements
 *   POST /:entryId/inducements/consume          consumeInducement
 *
 * Owners only : on verifie `entry.userId === req.user.id`. Pour les
 * acces admin (route distincte), cf. admin-nfl-fantasy.ts.
 */

import { Router } from "express";
import { z } from "zod";

import {
  authUser,
  type AuthenticatedRequest,
} from "../middleware/authUser";
import { validate, validateQuery } from "../middleware/validate";
import { prisma } from "../prisma";
import {
  addPlayerToRoster,
  getRosterWithPlayers,
  NflFantasyRosterError,
  removePlayerFromRoster,
} from "../services/nfl-fantasy-roster";
import {
  getLineup,
  NflFantasyLineupError,
  setLineup,
} from "../services/nfl-fantasy-lineup";
import {
  consumeInducement,
  consumeReroll,
  countAvailableRerolls,
  countRemainingInducementSlots,
  listInducements,
  listRerolls,
  NflFantasyMercatoError,
} from "../services/nfl-fantasy-mercato";
import { sellPlayer } from "../services/nfl-fantasy-player-value";
import { sendNflError } from "../utils/nfl-error-mapper";
import { serverLog } from "../utils/server-log";

const router = Router();
router.use(authUser);

/**
 * Charge l'entry et verifie ownership. Repond 403/404 et retourne
 * null si l'appel doit s'arreter.
 */
async function loadOwnedEntry(
  req: AuthenticatedRequest,
  res: Parameters<typeof sendNflError>[0],
  entryId: string,
): Promise<{ userId: string } | null> {
  const entry = await prisma.nflFantasyEntry.findUnique({
    where: { id: entryId },
    select: { userId: true },
  });
  if (!entry) {
    res.status(404).json({ error: `Entry ${entryId} introuvable`, code: "ENTRY_NOT_FOUND" });
    return null;
  }
  if (entry.userId !== req.user!.id) {
    res.status(403).json({ error: "Acces refuse a cette entry", code: "NOT_OWNER" });
    return null;
  }
  return entry;
}

// ──────────────────────────────────────────────────────────────────
// Roster
// ──────────────────────────────────────────────────────────────────

const addPlayerSchema = z.object({
  playerId: z.string().min(1),
  tvCost: z.number().int().min(0).max(1_000_000).optional(),
  acquiredVia: z.enum(["draft", "mercato", "trade", "free_agent"]).optional(),
});

router.get("/:entryId/roster", async (req, res) => {
  try {
    const entry = await loadOwnedEntry(req as AuthenticatedRequest, res, req.params.entryId);
    if (!entry) return;
    const roster = await getRosterWithPlayers(req.params.entryId);
    res.json({ roster });
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-entries] getRoster failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post(
  "/:entryId/roster",
  validate(addPlayerSchema),
  async (req, res) => {
    try {
      const entry = await loadOwnedEntry(req as AuthenticatedRequest, res, req.params.entryId);
      if (!entry) return;
      const body = req.body as z.infer<typeof addPlayerSchema>;
      const row = await addPlayerToRoster({ entryId: req.params.entryId, ...body });
      res.status(201).json(row);
    } catch (err) {
      if (!sendNflError(res, err) && !(err instanceof NflFantasyRosterError)) {
        serverLog.error("[nfl-fantasy-entries] addPlayer failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

router.delete("/:entryId/roster/:playerId", async (req, res) => {
  try {
    const entry = await loadOwnedEntry(req as AuthenticatedRequest, res, req.params.entryId);
    if (!entry) return;
    await removePlayerFromRoster({
      entryId: req.params.entryId,
      playerId: req.params.playerId,
    });
    res.status(204).end();
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-entries] removePlayer failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

// V3 mercato : vendre un joueur en recuperant sa cote ACTUELLE (vs
// le tvCost initial pour DELETE /roster). Permet la spéculation
// MPG-style : un joueur drafté pas cher qui monte en cote rapporte
// une plus-value au moment de la vente.
router.post("/:entryId/roster/:playerId/sell", async (req, res) => {
  try {
    const entry = await loadOwnedEntry(req as AuthenticatedRequest, res, req.params.entryId);
    if (!entry) return;
    const out = await sellPlayer({
      entryId: req.params.entryId,
      playerId: req.params.playerId,
    });
    res.json(out);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[nfl-fantasy-entries] sellPlayer failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

// ──────────────────────────────────────────────────────────────────
// Lineup
// ──────────────────────────────────────────────────────────────────

const lineupQuerySchema = z.object({
  weekId: z.string().min(1),
});

const setLineupSchema = z.object({
  weekId: z.string().min(1),
  starters: z
    .array(
      z.object({
        playerId: z.string().min(1),
        bbPosition: z.string().min(1),
      }),
    )
    .min(1)
    .max(20),
  captainId: z.string().nullable(),
  viceCaptainId: z.string().nullable().optional(),
  startersCount: z.number().int().min(1).max(20).optional(),
});

router.get(
  "/:entryId/lineup",
  validateQuery(lineupQuerySchema),
  async (req, res) => {
    try {
      const entry = await loadOwnedEntry(req as AuthenticatedRequest, res, req.params.entryId);
      if (!entry) return;
      const { weekId } = req.query as unknown as z.infer<typeof lineupQuerySchema>;
      const lineup = await getLineup({ entryId: req.params.entryId, weekId });
      res.json({ lineup });
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[nfl-fantasy-entries] getLineup failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

router.put("/:entryId/lineup", validate(setLineupSchema), async (req, res) => {
  try {
    const entry = await loadOwnedEntry(req as AuthenticatedRequest, res, req.params.entryId);
    if (!entry) return;
    const body = req.body as z.infer<typeof setLineupSchema>;
    const lineup = await setLineup({ entryId: req.params.entryId, ...body });
    res.json(lineup);
  } catch (err) {
    if (!sendNflError(res, err) && !(err instanceof NflFantasyLineupError)) {
      serverLog.error("[nfl-fantasy-entries] setLineup failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

// ──────────────────────────────────────────────────────────────────
// Rerolls
// ──────────────────────────────────────────────────────────────────

const listRerollsQuery = z.object({
  used: z.enum(["true", "false"]).optional(),
});

const consumeRerollSchema = z.object({
  rerollId: z.string().min(1),
  weekId: z.string().min(1),
  matchupId: z.string().min(1),
  appliedTo: z.string().optional(),
});

router.get(
  "/:entryId/rerolls",
  validateQuery(listRerollsQuery),
  async (req, res) => {
    try {
      const entry = await loadOwnedEntry(req as AuthenticatedRequest, res, req.params.entryId);
      if (!entry) return;
      const q = req.query as unknown as z.infer<typeof listRerollsQuery>;
      const used = q.used === undefined ? undefined : q.used === "true";
      const rerolls = await listRerolls({ entryId: req.params.entryId, used });
      const available = await countAvailableRerolls(req.params.entryId);
      res.json({ rerolls, available });
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[nfl-fantasy-entries] listRerolls failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

router.post(
  "/:entryId/rerolls/consume",
  validate(consumeRerollSchema),
  async (req, res) => {
    try {
      const entry = await loadOwnedEntry(req as AuthenticatedRequest, res, req.params.entryId);
      if (!entry) return;
      const body = req.body as z.infer<typeof consumeRerollSchema>;
      const out = await consumeReroll({ entryId: req.params.entryId, ...body });
      res.json(out);
    } catch (err) {
      if (!sendNflError(res, err) && !(err instanceof NflFantasyMercatoError)) {
        serverLog.error("[nfl-fantasy-entries] consumeReroll failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

// ──────────────────────────────────────────────────────────────────
// Inducements
// ──────────────────────────────────────────────────────────────────

const listInducementsQuery = z.object({
  weekId: z.string().optional(),
  matchupId: z.string().optional(),
});

const consumeInducementSchema = z.object({
  weekId: z.string().min(1),
  matchupId: z.string().min(1),
  type: z.string().min(1),
  slot: z.enum(["defensive", "offensive", "wildcard"]).optional(),
  source: z.string().optional(),
  targetId: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

router.get(
  "/:entryId/inducements",
  validateQuery(listInducementsQuery),
  async (req, res) => {
    try {
      const entry = await loadOwnedEntry(req as AuthenticatedRequest, res, req.params.entryId);
      if (!entry) return;
      const q = req.query as unknown as z.infer<typeof listInducementsQuery>;
      const inducements = await listInducements({
        entryId: req.params.entryId,
        weekId: q.weekId,
        matchupId: q.matchupId,
      });
      const remaining =
        q.weekId && q.matchupId
          ? await countRemainingInducementSlots({
              entryId: req.params.entryId,
              weekId: q.weekId,
              matchupId: q.matchupId,
            })
          : null;
      res.json({ inducements, remaining });
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[nfl-fantasy-entries] listInducements failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

router.post(
  "/:entryId/inducements/consume",
  validate(consumeInducementSchema),
  async (req, res) => {
    try {
      const entry = await loadOwnedEntry(req as AuthenticatedRequest, res, req.params.entryId);
      if (!entry) return;
      const body = req.body as z.infer<typeof consumeInducementSchema>;
      const out = await consumeInducement({ entryId: req.params.entryId, ...body });
      res.status(201).json(out);
    } catch (err) {
      if (!sendNflError(res, err) && !(err instanceof NflFantasyMercatoError)) {
        serverLog.error("[nfl-fantasy-entries] consumeInducement failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

export default router;
