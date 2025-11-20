import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authUser";
import { prisma } from "../prisma";
import { hasRole, normalizeRoles } from "../utils/roles";

export async function adminOnly(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  // Vérifier que l'utilisateur est authentifié
  if (!req.user?.id) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  // Vérifier le rôle réel dans la base de données pour plus de sécurité
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true, roles: true },
    });

    const roles = user ? normalizeRoles((user as any).roles ?? user.role) : [];

    if (!user || !hasRole(roles, "admin")) {
      return res.status(403).json({ error: "Accès refusé : droits administrateur requis" });
    }

    return next();
  } catch (error) {
    console.error("Erreur lors de la vérification du rôle admin:", error);
    return res.status(500).json({ error: "Erreur serveur lors de la vérification des droits" });
  }
}
