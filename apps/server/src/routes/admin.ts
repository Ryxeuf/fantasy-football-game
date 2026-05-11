import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { authUser } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { normalizeRoles } from "../utils/roles";
import { validate, validateQuery } from "../middleware/validate";
import { generateTempPassword } from "../services/temp-password";
import { getRefreshTokenStore } from "./auth";
import {
  adminUsersQuerySchema,
  adminMatchesQuerySchema,
  adminTeamsQuerySchema,
  updateUserRoleSchema,
  updateUserPatreonSchema,
  updateUserValidSchema,
  updateMatchStatusSchema,
  adminMatchForfeitSchema,
  adminMatchCancelSchema,
  adminUserBanSchema,
} from "../schemas/admin.schemas";
import { serverLog } from "../utils/server-log";
import {
  safeRecordAdminActionFromRequest,
  type RecordAdminActionInput,
} from "../services/audit-log";
import type { AuthenticatedRequest } from "../middleware/authUser";

const router = Router();

router.use(authUser, adminOnly);

/**
 * S27.6.4 — Helper local : on delegue au wrapper partage
 * `safeRecordAdminActionFromRequest` afin de partager le meme
 * comportement "log + swallow" avec `admin-data.ts`.
 */
async function safeAudit(
  req: AuthenticatedRequest,
  partial: Omit<RecordAdminActionInput, "userId" | "ipAddress" | "userAgent">,
): Promise<void> {
  await safeRecordAdminActionFromRequest(prisma, req, partial);
}

// Route améliorée pour lister les utilisateurs avec statistiques
router.get("/users", validateQuery(adminUsersQuerySchema), async (req, res) => {
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
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            teams: true,
            matches: true,
            createdMatches: true,
            teamSelections: true,
            createdLocalMatches: true,
          },
        },
      },
      orderBy: { [sortBy as string]: sortOrder as "asc" | "desc" },
      skip,
      take: limitNum,
    });

    const usersWithRoles = users.map((u: typeof users[number]) => ({
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
    serverLog.error(e);
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
        bannedAt: true,
        bannedUntil: true,
        banReason: true,
        lastLoginAt: true,
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
            createdLocalMatches: true,
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
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la récupération de l'utilisateur" });
  }
});

// Route pour modifier le rôle d'un utilisateur
router.patch("/users/:id/role", validate(updateUserRoleSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, roles } = req.body;

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

    const previous = await prisma.user.findUnique({
      where: { id },
      select: { role: true, roles: true },
    });

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

    await safeAudit(req, {
      action: "user.role.update",
      entity: "User",
      entityId: id,
      oldValue: previous,
      newValue: { role: user.role, roles: user.roles },
    });

    res.json({ user: userWithRoles });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la modification du rôle" });
  }
});

// Route pour modifier le statut Patreon d'un utilisateur
router.patch("/users/:id/patreon", validate(updateUserPatreonSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { patreon } = req.body;

    const previous = await prisma.user.findUnique({
      where: { id },
      select: { patreon: true },
    });

    const user = await prisma.user.update({
      where: { id },
      data: { patreon },
      select: { id: true, email: true, name: true, role: true, patreon: true, valid: true },
    });

    await safeAudit(req, {
      action: "user.patreon.update",
      entity: "User",
      entityId: id,
      oldValue: previous,
      newValue: { patreon: user.patreon },
    });

    res.json({ user });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la modification du statut Patreon" });
  }
});

// Route pour modifier le statut de validation d'un utilisateur
router.patch("/users/:id/valid", validate(updateUserValidSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { valid } = req.body;

    const previous = await prisma.user.findUnique({
      where: { id },
      select: { valid: true },
    });

    const user = await prisma.user.update({
      where: { id },
      data: { valid },
      select: { id: true, email: true, name: true, role: true, patreon: true, valid: true },
    });

    await safeAudit(req, {
      action: "user.valid.update",
      entity: "User",
      entityId: id,
      oldValue: previous,
      newValue: { valid: user.valid },
    });

    res.json({ user });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la modification du statut de validation" });
  }
});

/**
 * Lot P.B.4 — Bannir un utilisateur (temporaire ou permanent).
 *
 * Un ban temporaire est exprime en `durationDays` (>= 1). Un ban permanent
 * passe une duree absente ou nulle, et est materialise par une date tres
 * lointaine (year 9999) pour unifier la verification au login (compare a now()).
 *
 * Refuse de se bannir soi-meme pour eviter le lock-out admin. Idempotent :
 * appeler /ban sur un user deja banni etend (ne remet pas a zero) la duree
 * tout en mettant a jour `banReason`.
 */
