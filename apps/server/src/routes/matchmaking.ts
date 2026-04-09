import { Router } from "express";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { joinQueueSchema } from "../schemas/matchmaking.schemas";
import {
  joinQueue,
  leaveQueue,
  getQueueStatus,
} from "../services/matchmaking";
import { getGameNamespace } from "../socket";
import { sendMatchFoundPush } from "../services/push-notifications";

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

      // If a match was found, notify the opponent via WebSocket + push
      if (result.matched) {
        notifyMatchFound(result.opponentUserId, result.matchId);
        sendMatchFoundPush(result.opponentUserId, result.matchId);
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

/**
 * Notify a user via WebSocket that a match has been found.
 */
function notifyMatchFound(userId: string, matchId: string): void {
  try {
    const gameNs = getGameNamespace();
    // Broadcast to all sockets of this user in the /game namespace
    for (const [, socket] of gameNs.sockets) {
      if (socket.data.user?.id === userId) {
        socket.emit("matchmaking:found", { matchId });
      }
    }
  } catch {
    // socket.io may not be initialized (e.g., in tests)
  }
}

export default router;
