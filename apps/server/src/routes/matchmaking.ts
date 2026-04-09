import { Router } from "express";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { joinQueueSchema } from "../schemas/matchmaking.schemas";
import {
  joinQueue,
  leaveQueue,
  getQueueStatus,
} from "../services/matchmaking";
import { notifyMatchFound } from "../services/match-found-notify";

const router = Router();

/**
 * POST /matchmaking/join - Join the matchmaking queue
 * Body: { teamId: string }
 * Returns: { matched: boolean, ... }
 */
router.post(
  "/join",
  authUser,
  validate(joinQueueSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { teamId } = req.body as { teamId: string };
      const result = await joinQueue({
        userId: req.user!.id,
        teamId,
      });

      // If a match was found, notify the opponent (WebSocket if online, push if offline)
      if (result.matched) {
        notifyMatchFound(result.opponentUserId, result.matchId);
      }

      return res.json(result);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur serveur";
      return res.status(400).json({ error: message });
    }
  },
);

/**
 * DELETE /matchmaking/leave - Leave the matchmaking queue
 */
router.delete("/leave", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await leaveQueue(req.user!.id);
    if (!result.ok) {
      return res
        .status(400)
        .json({ error: "Vous n'etes pas en file d'attente" });
    }
    return res.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /matchmaking/status - Get current queue status
 */
router.get("/status", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const entry = await getQueueStatus(req.user!.id);
    if (!entry) {
      return res.json({ inQueue: false });
    }
    return res.json({
      inQueue: true,
      status: entry.status,
      teamId: entry.teamId,
      teamValue: entry.teamValue,
      matchId: entry.matchId,
      joinedAt: entry.joinedAt,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return res.status(500).json({ error: message });
  }
});

export default router;
