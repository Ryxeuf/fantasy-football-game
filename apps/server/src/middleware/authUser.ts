import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { normalizeRoles } from "../utils/roles";
import { JWT_SECRET } from "../config";

export interface AuthenticatedUser {
  id: string;
  role?: string;
  roles: string[];
  /**
   * Quand la session est une impersonation admin (« se connecter en tant
   * que »), id de l'admin a l'origine (claim `act` du token). Absent pour
   * une session normale.
   */
  impersonatorId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function authUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  if (!token) return res.status(401).json({ error: "Non authentifié" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    const roles = normalizeRoles(
      (payload && (payload.roles as string[] | string | undefined)) ??
        (payload && (payload.role as string | undefined)),
    );

    const impersonatorId =
      payload && typeof payload.act === "string" && payload.act
        ? (payload.act as string)
        : undefined;

    req.user = {
      id: payload.sub,
      role: roles[0],
      roles,
      ...(impersonatorId ? { impersonatorId } : {}),
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Token invalide" });
  }
}

