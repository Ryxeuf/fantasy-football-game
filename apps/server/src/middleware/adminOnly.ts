import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authUser";

export function adminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Accès refusé" });
  return next();
}


