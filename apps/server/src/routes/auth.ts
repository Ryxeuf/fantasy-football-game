import { Router } from "express";
import { prisma } from "../prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";

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
        createdAt: true,
      },
    });

    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });
    return res.status(201).json({ user, token });
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
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const publicUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      coachName: user.coachName,
      firstName: user.firstName,
      lastName: user.lastName,
      dateOfBirth: user.dateOfBirth,
      role: user.role,
      createdAt: user.createdAt,
    };
    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });
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
    res.json({ user });
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

    res.json({ user: updatedUser });
  } catch (e: any) {
    if (e.code === "P2002") {
      return res.status(409).json({ error: "Email déjà utilisé" });
    }
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});