router.post("/users/:id/ban", validate(adminUserBanSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, durationDays } = req.body as { reason: string; durationDays?: number };

    if ((req as AuthenticatedRequest).user?.id === id) {
      return res.status(400).json({ error: "Vous ne pouvez pas vous bannir vous-meme" });
    }

    const previous = await prisma.user.findUnique({
      where: { id },
      select: { bannedAt: true, bannedUntil: true, banReason: true, role: true, roles: true },
    });

    if (!previous) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const now = new Date();
    const PERMANENT_BAN_END = new Date("9999-12-31T23:59:59.999Z");
    const newBannedUntil =
      !durationDays || durationDays === 0
        ? PERMANENT_BAN_END
        : new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Si deja banni avec une fin > newBannedUntil, garde la plus longue.
    const effectiveUntil =
      previous.bannedUntil && previous.bannedUntil.getTime() > newBannedUntil.getTime()
        ? previous.bannedUntil
        : newBannedUntil;

    const user = await prisma.user.update({
      where: { id },
      data: {
        bannedAt: previous.bannedAt ?? now,
        bannedUntil: effectiveUntil,
        banReason: reason,
      },
      select: {
        id: true,
        email: true,
        coachName: true,
        bannedAt: true,
        bannedUntil: true,
        banReason: true,
      },
    });

    await safeAudit(req, {
      action: "user.ban",
      entity: "User",
      entityId: id,
      oldValue: previous,
      newValue: {
        bannedAt: user.bannedAt,
        bannedUntil: user.bannedUntil,
        banReason: user.banReason,
        durationDays: durationDays ?? 0,
      },
    });

    res.json({ user });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors du bannissement" });
  }
});

/**
 * Lot P.B.4 — Lever le bannissement d'un utilisateur.
 *
 * Idempotent : si le user n'est pas banni, no-op (200 ok). Audit log
 * trace l'etat precedent pour pouvoir tracer un debannissement abusif.
 */
router.post("/users/:id/unban", async (req, res) => {
  try {
    const { id } = req.params;

    const previous = await prisma.user.findUnique({
      where: { id },
      select: { bannedAt: true, bannedUntil: true, banReason: true },
    });

    if (!previous) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { bannedAt: null, bannedUntil: null, banReason: null },
      select: {
        id: true,
        email: true,
        coachName: true,
        bannedAt: true,
        bannedUntil: true,
        banReason: true,
      },
    });

    await safeAudit(req, {
      action: "user.unban",
      entity: "User",
      entityId: id,
      oldValue: previous,
      newValue: { bannedAt: null, bannedUntil: null, banReason: null },
    });

    res.json({ user });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors du debannissement" });
  }
});

/**
 * Lot P.C.2 — Admin password reset override.
 *
 * Genere un mot de passe temporaire cryptographiquement sur (16 chars,
 * politique de complexite garantie), update le passwordHash bcrypt,
 * marque `mustChangePassword=true`, revoque toutes les sessions actives
 * du user (refresh tokens) et retourne le password en clair UNE FOIS
 * dans la reponse pour transmission out-of-band (chat support, e-mail
 * manuel).
 *
 * Refuse de reset son propre password via cette voie : un admin doit
 * passer par /auth/change-password.
 *
 * Audit log strict : trace l'identite admin via safeAudit. Le password
 * temporaire n'est jamais persiste en clair.
 */
