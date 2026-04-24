import { Router } from "express";
import { prisma } from "../prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { normalizeRoles } from "../utils/roles";
import { validate } from "../middleware/validate";
import {
  loginSchema,
  registerSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "../schemas/auth.schemas";
import { JWT_SECRET } from "../config";
import {
  claimOrphanKofiTransactions,
  ensureKofiLinkCode,
} from "../services/kofi-claim";
import { isSupporter } from "../services/kofi";

const router = Router();

router.post("/register", validate(registerSchema), async (req, res) => {
  try {
    const {
      email,
      password,
      coachName,
      name,
      firstName,
      lastName,
      dateOfBirth,
    } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email déjà utilisé" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        coachName,
        name: name ?? coachName,
        firstName: firstName && firstName !== "" ? firstName : null,
        lastName: lastName && lastName !== "" ? lastName : null,
        dateOfBirth:
          dateOfBirth && dateOfBirth !== "" ? new Date(dateOfBirth) : null,
        valid: true,
      },
    });

    // Alloue le code Ko-fi et rattache d'éventuels dons orphelins.
    // Ces opérations ne doivent pas bloquer l'inscription si elles échouent.
    try {
      await ensureKofiLinkCode(created.id);
      await claimOrphanKofiTransactions(created.id, created.email);
    } catch (kofiErr) {
      console.error("[register] kofi post-create hooks failed:", kofiErr);
    }

    const roles = normalizeRoles((created as any).roles ?? created.role);
    const primaryRole = roles[0];
    const publicUser = {
      id: created.id,
      email: created.email,
      name: created.name,
      coachName: created.coachName,
      firstName: created.firstName,
      lastName: created.lastName,
      dateOfBirth: created.dateOfBirth,
      role: primaryRole,
      roles,
      valid: created.valid,
      createdAt: created.createdAt,
    };

    const token = jwt.sign(
      { sub: created.id, role: primaryRole, roles },
      JWT_SECRET,
      { expiresIn: "7d" },
    );
    return res.status(201).json({ user: publicUser, token });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Email déjà utilisé" });
    }
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/login", validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`[LOGIN] Utilisateur non trouvé: ${email}`);
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    console.log(
      `[LOGIN] Tentative de connexion pour ${email}: valid=${user.valid}, role=${user.role}`,
    );
    
    // Le champ `valid` n'existe que dans le schéma Postgres (pré-alpha gate).
    // Sur les autres schémas (ex: SQLite de test), il est undefined et le
    // compte doit être traité comme valide.
    if (user.valid === false) {
      console.log(`[LOGIN] Compte non validé pour ${email}`);
      return res.status(403).json({ error: "Votre compte n'est pas encore validé. Veuillez contacter un administrateur." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      console.log(`[LOGIN] Mot de passe incorrect pour ${email}`);
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    console.log(`[LOGIN] Connexion réussie pour ${email}`);

    // Rattrape les dons orphelins reçus avant l'inscription et garantit que
    // le compte a un kofiLinkCode. Jamais bloquant sur le login.
    try {
      await ensureKofiLinkCode(user.id);
      await claimOrphanKofiTransactions(user.id, user.email);
    } catch (kofiErr) {
      console.error("[login] kofi post-login hooks failed:", kofiErr);
    }

    const roles = normalizeRoles((user as any).roles ?? user.role);
    const primaryRole = roles[0];

    const publicUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      coachName: user.coachName,
      firstName: user.firstName,
      lastName: user.lastName,
      dateOfBirth: user.dateOfBirth,
      role: primaryRole,
      roles,
      createdAt: user.createdAt,
    };
    const token = jwt.sign(
      { sub: user.id, role: primaryRole, roles },
      JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );
    return res.json({ user: publicUser, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Désactiver le compte courant (suppression logique)
router.delete("/me", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        valid: false,
      },
    });

    return res.json({
      message:
        "Votre compte a été désactivé avec succès. Vous ne pourrez plus vous connecter avec cet accès.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;

// Profil courant
router.get("/me", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        coachName: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        role: true,
        patreon: true,
        kofiLinkCode: true,
        supporterTier: true,
        supporterActiveUntil: true,
        totalDonatedCentsByCurrency: true,
        discordUserId: true,
        valid: true,
        eloRating: true,
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
    });
    if (!user) return res.status(404).json({ error: "Introuvable" });

    const roles = normalizeRoles(user.role);
    const publicUser = {
      ...user,
      roles,
      isSupporter: isSupporter({
        patreon: user.patreon,
        supporterActiveUntil: user.supporterActiveUntil,
      }),
    };

    res.json({ user: publicUser });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Mettre à jour le profil utilisateur
router.put("/me", authUser, validate(updateProfileSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { email, coachName, firstName, lastName, dateOfBirth } = req.body;

    if (email !== undefined) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== req.user!.id) {
        return res.status(409).json({ error: "Email déjà utilisé" });
      }
    }
    
    // Construction des données à mettre à jour
    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (coachName !== undefined) updateData.coachName = coachName;
    if (firstName !== undefined) updateData.firstName = firstName === "" ? null : firstName;
    if (lastName !== undefined) updateData.lastName = lastName === "" ? null : lastName;
    if (dateOfBirth !== undefined) {
      updateData.dateOfBirth = dateOfBirth === "" || dateOfBirth === null ? null : new Date(dateOfBirth);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        coachName: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const roles = normalizeRoles(updatedUser.role);
    const publicUser = {
      ...updatedUser,
      roles,
    };

    res.json({ user: publicUser });
  } catch (e: any) {
    if (e.code === "P2002") {
      return res.status(409).json({ error: "Email déjà utilisé" });
    }
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Changer le mot de passe
router.put("/me/password", authUser, validate(changePasswordSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Récupérer l'utilisateur avec son mot de passe hashé
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        passwordHash: true,
      },
    });
    
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    
    // Vérifier l'ancien mot de passe
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: "Mot de passe actuel incorrect" });
    }
    
    // Vérifier que le nouveau mot de passe est différent de l'ancien
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit être différent de l'ancien" });
    }
    
    // Hasher le nouveau mot de passe
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash: newPasswordHash },
    });
    
    res.json({ message: "Mot de passe modifié avec succès" });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});
