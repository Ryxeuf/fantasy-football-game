/**
 * Console admin — barème d'avancement par édition (lot 6.2).
 *
 * Grille éditable : coûts PSP et surcoûts de VE des 6 paliers, par type
 * d'amélioration, plus les surcoûts de caractéristique et la taxe Élite.
 * Toute écriture invalide le cache du repository pour que la correction
 * s'applique au prochain calcul de VE sans redéploiement.
 *
 * La table décrit une ÉDITION : c'est ce qui corrige le bug d'origine (les
 * valeurs Saison 3 appliquées aux équipes Saison 2). Sans ligne pour une
 * édition, le barème compilé s'applique.
 */

import { Router, type Response } from "express";
import { z } from "zod";
import { RULESETS, type Ruleset } from "@bb/game-engine";
import { prisma } from "../prisma";
import { adminOnly } from "../middleware/adminOnly";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate, validateQuery } from "../middleware/validate";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { invalidateAdvancementScheduleCache } from "../services/advancement-schedule-repository";
import { syncAdvancementCosts } from "../seeders/sync-advancement-costs";
import { serverLog } from "../utils/server-log";

const router = Router();
router.use(authUser, adminOnly);

const rulesetSchema = z.enum(RULESETS as unknown as [Ruleset, ...Ruleset[]]);
const kindSchema = z.enum([
  "primary",
  "secondary",
  "random_primary",
  "random_secondary",
  "characteristic",
]);
const statSchema = z.enum(["ma", "st", "ag", "pa", "av"]);

const querySchema = z.object({ ruleset: rulesetSchema.optional() });
export type AdvancementCostQuery = z.infer<typeof querySchema>;

/**
 * Un enregistrement remplace la grille ENTIÈRE d'une édition : une grille à
 * trous ferait retomber le type concerné sur le barème compilé, donc on
 * n'accepte pas de mise à jour partielle silencieuse.
 */
const saveSchema = z.object({
  ruleset: rulesetSchema,
  costs: z
    .array(
      z.object({
        kind: kindSchema,
        step: z.number().int().min(1).max(6),
        sppCost: z.number().int().min(0).max(200),
        teamValueSurcharge: z.number().int().min(0).max(500_000),
      }),
    )
    .max(60),
  characteristics: z
    .array(
      z.object({
        stat: statSchema,
        surcharge: z.number().int().min(0).max(500_000),
      }),
    )
    .max(5),
  eliteSkillSurcharge: z.number().int().min(0).max(500_000).optional(),
});
export type SaveAdvancementCostsInput = z.infer<typeof saveSchema>;

function fail(res: Response, e: unknown, what: string): void {
  serverLog.error(`[admin-advancement-costs] ${what}`, e);
  res.status(500).json({ error: "Erreur serveur" });
}

/** Grille d'une édition (vide = repli compilé côté lecture). */
router.get("/", validateQuery(querySchema), async (req, res) => {
  try {
    const query = req.query as unknown as AdvancementCostQuery;
    const where = query.ruleset ? { ruleset: query.ruleset } : {};
    const [costs, characteristics, configs] = await Promise.all([
      prisma.advancementCost.findMany({
        where,
        orderBy: [{ ruleset: "asc" }, { kind: "asc" }, { step: "asc" }],
      }),
      prisma.characteristicValue.findMany({
        where,
        orderBy: [{ ruleset: "asc" }, { stat: "asc" }],
      }),
      prisma.rulesetConfig.findMany({ where, orderBy: { ruleset: "asc" } }),
    ]);
    res.json({ costs, characteristics, configs });
  } catch (e: unknown) {
    fail(res, e, "liste");
  }
});

router.put("/", validate(saveSchema), async (req, res) => {
  const body: SaveAdvancementCostsInput = req.body;
  try {
    for (const row of body.costs) {
      await prisma.advancementCost.upsert({
        where: {
          ruleset_kind_step: {
            ruleset: body.ruleset,
            kind: row.kind as never,
            step: row.step,
          },
        },
        create: {
          ruleset: body.ruleset,
          kind: row.kind as never,
          step: row.step,
          sppCost: row.sppCost,
          teamValueSurcharge: row.teamValueSurcharge,
        },
        update: {
          sppCost: row.sppCost,
          teamValueSurcharge: row.teamValueSurcharge,
        },
      });
    }
    for (const row of body.characteristics) {
      await prisma.characteristicValue.upsert({
        where: { ruleset_stat: { ruleset: body.ruleset, stat: row.stat } },
        create: {
          ruleset: body.ruleset,
          stat: row.stat,
          surcharge: row.surcharge,
        },
        update: { surcharge: row.surcharge },
      });
    }
    if (body.eliteSkillSurcharge !== undefined) {
      await prisma.rulesetConfig.upsert({
        where: { ruleset: body.ruleset },
        create: {
          ruleset: body.ruleset,
          eliteSkillSurcharge: body.eliteSkillSurcharge,
        },
        update: { eliteSkillSurcharge: body.eliteSkillSurcharge },
      });
    }
    invalidateAdvancementScheduleCache();
    await safeRecordAdminActionFromRequest(prisma, req as AuthenticatedRequest, {
      action: "advancement-costs.save",
      entity: "AdvancementCost",
      entityId: body.ruleset,
      oldValue: null,
      newValue: { costs: body.costs.length },
    });
    res.json({ ruleset: body.ruleset, saved: true });
  } catch (e: unknown) {
    fail(res, e, "enregistrement");
  }
});

/**
 * Amorçage / réinitialisation depuis le barème transcrit. C'est aussi la
 * sortie explicite pour poser les valeurs Saison 2, que l'arbitrage demande
 * de valider avant de les seeder automatiquement.
 */
router.post("/reset", validate(z.object({ ruleset: rulesetSchema })), async (req, res) => {
  try {
    const result = await syncAdvancementCosts({
      write: true,
      force: true,
      rulesets: [req.body.ruleset as Ruleset],
    });
    invalidateAdvancementScheduleCache();
    await safeRecordAdminActionFromRequest(prisma, req as AuthenticatedRequest, {
      action: "advancement-costs.reset",
      entity: "AdvancementCost",
      entityId: req.body.ruleset,
      oldValue: null,
      newValue: result,
    });
    res.json(result);
  } catch (e: unknown) {
    fail(res, e, "réinitialisation");
  }
});

export default router;