router.post("/users/:id/password-reset", async (req, res) => {
  try {
    const { id } = req.params;

    if ((req as AuthenticatedRequest).user?.id === id) {
      return res.status(400).json({
        error: "Utilisez /auth/change-password pour votre propre compte",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, coachName: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const tempPassword = generateTempPassword(16);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });

    // Revoque toutes les sessions actives — force re-login avec le temp
    // password. Le change-password handler resettera mustChangePassword.
    try {
      await getRefreshTokenStore().revokeAllForUser(id);
    } catch (revokeErr) {
      // Pas bloquant : si la revocation echoue, le password est deja
      // change, donc les tokens existants seront refuses au prochain
      // refresh par le check de validite du compte.
      serverLog.error("[admin.password-reset] revoke tokens failed:", revokeErr);
    }

    await safeAudit(req, {
      action: "user.password.reset",
      entity: "User",
      entityId: id,
      // Ne JAMAIS logger le password en clair. On trace uniquement
      // l'execution de l'action.
      newValue: { mustChangePassword: true, sessionsRevoked: true },
    });

    res.json({
      user: { id: user.id, email: user.email, coachName: user.coachName },
      tempPassword,
    });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors du reset du mot de passe" });
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

    const previous = await prisma.user.findUnique({
      where: { id },
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

    await prisma.user.delete({
      where: { id },
    });

    await safeAudit(req, {
      action: "user.delete",
      entity: "User",
      entityId: id,
      oldValue: previous,
    });

    res.json({ ok: true });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur" });
  }
});

router.get("/matches", validateQuery(adminMatchesQuerySchema), async (req, res) => {
  try {
    const {
      limit,
      status,
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      page = "1",
    } = req.query;
    const limitNum = limit ? parseInt(limit as string, 10) : 50;
    const pageNum = parseInt(page as string, 10) || 1;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) {
      where.status = status as string;
    }
    if (search) {
      const searchStr = search as string;
      where.OR = [
        { id: { contains: searchStr } },
        { seed: { contains: searchStr } },
        { status: { contains: searchStr } },
        { creator: { coachName: { contains: searchStr, mode: "insensitive" } } },
        { creator: { email: { contains: searchStr, mode: "insensitive" } } },
        {
          teamSelections: {
            some: {
              OR: [
                { user: { coachName: { contains: searchStr, mode: "insensitive" } } },
                { teamRef: { name: { contains: searchStr, mode: "insensitive" } } },
              ],
            },
          },
        },
      ];
    }

    const total = await prisma.match.count({ where });

    const matches = await prisma.match.findMany({
      where,
      select: {
        id: true,
        status: true,
        seed: true,
        createdAt: true,
        lastMoveAt: true,
        currentTurnUserId: true,
        forfeitedAt: true,
        forfeitWinnerSide: true,
        forfeitReason: true,
        cancelledAt: true,
        cancelReason: true,
        creator: {
          select: { id: true, email: true, coachName: true },
        },
        teamSelections: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, coachName: true, email: true } },
            teamRef: { select: { id: true, name: true, roster: true } },
          },
        },
        _count: {
          select: { turns: true, players: true },
        },
      },
      orderBy: { [sortBy as string]: sortOrder as "asc" | "desc" },
      skip,
      take: limitNum,
    });

    // Count by status
    const [pendingCount, prematchCount, prematchSetupCount, activeCount, endedCount, cancelledCount] =
      await Promise.all([
        prisma.match.count({ where: { status: "pending" } }),
        prisma.match.count({ where: { status: "prematch" } }),
        prisma.match.count({ where: { status: "prematch-setup" } }),
        prisma.match.count({ where: { status: "active" } }),
        prisma.match.count({ where: { status: "ended" } }),
        prisma.match.count({ where: { status: "cancelled" } }),
      ]);

    res.json({
      matches,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      statusCounts: {
        pending: pendingCount,
        prematch: prematchCount,
        "prematch-setup": prematchSetupCount,
        active: activeCount,
        ended: endedCount,
        cancelled: cancelledCount,
      },
    });
  } catch (e: any) {
    serverLog.error("Erreur lors de la récupération des parties:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Détails d'un match spécifique
router.get("/matches/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, email: true, coachName: true },
        },
        players: {
          select: { id: true, email: true, coachName: true },
        },
        teamSelections: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, coachName: true, email: true } },
            teamRef: { select: { id: true, name: true, roster: true } },
          },
        },
        turns: {
          orderBy: { number: "desc" },
          take: 10,
          select: {
            id: true,
            number: true,
            createdAt: true,
            payload: true,
          },
        },
        _count: {
          select: { turns: true, players: true, teamSelections: true },
        },
      },
    });

    if (!match) {
      return res.status(404).json({ error: "Partie non trouvée" });
    }

    res.json({ match });
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la récupération de la partie" });
  }
});

// Modifier le statut d'un match
router.patch("/matches/:id/status", validate(updateMatchStatusSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const previous = await prisma.match.findUnique({
      where: { id },
      select: { status: true },
    });

    const match = await prisma.match.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });

    await safeAudit(req, {
      action: "match.status.update",
      entity: "Match",
      entityId: id,
      oldValue: previous,
      newValue: { status: match.status },
    });

    res.json({ match });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Partie non trouvée" });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la modification du statut" });
  }
});

/**
 * Lot P.B.4 — Forfait force par un admin (no-show, comportement toxique...).
 *
 * Passe le match a `status="ended"` et trace le forfait dans
 * `forfeitedAt` / `forfeitWinnerSide` / `forfeitReason`. La raison est
 * obligatoire pour la tracabilite audit log. Le winner cote ne fait pas
 * de change directe sur le score (Turn payload) : c'est une decision
 * administrative qui prime, exposee en UI admin via les nouveaux champs.
 *
 * Refuse si le match est deja `cancelled` ou deja `forfeitedAt != null`.
 */
