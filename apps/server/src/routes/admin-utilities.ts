/**
 * Lot admin utilities — endpoints pour relancer des taches de maintenance
 * a chaud sans SSH / re-deploy (seed, cache invalidation, ...).
 *
 * Chaque utilitaire doit :
 *  - Etre idempotent (seed = upsert, etc.).
 *  - Tracer un audit log strict (action `utility.<nom>.run`).
 *  - Retourner un message lisible affichable en UI.
 *
 * Pattern : 1 endpoint POST par utilitaire (pas de GET car l'action a
 * un effet de bord). Body vide accepte.
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { authUser } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { serverLog } from "../utils/server-log";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { seedProLeague } from "../seeders/pro-league";
import { reimportSeason3SkillAccess } from "../seeders/season3-skill-access";

const router = Router();

router.use(authUser, adminOnly);

/**
 * POST /admin/utilities/seed/pro-league
 *
 * Reseed la Pro League : 16 equipes + branding + roster generator. Le
 * seeder est idempotent (upsert sur slug), donc safe a rejouer plusieurs
 * fois. Utile apres un dump/restore prod ou si la table ProTeam a ete
 * videe par erreur.
 *
 * Mesure le temps execution pour faciliter le debug si le seed bloque
 * (peut prendre quelques secondes a cause de la generation procedurale
 * des rosters par defaut).
 */
router.post("/seed/pro-league", async (req, res) => {
  const start = Date.now();
  try {
    await seedProLeague();
    const durationMs = Date.now() - start;

    const [leagueCount, teamCount] = await Promise.all([
      prisma.proLeague.count(),
      prisma.proTeam.count(),
    ]);

    await safeRecordAdminActionFromRequest(prisma, req, {
      action: "utility.seed.pro-league.run",
      entity: "ProLeague",
      newValue: { durationMs, leagueCount, teamCount },
    });

    res.json({
      ok: true,
      durationMs,
      leagueCount,
      teamCount,
      message: `Pro League re-seed OK en ${durationMs}ms. ${teamCount} equipes, ${leagueCount} ligue(s).`,
    });
  } catch (e) {
    const durationMs = Date.now() - start;
    serverLog.error("[admin.utilities.seed.pro-league] failed:", e);
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    res.status(500).json({
      ok: false,
      error: message,
      durationMs,
    });
  }
});

/**
 * POST /admin/utilities/reimport-season3-access
 *
 * Réimporte les accès Primaire/Secondaire de compétences (dont la nouvelle
 * catégorie Sournoiserie / Scélérates) sur toutes les positions season_3
 * existantes, depuis la source canonique SKILL_ACCESS_SEASON3. Idempotent :
 * écrit uniquement `primary/secondarySkills`, sans wiper équipes ni skills.
 * À relancer après régénération de la source (générateur) ou un dump/restore.
 */
router.post("/reimport-season3-access", async (req, res) => {
  const start = Date.now();
  try {
    const result = await reimportSeason3SkillAccess();
    const durationMs = Date.now() - start;

    await safeRecordAdminActionFromRequest(prisma, req, {
      action: "utility.reimport-season3-access.run",
      entity: "Position",
      newValue: {
        durationMs,
        rosters: result.rosters,
        positionsTotal: result.positionsTotal,
        updated: result.updated,
        missing: result.missing.length,
      },
    });

    const missingPart = result.missing.length
      ? `, ${result.missing.length} sans données.`
      : ".";
    res.json({
      ok: true,
      durationMs,
      rosters: result.rosters,
      positionsTotal: result.positionsTotal,
      updated: result.updated,
      missing: result.missing,
      message:
        `Accès S3 réimportés en ${durationMs}ms : ${result.updated}/` +
        `${result.positionsTotal} positions mises à jour` +
        missingPart,
    });
  } catch (e) {
    const durationMs = Date.now() - start;
    serverLog.error("[admin.utilities.reimport-season3-access] failed:", e);
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    res.status(500).json({ ok: false, error: message, durationMs });
  }
});

export default router;
