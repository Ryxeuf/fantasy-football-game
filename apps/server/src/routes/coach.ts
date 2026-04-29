import { Router, type Request, type Response } from "express";
import {
  getCoachPublicProfile,
  getCoachShowcaseAchievements,
} from "../services/coach-profile";
import { serverLog } from "../utils/server-log";

/**
 * S26.3c — Route publique GET /coach/:slug.
 *
 * Resoud un slug (derive du coachName via S26.3a `coachSlugFrom`) en
 * profil public via le service S26.3b `getCoachPublicProfile`. Pas
 * d'authentification : la page `/coach/{slug}` doit etre indexable
 * (SEO bonus — voir DoD S26.3).
 *
 * S26.3f — Enrichit la reponse avec la vitrine succes
 * (`getCoachShowcaseAchievements`).
 */
export async function handleGetCoachPublicProfile(
  req: Request,
  res: Response,
): Promise<void> {
  const slug = String(req.params.slug ?? "").trim();
  if (slug.length === 0) {
    res.status(400).json({ success: false, error: "Slug requis" });
    return;
  }

  try {
    const profile = await getCoachPublicProfile(slug);
    if (!profile) {
      res.status(404).json({ success: false, error: "Coach introuvable" });
      return;
    }
    const achievements = await getCoachShowcaseAchievements(profile.id);
    res
      .status(200)
      .json({ success: true, data: { ...profile, achievements } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    serverLog.error("[GET /coach/:slug] error:", message);
    res.status(500).json({ success: false, error: message });
  }
}

const router = Router();
router.get("/:slug", handleGetCoachPublicProfile);

export default router;