router.post(
  "/matches/:id/forfeit",
  validate(adminMatchForfeitSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { winnerSide, reason } = req.body as {
        winnerSide: "A" | "B";
        reason: string;
      };

      const previous = await prisma.match.findUnique({
        where: { id },
        select: {
          status: true,
          forfeitedAt: true,
          forfeitWinnerSide: true,
          forfeitReason: true,
          cancelledAt: true,
        },
      });

      if (!previous) {
        return res.status(404).json({ error: "Partie non trouvée" });
      }
      if (previous.cancelledAt) {
        return res
          .status(409)
          .json({ error: "Le match est deja annule, impossible de forfaiter" });
      }
      if (previous.forfeitedAt) {
        return res
          .status(409)
          .json({ error: "Le match a deja ete forfeite" });
      }

      const now = new Date();
      const match = await prisma.match.update({
        where: { id },
        data: {
          status: "ended",
          forfeitedAt: now,
          forfeitWinnerSide: winnerSide,
          forfeitReason: reason,
        },
        select: {
          id: true,
          status: true,
          forfeitedAt: true,
          forfeitWinnerSide: true,
          forfeitReason: true,
        },
      });

      await safeAudit(req, {
        action: "match.forfeit",
        entity: "Match",
        entityId: id,
        oldValue: previous,
        newValue: {
          status: match.status,
          forfeitedAt: match.forfeitedAt,
          forfeitWinnerSide: match.forfeitWinnerSide,
          forfeitReason: match.forfeitReason,
        },
      });

      res.json({ match });
    } catch (e: any) {
      if (e.code === "P2025") {
        return res.status(404).json({ error: "Partie non trouvée" });
      }
      serverLog.error(e);
      res.status(500).json({ error: "Erreur lors du forfait" });
    }
  },
);

/**
 * Lot P.B.4 — Annulation administrative d'un match (bug, exploit, etc.).
 *
 * Passe le match a `status="cancelled"` + trace metadata. La raison est
 * obligatoire pour la tracabilite audit log. Distinct du forfait : un
 * cancel implique qu'il n'y a pas de vainqueur. Refuse si deja forfeite
 * ou deja cancelled (idempotence stricte).
 */
router.post(
  "/matches/:id/cancel",
  validate(adminMatchCancelSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body as { reason: string };

      const previous = await prisma.match.findUnique({
        where: { id },
        select: {
          status: true,
          forfeitedAt: true,
          cancelledAt: true,
          cancelReason: true,
        },
      });

      if (!previous) {
        return res.status(404).json({ error: "Partie non trouvée" });
      }
      if (previous.forfeitedAt) {
        return res
          .status(409)
          .json({ error: "Le match est deja forfeite, impossible d'annuler" });
      }
      if (previous.cancelledAt) {
        return res
          .status(409)
          .json({ error: "Le match a deja ete annule" });
      }

      const now = new Date();
      const match = await prisma.match.update({
        where: { id },
        data: {
          status: "cancelled",
          cancelledAt: now,
          cancelReason: reason,
        },
        select: {
          id: true,
          status: true,
          cancelledAt: true,
          cancelReason: true,
        },
      });

      await safeAudit(req, {
        action: "match.cancel",
        entity: "Match",
        entityId: id,
        oldValue: previous,
        newValue: {
          status: match.status,
          cancelledAt: match.cancelledAt,
          cancelReason: match.cancelReason,
        },
      });

      res.json({ match });
    } catch (e: any) {
      if (e.code === "P2025") {
        return res.status(404).json({ error: "Partie non trouvée" });
      }
      serverLog.error(e);
      res.status(500).json({ error: "Erreur lors de l'annulation" });
    }
  },
);

// Supprimer un match et ses données associées
router.delete("/matches/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const match = await prisma.match.findUnique({
      where: { id },
      select: { id: true, status: true, seed: true, createdAt: true },
    });

    if (!match) {
      return res.status(404).json({ error: "Partie non trouvée" });
    }

    // Supprimer dans l'ordre: turns, selections, relation joueurs, puis match
    await prisma.turn.deleteMany({ where: { matchId: id } });
    await prisma.teamSelection.deleteMany({ where: { matchId: id } });
    await (prisma as any).$executeRawUnsafe(
      `DELETE FROM "_MatchToUser" WHERE "A" = $1 OR "B" = $1`,
      id,
    );
    await prisma.match.delete({ where: { id } });

    await safeAudit(req, {
      action: "match.delete",
      entity: "Match",
      entityId: id,
      oldValue: match,
    });

    res.json({ ok: true });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Partie non trouvée" });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la suppression de la partie" });
  }
});

