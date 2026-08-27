/**
 * Console admin — catalogues `TeamSpecialRule` et `RegionalLeague` (lot 6.5).
 *
 * Les deux tables ont exactement la même forme (slug + ruleset + libellés
 * FR/EN + descriptions) : une seule fabrique de routeur les sert, montée deux
 * fois. Toute écriture invalide le cache du catalogue
 * (`services/team-rules-catalogue`) pour que la correction soit visible
 * immédiatement sur les fiches.
 *
 * Le SLUG est un contrat de code : il est référencé par `Roster.specialRules`
 * / `Roster.regionalRules`, par `Team.regionalLeague` et par le moteur
 * (remises de coups de pouce, alignements conditionnels). Il se fixe à la
 * création et ne se renomme pas. Une ligne créée avec un slug inconnu du
 * moteur n'est qu'un LIBELLÉ : elle s'affiche mais n'a aucun effet en match —
 * la réponse le signale via `knownToEngine`.
 */

import { Router, type Response } from "express";
import { z } from "zod";
import {
  REGIONAL_LEAGUES,
  RULESETS,
  TEAM_SPECIAL_RULES,
  type Ruleset,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { adminOnly } from "../middleware/adminOnly";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate, validateQuery } from "../middleware/validate";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { invalidateTeamRulesCatalogueCache } from "../services/team-rules-catalogue";
import { syncTeamRules } from "../seeders/sync-team-rules";
import { serverLog } from "../utils/server-log";

const rulesetSchema = z.enum(RULESETS as unknown as [Ruleset, ...Ruleset[]]);

const listQuerySchema = z.object({ ruleset: rulesetSchema.optional() });
export type ListTeamRulesQuery = z.infer<typeof listQuerySchema>;

const createSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    // Contrat de code : ASCII snake_case, comme les slugs du moteur.
    .regex(/^[a-z0-9_]+$/, "Slug attendu en minuscules, chiffres et « _ »"),
  ruleset: rulesetSchema,
  nameFr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(4000),
  descriptionEn: z.string().trim().max(4000).nullable().optional(),
});
export type CreateTeamRuleInput = z.infer<typeof createSchema>;

/** Le slug et l'édition ne changent pas : ils sont référencés ailleurs. */
const updateSchema = createSchema.omit({ slug: true, ruleset: true });
export type UpdateTeamRuleInput = z.infer<typeof updateSchema>;

interface CatalogueConfig {
  /** Nom du modèle Prisma, pour l'accès dynamique. */
  readonly model: "teamSpecialRule" | "regionalLeague";
  /** Entité utilisée dans le journal d'admin. */
  readonly entity: string;
  /** Préfixe des actions journalisées (ex. `special-rule`). */
  readonly action: string;
  /** Slugs connus du moteur — un slug hors liste n'a pas d'effet en match. */
  readonly engineSlugs: ReadonlySet<string>;
  /** Colonnes de `Roster` qui référencent ces slugs (garde de suppression). */
  readonly rosterColumn: "specialRules" | "regionalRules";
}

const SPECIAL_RULES: CatalogueConfig = {
  model: "teamSpecialRule",
  entity: "TeamSpecialRule",
  action: "special-rule",
  engineSlugs: new Set(TEAM_SPECIAL_RULES.map((r) => r.slug)),
  rosterColumn: "specialRules",
};

const REGIONAL: CatalogueConfig = {
  model: "regionalLeague",
  entity: "RegionalLeague",
  action: "regional-league",
  engineSlugs: new Set(REGIONAL_LEAGUES.map((l) => l.slug)),
  rosterColumn: "regionalRules",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function modelOf(config: CatalogueConfig): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as unknown as Record<string, any>)[config.model];
}

async function audit(
  req: AuthenticatedRequest,
  config: CatalogueConfig,
  verb: string,
  id: string,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  await safeRecordAdminActionFromRequest(prisma, req, {
    action: `${config.action}.${verb}`,
    entity: config.entity,
    entityId: id,
    oldValue: before ?? null,
    newValue: after ?? null,
  });
}

function fail(res: Response, e: unknown, what: string): void {
  serverLog.error(`[admin-team-rules] ${what}`, e);
  res.status(500).json({ error: "Erreur serveur" });
}

/**
 * Combien de rosters référencent ce slug ? Le CSV/JSON de `Roster` n'est pas
 * requêtable finement : on charge les deux colonnes et on compte en mémoire
 * (quelques dizaines de lignes).
 */
