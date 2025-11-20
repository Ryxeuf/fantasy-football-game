import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { normalizeRoles } from "../utils/roles";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface AuthenticatedUser {
  id: string;
  role?: string;
  roles: string[];
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

    req.user = {
      id: payload.sub,
      role: roles[0],
      roles,
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Token invalide" });
  }
}