// Purge toutes les parties (matches, turns, selections et liens joueurs)
router.post("/matches/purge", async (req, res) => {
  try {
    const matchCount = await prisma.match.count();
    await prisma.turn.deleteMany({});
    await prisma.teamSelection.deleteMany({});
    // Supprimer les relations dans la table de jonction _MatchToUser
    await (prisma as any).$executeRawUnsafe('DELETE FROM "_MatchToUser"');
    await prisma.match.deleteMany({});

    await safeAudit(req, {
      action: "match.purge",
      entity: "Match",
      oldValue: { matchCount },
    });

    res.json({ ok: true });
  } catch (e) {
    serverLog.error(e);
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
    serverLog.error(e);
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
      totalLocalMatches,
      pendingLocalMatches,
      inProgressLocalMatches,
      completedLocalMatches,
      cancelledLocalMatches,
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
      prisma.localMatch.count(),
      // En attente = pending + waiting_for_player
      prisma.localMatch.count({
        where: { status: { in: ["pending", "waiting_for_player"] } },
      }),
      prisma.localMatch.count({ where: { status: "in_progress" } }),
      prisma.localMatch.count({ where: { status: "completed" } }),
      prisma.localMatch.count({ where: { status: "cancelled" } }),
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
      localMatches: {
        total: totalLocalMatches,
        pending: pendingLocalMatches,
        inProgress: inProgressLocalMatches,
        completed: completedLocalMatches,
        cancelled: cancelledLocalMatches,
      },
      recent: {
        users: recentUsers,
        matches: recentMatches,
      },
      health: "ok",
      time: new Date().toISOString(),
    });
  } catch (e: any) {
    serverLog.error("Erreur lors de la récupération des statistiques:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =============================================================================
// ROUTES ADMIN POUR LES ÉQUIPES
// =============================================================================

// Route pour lister toutes les équipes avec filtres et pagination
router.get("/teams", validateQuery(adminTeamsQuerySchema), async (req, res) => {
  try {
    const {
      search = "",
      roster = "",
      ownerId = "",
      ruleset,
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
    if (ruleset && typeof ruleset === "string") {
      where.ruleset = ruleset;
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
        ruleset: true,
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
    serverLog.error(e);
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
    serverLog.error(e);
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

    await safeAudit(req, {
      action: "team.delete",
      entity: "Team",
      entityId: id,
      oldValue: { id: team.id, name: team.name, ownerId: team.ownerId },
    });

    res.json({ ok: true });
  } catch (e: any) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Équipe non trouvée" });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la suppression de l'équipe" });
  }
});

/**
 * S27.6.3 — Pure helper qui parse les query params de `/audit-log` en
 * un `where` Prisma + pagination clamped (max 200 par page). Extrait
 * pour pouvoir etre teste sans Prisma.
 */
export function parseAuditLogQuery(query: {
  limit?: unknown;
  page?: unknown;
  userId?: unknown;
  action?: unknown;
  entity?: unknown;
}): {
  limit: number;
  page: number;
  skip: number;
  where: { userId?: string; action?: string; entity?: string };
} {
  const limitRaw = parseInt(
    typeof query.limit === "string" ? query.limit : "50",
    10,
  );
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(200, limitRaw))
    : 50;
  const pageRaw = parseInt(
    typeof query.page === "string" ? query.page : "1",
    10,
  );
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const skip = (page - 1) * limit;

  const where: { userId?: string; action?: string; entity?: string } = {};
  if (typeof query.userId === "string" && query.userId.length > 0) {
    where.userId = query.userId;
  }
  if (typeof query.action === "string" && query.action.length > 0) {
    where.action = query.action;
  }
  if (typeof query.entity === "string" && query.entity.length > 0) {
    where.entity = query.entity;
  }
  return { limit, page, skip, where };
}

/**
 * S27.6.3 — Lecture du journal d'audit admin.
 *
 * Retourne les entrees `AuditLog` les plus recentes, paginated +
 * filtrables par `userId`, `action`, `entity`. Tri par `createdAt`
 * DESC (plus recent en haut), borne a 200 entrees max par page pour
 * eviter de saturer le payload.
 */
router.get("/audit-log", async (req, res) => {
  try {
    const { limit, page, skip, where } = parseAuditLogQuery(req.query);
    const total = await prisma.auditLog.count({ where });
    const entries = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    });

    res.json({ entries, total, page, limit });
  } catch (e) {
    serverLog.error(e);
    res
      .status(500)
      .json({ error: "Erreur lors de la lecture du journal d'audit" });
  }
});

export default router;
