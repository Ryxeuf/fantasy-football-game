import { Router } from "express";
import { prisma } from "../prisma";
import { authUser } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { normalizeRoles } from "../utils/roles";

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
      // Compat : filtrer sur le rôle principal ET la liste des rôles
      where.OR = [
        ...(where.OR ?? []),
        { role },
        { roles: { has: role } },
      ];
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
        roles: true,
        patreon: true,
        valid: true,
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

    const usersWithRoles = users.map((u) => ({
      ...u,
      roles: normalizeRoles((u as any).roles ?? u.role),
    }));

    res.json({
      users: usersWithRoles,
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
        roles: true,
        patreon: true,
        valid: true,
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

    const userWithRoles = {
      ...user,
      roles: normalizeRoles((user as any).roles ?? user.role),
    };

    res.json({ user: userWithRoles });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la récupération de l'utilisateur" });
  }
});

// Route pour modifier le rôle d'un utilisateur
router.patch("/users/:id/role", async (req, res) => {
  try {
    const { id } = req.params;
    const { role, roles } = req.body ?? {};

    const rolesArray: string[] = Array.isArray(roles)
      ? roles
      : role
        ? [role]
        : [];

    const allowedRoles = ["user", "admin", "moderator"];

    if (
      rolesArray.length === 0 ||
      !rolesArray.every((r) => allowedRoles.includes(r))
    ) {
      return res.status(400).json({ error: "Rôle invalide" });
    }

    // Empêcher de modifier son propre rôle
    if ((req as any).user?.id === id) {
      return res.status(400).json({ error: "Vous ne pouvez pas modifier votre propre rôle" });
    }

    const primaryRole = rolesArray.includes("admin") ? "admin" : "user";

    const user = await prisma.user.update({
      where: { id },
      data: { role: primaryRole, roles: rolesArray },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roles: true,
        patreon: true,
        valid: true,
      },
    });

    const userWithRoles = {
      ...user,
      roles: normalizeRoles(user.roles ?? user.role),
    };

    res.json({ user: userWithRoles });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la modification du rôle" });
  }
});

// Route pour modifier le statut Patreon d'un utilisateur
router.patch("/users/:id/patreon", async (req, res) => {
  try {
    const { id } = req.params;
    const { patreon } = req.body;

    if (typeof patreon !== "boolean") {
      return res.status(400).json({ error: "Valeur Patreon invalide" });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { patreon },
      select: { id: true, email: true, name: true, role: true, patreon: true, valid: true },
    });

    res.json({ user });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la modification du statut Patreon" });
  }
});

// Route pour modifier le statut de validation d'un utilisateur
router.patch("/users/:id/valid", async (req, res) => {
  try {
    const { id } = req.params;
    const { valid } = req.body;

    if (typeof valid !== "boolean") {
      return res.status(400).json({ error: "Valeur valid invalide" });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { valid },
      select: { id: true, email: true, name: true, role: true, patreon: true, valid: true },
    });

    res.json({ user });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la modification du statut de validation" });
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

router.get("/matches", async (req, res) => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit as string, 10) : undefined;
    
    const matches = await prisma.match.findMany({
      select: { id: true, status: true, seed: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limitNum,
    });
    res.json({ matches });
  } catch (e: any) {
    console.error("Erreur lors de la récupération des parties:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
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
  try {
    const [
      totalUsers,
      validUsers,
      adminUsers,
      totalMatches,
      totalTeams,
      totalCups,
      openCups,
      closedCups,
      archivedCups,
      recentUsers,
      recentMatches,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { valid: true } }),
      prisma.user.count({
        where: {
          OR: [{ role: "admin" }, { roles: { has: "admin" } }],
        },
      }),
      prisma.match.count(),
      prisma.team.count(),
      prisma.cup.count(),
      prisma.cup.count({ where: { status: "ouverte" } }),
      prisma.cup.count({ where: { status: { in: ["en_cours", "terminee"] } } }),
      prisma.cup.count({ where: { status: "archivee" } }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, coachName: true, createdAt: true },
      }),
      prisma.match.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true },
      }),
    ]);

    res.json({
      users: {
        total: totalUsers,
        valid: validUsers,
        admins: adminUsers,
        pending: totalUsers - validUsers,
      },
      matches: {
        total: totalMatches,
      },
      teams: {
        total: totalTeams,
      },
      cups: {
        total: totalCups,
        open: openCups,
        closed: closedCups,
        archived: archivedCups,
      },
      recent: {
        users: recentUsers,
        matches: recentMatches,
      },
      health: "ok",
      time: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("Erreur lors de la récupération des statistiques:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =============================================================================
// ROUTES ADMIN POUR LES ÉQUIPES
// =============================================================================

// Route pour lister toutes les équipes avec filtres et pagination
router.get("/teams", async (req, res) => {
  try {
    const {
      search = "",
      roster = "",
      ownerId = "",
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
      const isPostgres = process.env.TEST_SQLITE !== "1";
      const searchMode = isPostgres ? { mode: "insensitive" as const } : {};
      where.name = { contains: search as string, ...searchMode };
    }
    if (roster) {
      where.roster = roster;
    }
    if (ownerId) {
      where.ownerId = ownerId;
    }

    // Compter le total
    const total = await prisma.team.count({ where });

    // Récupérer les équipes avec leurs statistiques
    const teams = await prisma.team.findMany({
      where,
      select: {
        id: true,
        name: true,
        roster: true,
        initialBudget: true,
        treasury: true,
        currentValue: true,
        teamValue: true,
        rerolls: true,
        cheerleaders: true,
        assistants: true,
        apothecary: true,
        dedicatedFans: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            coachName: true,
          },
        },
        _count: {
          select: {
            players: true,
            starPlayers: true,
          },
        },
      },
      orderBy: { [sortBy as string]: sortOrder as "asc" | "desc" },
      skip,
      take: limitNum,
    });

    res.json({
      teams,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la récupération des équipes" });
  }
});

// Route pour obtenir les détails complets d'une équipe
router.get("/teams/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            coachName: true,
          },
        },
        players: {
          orderBy: { number: "asc" },
        },
        starPlayers: true,
      },
    });

    if (!team) {
      return res.status(404).json({ error: "Équipe non trouvée" });
    }

    res.json({ team });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la récupération de l'équipe" });
  }
});

// Route pour supprimer une équipe
router.delete("/teams/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si l'équipe existe
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            selections: true,
          },
        },
      },
    });

    if (!team) {
      return res.status(404).json({ error: "Équipe non trouvée" });
    }

    // Vérifier si l'équipe est utilisée dans des sélections
    if (team._count.selections > 0) {
      return res.status(400).json({
        error: "Impossible de supprimer cette équipe car elle est utilisée dans des matchs",
      });
    }

    // Supprimer les joueurs et Star Players associés
    await prisma.teamPlayer.deleteMany({ where: { teamId: id } });
    await prisma.teamStarPlayer.deleteMany({ where: { teamId: id } });

    // Supprimer l'équipe
    await prisma.team.delete({ where: { id } });

    res.json({ ok: true });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Équipe non trouvée" });
    }
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la suppression de l'équipe" });
  }
});

export default router;
