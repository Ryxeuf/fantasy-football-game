/**
 * Routes user-facing — Mercato V2 (encheres secretes asynchrones).
 *
 * Sous /api/nfl-fantasy/draft-sessions, protege par authUser.
 *
 *   GET    /leagues/:leagueId            sessions d'une league
 *   POST   /leagues/:leagueId            createDraftSession (owner only)
 *   GET    /:sessionId                   detail (sans bids des autres)
 *   POST   /:sessionId/resolve           resolveSession (owner only)
 *   GET    /:sessionId/my-bids           listBidsForEntry (current user)
 *   PUT    /:sessionId/bids              placeBid (upsert)
 *   DELETE /:sessionId/bids/:playerId    cancelBid
 *
 * Note: monte au niveau index.ts avec le prefixe ci-dessus.
 */

import { Router } from "express";
import { z } from "zod";

import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { prisma } from "../prisma";
import {
  cancelBid,
  computeBasePricesForPlayers,
  createDraftSession,
  listBidsForEntry,
  placeBid,
  resolveSession,
} from "../services/nfl-fantasy-draft-session";
import { sendNflError } from "../utils/nfl-error-mapper";
import { serverLog } from "../utils/server-log";

const router = Router();
router.use(authUser);

const createSessionSchema = z.object({
  opensAt: z.string().datetime(),
  closesAt: z.string().datetime(),
});

const placeBidSchema = z.object({
  playerId: z.string().min(1),
  amount: z.number().int().min(1).max(50_000),
});

function userId(req: AuthenticatedRequest): string {
  return req.user!.id;
}

async function getMyEntry(
  req: AuthenticatedRequest,
  leagueId: string,
): Promise<{ id: string } | null> {
  return prisma.nflFantasyEntry.findFirst({
    where: { leagueId, userId: userId(req) },
    select: { id: true },
  });
}

// ───────────────────── League-scoped routes ─────────────────────

