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
import { z } from "zod";
import { prisma } from "../prisma";
import { authUser } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validate } from "../middleware/validate";
import { serverLog } from "../utils/server-log";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { invalidateAllMemo } from "../utils/memoize-async";
import { revalidateRosterPages } from "../services/revalidate-web";
import { seedProLeague } from "../seeders/pro-league";
import { reimportSeason3SkillAccess } from "../seeders/season3-skill-access";
import { syncRosters } from "../seeders/sync-rosters";

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

    // Reference data fraîchement seedée : drop le cache mémoire pour la rendre
    // visible au prochain appel sans attendre le TTL.
    invalidateAllMemo();

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

    // Les accès écrits doivent être visibles immédiatement côté /api/positions
    // & /api/rosters (cache mémoire 5 min sinon).
    invalidateAllMemo();

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

/**
 * POST /admin/utilities/sync-rosters
 *
 * Synchronise les positions des rosters depuis le code (source de vérité
 * `packages/game-engine/src/rosters/*`) vers la base : purge des positions
 * orphelines, upsert noms/stats/coût/accès, relink des compétences de base.
 *
 * `write` défaut `false` = DRY-RUN : aucune écriture, renvoie le diff (ce qui
 * serait créé / mis à jour / purgé) pour prévisualiser avant d'appliquer.
 * `write: true` applique réellement. Filtres optionnels `ruleset` / `roster`.
 *
 * Complète `reimport-season3-access` (qui ne réécrit QUE les accès de
 * compétences) : ce sync applique aussi les renommages et les stats. À
 * relancer après tout déploiement modifiant les données de roster.
 */
const syncRostersSchema = z.object({
  write: z.boolean().optional().default(false),
  ruleset: z.string().trim().min(1).optional(),
  roster: z.string().trim().min(1).optional(),
});
type SyncRostersBody = z.infer<typeof syncRostersSchema>;

router.post("/sync-rosters", validate(syncRostersSchema), async (req, res) => {
  const start = Date.now();
  const body: SyncRostersBody = req.body;
  try {
    const result = await syncRosters(body);
    const durationMs = Date.now() - start;

    // Audit + invalidation uniquement sur écriture réelle (le dry-run n'a
    // aucun effet de bord). Sans ça, le cache mémoire `memoizeAsync` des
    // endpoints /api/rosters & /api/positions (TTL 5 min) continuerait à
    // servir l'ancien roster malgré la base à jour.
    if (result.write) {
      invalidateAllMemo();
      // Invalide les pages ISR /teams/* du front (best-effort, ne throw pas).
      void revalidateRosterPages();
      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "utility.sync-rosters.run",
        entity: "Position",
        newValue: {
          durationMs,
          ruleset: body.ruleset ?? null,
          roster: body.roster ?? null,
          upserted: result.upserted,
          pruned: result.pruned,
          skillLinks: result.skillLinks,
        },
      });
    }

    const verb = result.write ? "Appliqué" : "Dry-run";
    const warnPart = result.missingRosters.length
      ? ` ${result.missingRosters.length} roster(s) absent(s) en base.`
      : "";
    res.json({
      ok: true,
      durationMs,
      write: result.write,
      upserted: result.upserted,
      pruned: result.pruned,
      skillLinks: result.skillLinks,
      prunedPositions: result.prunedPositions,
      upsertedPositions: result.upsertedPositions,
      missingSkills: result.missingSkills,
      missingRosters: result.missingRosters,
      message:
        `${verb} en ${durationMs}ms : ${result.upserted} positions upsert, ` +
        `${result.pruned} purgées, ${result.skillLinks} liens de compétence.` +
        warnPart +
        (result.write ? "" : " (Relancer avec write=true pour appliquer.)"),
    });
  } catch (e) {
    const durationMs = Date.now() - start;
    serverLog.error("[admin.utilities.sync-rosters] failed:", e);
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    res.status(500).json({ ok: false, error: message, durationMs });
  }
});

export default router;
