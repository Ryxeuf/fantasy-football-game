import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { parsePagination, buildApiMeta } from "../utils/pagination";

const router = Router();

router.get("/matches", authUser, async (req: AuthenticatedRequest, res) => {
  const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
  // Sprint R.E.2 — filtre optionnel `?mode=async` pour la page
  // /me/matches/async qui liste les matches en attente d'un coup.
  const modeFilter = typeof req.query.mode === "string" ? req.query.mode : null;
  const where: {
    players: { some: { id: string } };
    mode?: string;
    status?: string;
  } = { players: { some: { id: req.user!.id } } };
  if (modeFilter === "async" || modeFilter === "realtime") {
    where.mode = modeFilter;
  }
  if (typeof req.query.status === "string" && req.query.status.length > 0) {
    where.status = req.query.status;
  }
  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      select: {
        id: true,
        status: true,
        seed: true,
        createdAt: true,
        mode: true,
        currentTurnUserId: true,
        currentTurnDeadline: true,
        turnDeadlineHours: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.match.count({ where }),
  ]);
  res.json({ matches, meta: buildApiMeta({ total, limit, offset }) });
});

export default router;