router.get("/leagues/:leagueId", async (req, res) => {
  try {
    const sessions = await prisma.nflFantasyDraftSession.findMany({
      where: { leagueId: req.params.leagueId },
      orderBy: { sessionNumber: "desc" },
      select: {
        id: true,
        sessionNumber: true,
        opensAt: true,
        closesAt: true,
        resolvedAt: true,
        status: true,
      },
    });
    res.json({ sessions });
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[draft-sessions] list failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post(
  "/leagues/:leagueId",
  validate(createSessionSchema),
  async (req, res) => {
    try {
      const league = await prisma.nflFantasyLeague.findUnique({
        where: { id: req.params.leagueId },
        select: { ownerId: true },
      });
      if (!league) {
        res.status(404).json({ error: "League introuvable", code: "LEAGUE_NOT_FOUND" });
        return;
      }
      if (league.ownerId !== userId(req as AuthenticatedRequest)) {
        res
          .status(403)
          .json({ error: "Seul le owner peut creer une session", code: "NOT_OWNER" });
        return;
      }
      const body = req.body as z.infer<typeof createSessionSchema>;
      const session = await createDraftSession({
        leagueId: req.params.leagueId,
        opensAt: new Date(body.opensAt),
        closesAt: new Date(body.closesAt),
      });
      res.status(201).json(session);
    } catch (err) {
      if (!sendNflError(res, err)) {
        serverLog.error("[draft-sessions] create failed", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  },
);

// ───────────────────── Session-scoped routes ─────────────────────

router.get("/:sessionId", async (req, res) => {
  try {
    const session = await prisma.nflFantasyDraftSession.findUnique({
      where: { id: req.params.sessionId },
      select: {
        id: true,
        leagueId: true,
        sessionNumber: true,
        opensAt: true,
        closesAt: true,
        resolvedAt: true,
        status: true,
      },
    });
    if (!session) {
      res.status(404).json({ error: "Session introuvable", code: "SESSION_NOT_FOUND" });
      return;
    }

    // Si resolue, on expose les outcomes publiquement (qui a gagne quoi).
    if (session.status === "resolved") {
      const wonBids = await prisma.nflFantasyDraftBid.findMany({
        where: { sessionId: session.id, status: "won" },
        select: {
          playerId: true,
          entryId: true,
          amount: true,
          entry: { select: { teamName: true } },
        },
      });
      type WonBid = (typeof wonBids)[number];
      res.json({
        session,
        outcomes: wonBids.map((b: WonBid) => ({
          playerId: b.playerId,
          winnerEntryId: b.entryId,
          winnerTeamName: b.entry.teamName,
          amount: b.amount,
        })),
      });
      return;
    }

    // Session ouverte : on retourne juste les counts (combien de coachs
    // bidds globalement, sans devoiler le contenu).
    const bidCount = await prisma.nflFantasyDraftBid.count({
      where: { sessionId: session.id },
    });
    res.json({ session, bidCount });
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[draft-sessions] get failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.post("/:sessionId/resolve", async (req, res) => {
  try {
    const session = await prisma.nflFantasyDraftSession.findUnique({
      where: { id: req.params.sessionId },
      select: { leagueId: true, league: { select: { ownerId: true } } },
    });
    if (!session) {
      res.status(404).json({ error: "Session introuvable", code: "SESSION_NOT_FOUND" });
      return;
    }
    if (session.league.ownerId !== userId(req as AuthenticatedRequest)) {
      res
        .status(403)
        .json({ error: "Seul le owner peut resoudre une session", code: "NOT_OWNER" });
      return;
    }
    const result = await resolveSession(req.params.sessionId);
    res.json(result);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[draft-sessions] resolve failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.get("/:sessionId/my-bids", async (req, res) => {
  try {
    const session = await prisma.nflFantasyDraftSession.findUnique({
      where: { id: req.params.sessionId },
      select: { leagueId: true },
    });
    if (!session) {
      res.status(404).json({ error: "Session introuvable", code: "SESSION_NOT_FOUND" });
      return;
    }
    const entry = await getMyEntry(req as AuthenticatedRequest, session.leagueId);
    if (!entry) {
      res.status(403).json({
        error: "Tu n'es pas membre de cette league",
        code: "ENTRY_NOT_FOUND",
      });
      return;
    }
    const bids = await listBidsForEntry({
      sessionId: req.params.sessionId,
      entryId: entry.id,
    });

    // Enrichi avec basePrice pour l'UI.
    if (bids.length === 0) {
      res.json({ bids: [], myEntryId: entry.id });
      return;
    }
    const league = await prisma.nflFantasyLeague.findUnique({
      where: { id: session.leagueId },
      select: { seasonId: true },
    });
    const basePrices = await computeBasePricesForPlayers({
      playerIds: bids.map((b) => b.playerId),
      seasonId: league?.seasonId ?? "2025",
    });
    res.json({
      myEntryId: entry.id,
      bids: bids.map((b) => ({ ...b, basePrice: basePrices.get(b.playerId) ?? 50 })),
    });
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[draft-sessions] my-bids failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.put("/:sessionId/bids", validate(placeBidSchema), async (req, res) => {
  try {
    const session = await prisma.nflFantasyDraftSession.findUnique({
      where: { id: req.params.sessionId },
      select: { leagueId: true },
    });
    if (!session) {
      res.status(404).json({ error: "Session introuvable", code: "SESSION_NOT_FOUND" });
      return;
    }
    const entry = await getMyEntry(req as AuthenticatedRequest, session.leagueId);
    if (!entry) {
      res.status(403).json({
        error: "Tu n'es pas membre de cette league",
        code: "ENTRY_NOT_FOUND",
      });
      return;
    }
    const body = req.body as z.infer<typeof placeBidSchema>;
    const bid = await placeBid({
      sessionId: req.params.sessionId,
      entryId: entry.id,
      playerId: body.playerId,
      amount: body.amount,
    });
    res.status(201).json(bid);
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[draft-sessions] place-bid failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

router.delete("/:sessionId/bids/:playerId", async (req, res) => {
  try {
    const session = await prisma.nflFantasyDraftSession.findUnique({
      where: { id: req.params.sessionId },
      select: { leagueId: true },
    });
    if (!session) {
      res.status(404).json({ error: "Session introuvable", code: "SESSION_NOT_FOUND" });
      return;
    }
    const entry = await getMyEntry(req as AuthenticatedRequest, session.leagueId);
    if (!entry) {
      res.status(403).json({
        error: "Tu n'es pas membre de cette league",
        code: "ENTRY_NOT_FOUND",
      });
      return;
    }
    await cancelBid({
      sessionId: req.params.sessionId,
      entryId: entry.id,
      playerId: req.params.playerId,
    });
    res.status(204).end();
  } catch (err) {
    if (!sendNflError(res, err)) {
      serverLog.error("[draft-sessions] cancel-bid failed", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
});

export default router;
