import { Router, type Response } from "express";
import { prisma } from "../prisma";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { updatePrivacySchema } from "../schemas/auth.schemas";
import { serverLog } from "../utils/server-log";

/**
 * S26.3j — Toggle "Profil prive" RGPD pour `/coach/{slug}`.
 *
 * Met a jour `User.privateProfile` (true = profil retire de la lookup
 * publique, du sitemap, et 404 sur `GET /coach/:slug`).
 */
export async function handleUpdatePrivacy(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const { privateProfile } = req.body as { privateProfile: boolean };
    const updated = (await (prisma as unknown as {
      user: {
        update: (args: unknown) => Promise<{
          id: string;
          privateProfile: boolean;
        }>;
      };
    }).user.update({
      where: { id: req.user!.id },
      data: { privateProfile },
      select: { id: true, privateProfile: true },
    })) as { id: string; privateProfile: boolean };

    res
      .status(200)
      .json({ success: true, data: { privateProfile: updated.privateProfile } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    serverLog.error("[PUT /auth/me/privacy] error:", message);
    res.status(500).json({ success: false, error: message });
  }
}

const router = Router();
router.put(
  "/me/privacy",
  authUser,
  validate(updatePrivacySchema),
  handleUpdatePrivacy,
);

export default router;
