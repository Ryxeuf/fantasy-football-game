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

    // Exclut :
    //  - les coachs non valides (modération admin / pré-alpha gate),
    //  - les comptes systèmes IA (`role = "ai"`),
    //  - les coachs masqués par un admin (`leaderboardStatus = "hidden_admin"`),
    //  - les coachs n'ayant pas encore joué un match ranked : un `EloSnapshot`
    //    est créé pour chaque update ELO (apps/server/src/services/elo-update.ts),
    //    donc `eloSnapshots: { some: {} }` = au moins 1 match ranked terminé.
    //    Sans ce filtre, le leaderboard serait pollué par les comptes inactifs
    //    figés à 1000 ELO par défaut.
    const where = {
      valid: true,
      role: { not: "ai" },
      leaderboardStatus: "visible",
      eloSnapshots: { some: {} },
    } as const;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          coachName: true,
          eloRating: true,
        },
        orderBy: { eloRating: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
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
