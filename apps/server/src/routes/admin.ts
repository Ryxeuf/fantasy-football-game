import { Router } from "express";
import { prisma } from "../prisma";
import { authUser } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";

const router = Router();

router.use(authUser, adminOnly);

router.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true } });
  res.json({ users });
});

router.get("/matches", async (_req, res) => {
  const matches = await prisma.match.findMany({ select: { id: true, status: true, seed: true, createdAt: true } });
  res.json({ matches });
});

router.get("/stats", async (_req, res) => {
  const [users, matches] = await Promise.all([
    prisma.user.count(),
    prisma.match.count(),
  ]);
  res.json({ users, matches, health: "ok", time: new Date().toISOString() });
});

export default router;


