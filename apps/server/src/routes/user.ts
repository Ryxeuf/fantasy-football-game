import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";

const router = Router();

router.get("/matches", authUser, async (req: AuthenticatedRequest, res) => {
  const matches = await prisma.match.findMany({
    where: { players: { some: { id: req.user!.id } } },
    select: { id: true, status: true, seed: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ matches });
});

export default router;


