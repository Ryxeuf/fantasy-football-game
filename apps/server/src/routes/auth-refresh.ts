import type { Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../prisma";
import { validate } from "../middleware/validate";
import { refreshTokenSchema } from "../schemas/auth.schemas";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  signAccessToken,
} from "../services/auth-tokens";
import {
  rotateRefreshToken,
  RefreshTokenReuseError,
  type RefreshTokenStore,
} from "../services/refresh-token-store";
import { PrismaRefreshTokenStore } from "../services/prisma-refresh-token-store";
import { normalizeRoles } from "../utils/roles";

/**
 * S24.3d — POST /auth/refresh.
 *
 * Accepts a refresh token, rotates it (revoke old, issue new with fresh jti)
 * and returns a fresh 15-minute access token plus the new refresh token.
 *
 * Errors:
 * - 400 invalid body
 * - 401 invalid / expired refresh token (also when reuse is detected — the
 *   response includes `reuseDetected: true` so clients can force re-login
 *   instead of retrying)
 * - 403 user account marked invalid (pre-alpha gate, soft-deleted)
 * - 404 user no longer exists (cascade delete)
 */
export function handleRefreshToken(store: RefreshTokenStore) {
  return async (req: Request, res: Response): Promise<void> => {
    const presented = req.body?.refreshToken;
    if (typeof presented !== "string" || presented.length === 0) {
      res.status(400).json({ error: "Refresh token requis" });
      return;
    }

    let rotated;
    try {
      rotated = await rotateRefreshToken(presented, store);
    } catch (err: unknown) {
      if (err instanceof RefreshTokenReuseError) {
        res.status(401).json({
          error: "Refresh token reuse detected. Please log in again.",
          reuseDetected: true,
        });
        return;
      }
      res.status(401).json({ error: "Refresh token invalide" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: rotated.sub } });
    if (!user) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }
    if (user.valid === false) {
      res.status(403).json({ error: "Compte désactivé" });
      return;
    }

    const roles = normalizeRoles(
      ((user as unknown as { roles?: string[] | string }).roles) ??
        (user as unknown as { role?: string }).role,
    );
    const primaryRole = roles[0];
    const accessToken = signAccessToken({
      sub: user.id,
      role: primaryRole,
      roles,
    });

    res.status(200).json({
      token: accessToken,
      refreshToken: rotated.token,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
  };
}

/**
 * Singleton store used by the router. Mockable in tests by importing
 * `handleRefreshToken` directly with a stub store.
 */
const defaultStore: RefreshTokenStore = new PrismaRefreshTokenStore();

const router = Router();
router.post(
  "/refresh",
  validate(refreshTokenSchema),
  handleRefreshToken(defaultStore),
);

export default router;
