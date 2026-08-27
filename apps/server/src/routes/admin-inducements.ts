/**
 * Console admin — catalogue des Coups de Pouce (lot 6.1).
 *
 * CRUD sur `Inducement`. Toute écriture invalide le cache du repository pour
 * que la correction s'applique au match suivant sans redéploiement.
 *
 * Deux garde-fous portés par l'API :
 *  - le SLUG est un contrat de code (le moteur câble le comportement par
 *    slug) : il se fixe à la création et ne se renomme pas ; la réponse
 *    expose `wired` pour que la console dise clairement qu'un slug inconnu
 *    n'a AUCUN effet en match (libellé + prix seulement) ;
 *  - la suppression est refusée au profit de `enabled: false` : les feuilles
 *    de match déjà validées référencent le slug, on ne réécrit pas
 *    l'historique.
 */

import { Router, type Response } from "express";
import { z } from "zod";
import { isWiredInducementSlug, RULESETS, type Ruleset } from "@bb/game-engine";
import { prisma } from "../prisma";
import { adminOnly } from "../middleware/adminOnly";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate, validateQuery } from "../middleware/validate";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { invalidateInducementCache } from "../services/inducement-repository";
import { syncInducements } from "../seeders/sync-inducements";
import { serverLog } from "../utils/server-log";

const router = Router();
router.use(authUser, adminOnly);

const rulesetSchema = z.enum(RULESETS as unknown as [Ruleset, ...Ruleset[]]);

const listQuerySchema = z.object({ ruleset: rulesetSchema.optional() });
export type ListInducementsQuery = z.infer<typeof listQuerySchema>;

/**
 * Bornes volontairement larges (une ligue maison peut vouloir un coup de
 * pouce à 500 000 po) mais FERMÉES : un coût négatif offrirait de l'argent au
 * coach, un plafond nul ferait disparaître la ligne du panier sans le dire.
 */
const bodySchema = z.object({
  nameFr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  descriptionFr: z.string().trim().min(1).max(4000),
  descriptionEn: z.string().trim().max(4000).nullable().optional(),
  baseCost: z.number().int().min(0).max(2_000_000),
  maxQuantity: z.number().int().min(1).max(16),
  discountRule: z.string().trim().max(64).nullable().optional(),
  discountRoster: z.string().trim().max(64).nullable().optional(),
  discountCost: z.number().int().min(0).max(2_000_000).nullable().optional(),
  ruleMaxRule: z.string().trim().max(64).nullable().optional(),
  ruleMaxQuantity: z.number().int().min(1).max(16).nullable().optional(),
  /** CSV de slugs de règles spéciales / Ligues : au moins une requise. */
  requiresAnyRule: z.string().trim().max(256).nullable().optional(),
  requiresRoster: z.string().trim().max(64).nullable().optional(),
  requiresApothecary: z.boolean().optional(),
  variableCost: z.boolean().optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});
export type InducementBody = z.infer<typeof bodySchema>;

const createSchema = bodySchema.extend({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "Slug attendu en minuscules, chiffres et « _ »"),
  ruleset: rulesetSchema,
});
export type CreateInducementInput = z.infer<typeof createSchema>;

function fail(res: Response, e: unknown, what: string): void {
  serverLog.error(`[admin-inducements] ${what}`, e);
  res.status(500).json({ error: "Erreur serveur" });
}

async function audit(
  req: AuthenticatedRequest,
  verb: string,
  id: string,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  await safeRecordAdminActionFromRequest(prisma, req, {
    action: `inducement.${verb}`,
    entity: "Inducement",
    entityId: id,
    oldValue: before ?? null,
    newValue: after ?? null,
  });
}

