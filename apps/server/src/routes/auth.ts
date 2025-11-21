import { Router } from "express";
import { prisma } from "../prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { normalizeRoles } from "../utils/roles";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

router.post("/register", async (req, res) => {
  try {
    const { email, password, name, coachName, firstName, lastName, dateOfBirth } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }
    if (typeof coachName !== "string" || coachName.trim() === "") {
      return res.status(400).json({ error: "Nom de coach requis" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email déjà utilisé" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { 
        email, 
        passwordHash, 
        name,
        coachName,
        firstName: typeof firstName === "string" ? firstName : null,
        lastName: typeof lastName === "string" ? lastName : null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        valid: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        coachName: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        role: true,
        roles: true,
        valid: true,
        createdAt: true,
      },
    });

    const roles = normalizeRoles(user.roles ?? user.role);
    const publicUser = {
      ...user,
      roles,
    };

    // Ne pas donner de token si le compte n'est pas validé
    return res.status(201).json({ 
      user: publicUser, 
      message: "Votre compte a été créé avec succès. Un administrateur doit valider votre compte avant que vous puissiez vous connecter." 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`[LOGIN] Utilisateur non trouvé: ${email}`);
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    console.log(
      `[LOGIN] Tentative de connexion pour ${email}: valid=${user.valid}, role=${user.role}`,
    );
    
    if (!user.valid) {
      console.log(`[LOGIN] Compte non validé pour ${email}`);
      return res.status(403).json({ error: "Votre compte n'est pas encore validé. Veuillez contacter un administrateur." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      console.log(`[LOGIN] Mot de passe incorrect pour ${email}`);
      return res.status(401).json({ error: "Identifiants invalides" });
    }
    
    console.log(`[LOGIN] Connexion réussie pour ${email}`);

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
    });
    if (!user) return res.status(404).json({ error: "Introuvable" });

    const roles = normalizeRoles(user.role);
    const publicUser = {
      ...user,
      roles,
    };

    res.json({ user: publicUser });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Mettre à jour le profil utilisateur
router.put("/me", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { email, coachName, firstName, lastName, dateOfBirth } = req.body ?? {};
    
    // Validation des champs obligatoires
    if (email !== undefined && typeof email !== "string") {
      return res.status(400).json({ error: "Email invalide" });
    }
    if (email !== undefined) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== req.user!.id) {
        return res.status(409).json({ error: "Email déjà utilisé" });
      }
    }
    
    if (coachName !== undefined && (typeof coachName !== "string" || coachName.trim() === "")) {
      return res.status(400).json({ error: "Nom de coach requis" });
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
router.put("/me/password", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    
    // Validation des champs obligatoires
    if (typeof currentPassword !== "string" || currentPassword.trim() === "") {
      return res.status(400).json({ error: "Mot de passe actuel requis" });
    }
    if (typeof newPassword !== "string" || newPassword.trim() === "") {
      return res.status(400).json({ error: "Nouveau mot de passe requis" });
    }
    
    // Validation de la longueur du nouveau mot de passe
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères" });
    }
    
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