async function rosterUsage(
  config: CatalogueConfig,
  slug: string,
  ruleset: Ruleset,
): Promise<number> {
  const rows = (await prisma.roster.findMany({
    where: { ruleset },
    select: { [config.rosterColumn]: true } as never,
  })) as Array<Record<string, unknown>>;
  if (!Array.isArray(rows)) return 0;
  return rows.filter((row) => {
    const raw = row[config.rosterColumn];
    if (typeof raw !== "string") return false;
    return raw.split(/[,\s[\]"]+/g).includes(slug);
  }).length;
}

function makeRouter(config: CatalogueConfig): Router {
  const router = Router();
  router.use(authUser, adminOnly);

  /** Liste complète (toutes éditions par défaut), triée par libellé FR. */
  router.get("/", validateQuery(listQuerySchema), async (req, res) => {
    try {
      const query = req.query as unknown as ListTeamRulesQuery;
      const rows = await modelOf(config).findMany({
        ...(query.ruleset ? { where: { ruleset: query.ruleset } } : {}),
        orderBy: [{ ruleset: "asc" }, { nameFr: "asc" }],
      });
      res.json({
        rules: (rows ?? []).map(
          (row: { slug: string } & Record<string, unknown>) => ({
            ...row,
            // Un slug inconnu du moteur reste un pur libellé : à signaler
            // dans l'UI plutôt qu'à laisser croire qu'il agit en match.
            knownToEngine: config.engineSlugs.has(row.slug),
          }),
        ),
      });
    } catch (e: unknown) {
      fail(res, e, `liste ${config.entity}`);
    }
  });

  router.post("/", validate(createSchema), async (req, res) => {
    const body: CreateTeamRuleInput = req.body;
    try {
      const existing = await modelOf(config).findUnique({
        where: { slug_ruleset: { slug: body.slug, ruleset: body.ruleset } },
        select: { id: true },
      });
      if (existing) {
        res.status(409).json({
          error: `Le slug « ${body.slug} » existe déjà pour cette édition`,
        });
        return;
      }
      const created = await modelOf(config).create({
        data: { ...body, descriptionEn: body.descriptionEn ?? null },
      });
      invalidateTeamRulesCatalogueCache();
      await audit(req as AuthenticatedRequest, config, "create", created.id, null, body);
      res.status(201).json({
        ...created,
        knownToEngine: config.engineSlugs.has(created.slug),
      });
    } catch (e: unknown) {
      fail(res, e, `création ${config.entity}`);
    }
  });

  router.put("/:id", validate(updateSchema), async (req, res) => {
    const body: UpdateTeamRuleInput = req.body;
    try {
      const before = await modelOf(config).findUnique({
        where: { id: req.params.id },
      });
      if (!before) {
        res.status(404).json({ error: "Introuvable" });
        return;
      }
      const updated = await modelOf(config).update({
        where: { id: req.params.id },
        data: { ...body, descriptionEn: body.descriptionEn ?? null },
      });
      invalidateTeamRulesCatalogueCache();
      await audit(req as AuthenticatedRequest, config, "update", updated.id, before, updated);
      res.json({
        ...updated,
        knownToEngine: config.engineSlugs.has(updated.slug),
      });
    } catch (e: unknown) {
      fail(res, e, `mise à jour ${config.entity}`);
    }
  });

  /**
   * Suppression refusée tant qu'un roster référence le slug : la ligne est ce
   * qui donne son LIBELLÉ à la règle, la retirer laisserait le slug brut à
   * l'écran (et, pour une Ligue, casserait le sélecteur de création).
   */
  router.delete("/:id", async (req, res) => {
    try {
      const before = await modelOf(config).findUnique({
        where: { id: req.params.id },
      });
      if (!before) {
        res.status(404).json({ error: "Introuvable" });
        return;
      }
      const used = await rosterUsage(config, before.slug, before.ruleset);
      if (used > 0) {
        res.status(409).json({
          error: `Référencée par ${used} roster(s) : retirez-la d'abord de leurs fiches.`,
          usage: { rosters: used },
        });
        return;
      }
      await modelOf(config).delete({ where: { id: req.params.id } });
      invalidateTeamRulesCatalogueCache();
      await audit(req as AuthenticatedRequest, config, "delete", before.id, before, null);
      res.json({ id: before.id, deleted: true });
    } catch (e: unknown) {
      fail(res, e, `suppression ${config.entity}`);
    }
  });

  /**
   * Réinitialisation depuis le catalogue du moteur — filet de sécurité après
   * une édition malheureuse, et amorçage d'une édition jamais seedée.
   */
  router.post("/reset", async (req, res) => {
    try {
      const result = await syncTeamRules({ write: true, force: true });
      await audit(req as AuthenticatedRequest, config, "reset", "*", null, result);
      res.json(result);
    } catch (e: unknown) {
      fail(res, e, `réinitialisation ${config.entity}`);
    }
  });

  return router;
}

export const adminSpecialRulesRouter = makeRouter(SPECIAL_RULES);
export const adminRegionalLeaguesRouter = makeRouter(REGIONAL);