/** Colonnes nullables : `undefined` (champ absent) ⇒ on écrit `null`. */
function normalizeBody(body: InducementBody): Record<string, unknown> {
  return {
    nameFr: body.nameFr,
    nameEn: body.nameEn,
    descriptionFr: body.descriptionFr,
    descriptionEn: body.descriptionEn ?? null,
    baseCost: body.baseCost,
    maxQuantity: body.maxQuantity,
    discountRule: body.discountRule ?? null,
    discountRoster: body.discountRoster ?? null,
    discountCost: body.discountCost ?? null,
    ruleMaxRule: body.ruleMaxRule ?? null,
    ruleMaxQuantity: body.ruleMaxQuantity ?? null,
    requiresAnyRule: body.requiresAnyRule ?? null,
    requiresRoster: body.requiresRoster ?? null,
    requiresApothecary: body.requiresApothecary ?? false,
    variableCost: body.variableCost ?? false,
    ...(body.enabled === undefined ? {} : { enabled: body.enabled }),
    ...(body.sortOrder === undefined ? {} : { sortOrder: body.sortOrder }),
  };
}

/** Liste complète (désactivés compris) — l'admin doit voir ce qu'il a retiré. */
router.get("/", validateQuery(listQuerySchema), async (req, res) => {
  try {
    const query = req.query as unknown as ListInducementsQuery;
    const rows = await prisma.inducement.findMany({
      ...(query.ruleset ? { where: { ruleset: query.ruleset } } : {}),
      orderBy: [{ ruleset: "asc" }, { sortOrder: "asc" }, { nameFr: "asc" }],
    });
    res.json({
      inducements: (rows ?? []).map((row: { slug: string }) => ({
        ...row,
        // `false` = le moteur ne sait rien faire de ce slug : la ligne se
        // paie et s'affiche, mais reste sans effet en match.
        wired: isWiredInducementSlug(row.slug),
      })),
    });
  } catch (e: unknown) {
    fail(res, e, "liste");
  }
});

router.post("/", validate(createSchema), async (req, res) => {
  const body: CreateInducementInput = req.body;
  try {
    const existing = await prisma.inducement.findUnique({
      where: { slug_ruleset: { slug: body.slug, ruleset: body.ruleset } },
      select: { id: true },
    });
    if (existing) {
      res.status(409).json({
        error: `Le slug « ${body.slug} » existe déjà pour cette édition`,
      });
      return;
    }
    const created = await prisma.inducement.create({
      data: {
        slug: body.slug,
        ruleset: body.ruleset,
        ...normalizeBody(body),
      } as never,
    });
    invalidateInducementCache();
    await audit(req as AuthenticatedRequest, "create", created.id, null, body);
    res.status(201).json({ ...created, wired: isWiredInducementSlug(body.slug) });
  } catch (e: unknown) {
    fail(res, e, "création");
  }
});

/** Le slug et l'édition ne changent pas : ils sont référencés par les feuilles. */
router.put("/:id", validate(bodySchema), async (req, res) => {
  try {
    const before = await prisma.inducement.findUnique({
      where: { id: req.params.id },
    });
    if (!before) {
      res.status(404).json({ error: "Coup de pouce introuvable" });
      return;
    }
    const updated = await prisma.inducement.update({
      where: { id: req.params.id },
      data: normalizeBody(req.body) as never,
    });
    invalidateInducementCache();
    await audit(req as AuthenticatedRequest, "update", updated.id, before, updated);
    res.json({ ...updated, wired: isWiredInducementSlug(updated.slug) });
  } catch (e: unknown) {
    fail(res, e, "mise à jour");
  }
});

/**
 * Réinitialisation depuis le catalogue du moteur — filet de sécurité, et
 * amorçage d'une édition jamais seedée.
 */
router.post("/reset", async (req, res) => {
  try {
    const result = await syncInducements({ write: true, force: true });
    invalidateInducementCache();
    await audit(req as AuthenticatedRequest, "reset", "*", null, result);
    res.json(result);
  } catch (e: unknown) {
    fail(res, e, "réinitialisation");
  }
});

export default router;
