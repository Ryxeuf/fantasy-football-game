import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { parsePagination, buildApiMeta } from "../utils/pagination";
import { getSupporterStatus } from "../services/supporter-status";

const router = Router();

// Sprint R lot R.B.3 — statut supporter (ad-free + early access).
router.get(
  "/supporter",
  authUser,
  async (req: AuthenticatedRequest, res) => {
    const status = await getSupporterStatus(req.user!.id);
    res.json(status);
  },
);

router.get("/matches", authUser, async (req: AuthenticatedRequest, res) => {
  const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
  const where = { players: { some: { id: req.user!.id } } };
  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      select: { id: true, status: true, seed: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.match.count({ where }),
  ]);
  res.json({ matches, meta: buildApiMeta({ total, limit, offset }) });
});

export default router;
