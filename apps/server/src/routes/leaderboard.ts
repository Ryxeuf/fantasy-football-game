import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

/**
 * GET /leaderboard
 * Returns top players ranked by ELO rating.
 * Query params:
 *   - limit: number of players to return (default 50, max 100)
 *   - offset: pagination offset (default 0)
 */
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(1, parseInt(req.query.limit as string, 10) || 50),
      100,
    );
    const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          coachName: true,
          eloRating: true,
        },
        orderBy: { eloRating: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.user.count(),
    ]);

    const leaderboard = users.map((user: typeof users[number], index: number) => ({
      rank: offset + index + 1,
      userId: user.id,
      coachName: user.coachName,
      eloRating: user.eloRating,
    }));

    return res.json({
      success: true,
      data: leaderboard,
      meta: {
        total,
        limit,
        offset,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
