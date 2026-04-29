import { Router, type Request, type Response } from "express";
import {
  getCoachEloHistory,
  getCoachPublicProfile,
  getCoachRecentTeams,
  getCoachShowcaseAchievements,
  listPublicCoachSlugs,
} from "../services/coach-profile";
import { serverLog } from "../utils/server-log";

const DEFAULT_ELO_HISTORY_DAYS = 90;

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
    const [achievements, recentTeams] = await Promise.all([
      getCoachShowcaseAchievements(profile.id),
      getCoachRecentTeams(profile.id),
    ]);
    res.status(200).json({
      success: true,
      data: { ...profile, achievements, recentTeams },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    serverLog.error("[GET /coach/:slug] error:", message);
    res.status(500).json({ success: false, error: message });
  }
}

/**
 * S26.3g — Liste des profils coach publics (sitemap-friendly).
 *
 * Renvoie l'ensemble des slugs `/coach/:slug` indexables. La page
 * sitemap.ts du Next.js consomme cette liste pour reflechir les
 * URLs publiques de profils dans le sitemap SEO.
 */
export async function handleListPublicCoachSlugs(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const slugs = await listPublicCoachSlugs();
    res.status(200).json({ success: true, data: { slugs } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    serverLog.error("[GET /coach] error:", message);
    res.status(500).json({ success: false, error: message });
  }
}

/**
 * S26.3m — GET /coach/:slug/elo-history
 *
 * Endpoint public consomme par le composant `CoachEloChart` du futur
 * slice S26.3n pour tracer la courbe ELO 90j sur `/coach/{slug}`. Pas
 * d'authentification (les profils privés filtrent en amont via
 * `getCoachPublicProfile`). Tous les snapshots renvoyes sont publics
 * — la table `EloSnapshot` ne contient pas de donnees sensibles.
 */
export async function handleGetCoachEloHistory(
  req: Request,
  res: Response,
): Promise<void> {
  const slug = String(req.params.slug ?? "").trim();
  if (slug.length === 0) {
    res.status(400).json({ success: false, error: "Slug requis" });
    return;
  }
  const rawDays = req.query?.days;
  const parsed = typeof rawDays === "string" ? Number.parseInt(rawDays, 10) : NaN;
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ELO_HISTORY_DAYS;

  try {
    const profile = await getCoachPublicProfile(slug);
    if (!profile) {
      res.status(404).json({ success: false, error: "Coach introuvable" });
      return;
    }
    const snapshots = await getCoachEloHistory(profile.id, days);
    res.status(200).json({ success: true, data: { snapshots } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    serverLog.error("[GET /coach/:slug/elo-history] error:", message);
    res.status(500).json({ success: false, error: message });
  }
}

const router = Router();
// L'ordre importe : la route specifique `/` (liste) doit etre montee
// avant `/:slug` qui matcherait sinon n'importe quoi (Express 4
// resout par ordre d'enregistrement).
router.get("/", handleListPublicCoachSlugs);
router.get("/:slug/elo-history", handleGetCoachEloHistory);
router.get("/:slug", handleGetCoachPublicProfile);

export default router;
