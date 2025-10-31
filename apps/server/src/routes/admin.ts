import { Router } from "express";
import { prisma } from "../prisma";
import { authUser } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";

const router = Router();

router.use(authUser, adminOnly);

// Route améliorée pour lister les utilisateurs avec statistiques
router.get("/users", async (req, res) => {
  try {
    const {
      search = "",
      role = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      page = "1",
      limit = "50",
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    // Construire les filtres
    const where: any = {};
    if (search) {
      // Adapter selon le type de base de données
      const isPostgres = process.env.TEST_SQLITE !== "1";
      const searchMode = isPostgres ? { mode: "insensitive" as const } : {};
      where.OR = [
        { email: { contains: search as string, ...searchMode } },
        { name: { contains: search as string, ...searchMode } },
      ];
    }
    if (role) {
      where.role = role;
    }

    // Compter le total
    const total = await prisma.user.count({ where });

    // Récupérer les utilisateurs avec leurs statistiques
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            teams: true,
            matches: true,
            createdMatches: true,
            teamSelections: true,
          },
        },
      },
      orderBy: { [sortBy as string]: sortOrder as "asc" | "desc" },
      skip,
      take: limitNum,
    });

    res.json({
      users,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs" });
  }
});

// Route pour obtenir les détails complets d'un utilisateur
router.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        teams: {
          select: {
            id: true,
            name: true,
            roster: true,
            createdAt: true,
            _count: { select: { players: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        matches: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        createdMatches: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            teams: true,
            matches: true,
            createdMatches: true,
            teamSelections: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    res.json({ user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la récupération de l'utilisateur" });
  }
});

// Route pour modifier le rôle d'un utilisateur
router.patch("/users/:id/role", async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Rôle invalide" });
    }

    // Empêcher de modifier son propre rôle
    if ((req as any).user?.id === id) {
      return res.status(400).json({ error: "Vous ne pouvez pas modifier votre propre rôle" });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    res.json({ user });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la modification du rôle" });
  }
});

// Route pour supprimer un utilisateur
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Empêcher de supprimer son propre compte
    if ((req as any).user?.id === id) {
      return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({ ok: true });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur" });
  }
});

router.get("/matches", async (_req, res) => {
  const matches = await prisma.match.findMany({
    select: { id: true, status: true, seed: true, createdAt: true },
  });
  res.json({ matches });
});

// Purge toutes les parties (matches, turns, selections et liens joueurs)
router.post("/matches/purge", async (_req, res) => {
  try {
    await prisma.turn.deleteMany({});
    await prisma.teamSelection.deleteMany({});
    // Supprimer les relations dans la table de jonction _MatchToUser
    await (prisma as any).$executeRawUnsafe('DELETE FROM "_MatchToUser"');
    await prisma.match.deleteMany({});
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la purge des parties" });
  }
});

// Endpoint de reset complet pour les tests (uniquement si TEST_SQLITE=1)
router.post("/test/reset", async (_req, res) => {
  try {
    if (process.env.TEST_SQLITE !== "1")
      return res.status(403).json({ error: "Reset tests interdit en prod" });
    await prisma.turn.deleteMany({});
    await prisma.teamSelection.deleteMany({});
    await (prisma as any).$executeRawUnsafe('DELETE FROM "_MatchToUser"');
    await prisma.match.deleteMany({});
    await prisma.teamPlayer.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.user.deleteMany({});
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur reset tests" });
  }
});

router.get("/stats", async (_req, res) => {
  const [users, matches] = await Promise.all([
    prisma.user.count(),
    prisma.match.count(),
  ]);
  res.json({ users, matches, health: "ok", time: new Date().toISOString() });
});

export default router;
