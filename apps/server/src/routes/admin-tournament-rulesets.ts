/**
 * Console admin — règlements de tournoi (« rules packs »).
 *
 * CRUD complet sur `TournamentRuleset`. Toute écriture passe par le parser
 * Zod : une définition invalide est refusée AVANT d'atteindre la base, avec
 * la liste des champs fautifs (`path` + `message`) que l'UI affiche en regard
 * des champs concernés.
 *
 * `POST /validate` fait la même validation SANS écrire : l'éditeur s'en sert
 * pour donner un retour immédiat, avec la même vérité que l'enregistrement.
 */

import { Router, type Response } from "express";
import { prisma } from "../prisma";
import { adminOnly } from "../middleware/adminOnly";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { z } from "zod";
import {
  parseDefinition,
  serializeDefinition,
  tournamentRulesetDefinitionSchema,
  type DefinitionIssue,
} from "../schemas/tournament-ruleset.schemas";
import {
  invalidateTournamentRulesetCache,
  listTournamentRulesets,
} from "../services/tournament-ruleset-repository";
import { syncTournamentRulesets } from "../seeders/sync-tournament-rulesets";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { serverLog } from "../utils/server-log";

const router = Router();
router.use(authUser, adminOnly);

/** Corps d'écriture : la définition brute + l'état d'activation. */
const writeBodySchema = z.object({
  /** Définition non validée ici : `parseDefinition` s'en charge (messages riches). */
  definition: z.unknown(),
  enabled: z.boolean().optional(),
});

const validateBodySchema = z.object({ definition: z.unknown() });

/** Réponse d'échec de validation, consommée telle quelle par l'éditeur. */
function invalid(res: Response, issues: readonly DefinitionIssue[]): void {
  res.status(400).json({ error: "Définition de règlement invalide", issues });
}

async function audit(
  req: AuthenticatedRequest,
  action: string,
  slug: string,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  await safeRecordAdminActionFromRequest(prisma, req, {
    action,
    entity: "TournamentRuleset",
    entityId: slug,
    oldValue: before ?? null,
    newValue: after ?? null,
  });
}

/**
 * Liste complète (désactivés compris) avec l'origine de chaque définition :
 * `db` = éditée en base, `engine` = encore servie par le registre du moteur
 * (ligne pas encore créée). L'UI le signale pour éviter la surprise
 * « j'édite mais rien ne change ».
 */
router.get("/", async (_req, res) => {
  try {
    const resolved = await listTournamentRulesets({ includeDisabled: true });
    res.json({
      rulesets: resolved.map((r) => ({
        slug: r.slug,
        enabled: r.enabled,
        source: r.source,
        nameFr: r.definition.nameFr,
        shortLabel: r.definition.shortLabel,
        version: r.definition.version,
        edition: r.definition.edition,
        format: r.definition.format,
        rosterCount: Object.keys(r.definition.rosterRules).length,
      })),
    });
  } catch (e: unknown) {
    serverLog.error("[admin-tournament-rulesets] liste", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/** Détail : la définition complète, prête pour l'éditeur. */
router.get("/:slug", async (req, res) => {
  try {
    const resolved = await listTournamentRulesets({ includeDisabled: true });
    const found = resolved.find((r) => r.slug === req.params.slug);
    if (!found) {
      res.status(404).json({ error: "Règlement introuvable" });
      return;
    }
    res.json({
      slug: found.slug,
      enabled: found.enabled,
      source: found.source,
      // Sérialisée : c'est la forme éditable (Infinity → null).
      definition: serializeDefinition(found.definition),
    });
  } catch (e: unknown) {
    serverLog.error("[admin-tournament-rulesets] détail", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/** Validation à blanc : même vérité que l'enregistrement, sans écrire. */
router.post("/validate", validate(validateBodySchema), async (req, res) => {
  const parsed = parseDefinition(req.body.definition);
  if (!parsed.ok) {
    invalid(res, parsed.issues);
    return;
  }
  res.json({ valid: true, slug: parsed.definition.slug });
});

/** Création. Le slug vient de la définition et doit être libre. */
router.post("/", validate(writeBodySchema), async (req, res) => {
  const parsed = parseDefinition(req.body.definition);
  if (!parsed.ok) {
    invalid(res, parsed.issues);
    return;
  }
  const slug = parsed.definition.slug;
  try {
    const existing = await prisma.tournamentRuleset.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) {
      res.status(409).json({ error: `Le slug « ${slug} » est déjà utilisé` });
      return;
    }
    const created = await prisma.tournamentRuleset.create({
      data: {
        slug,
        enabled: req.body.enabled ?? true,
        definition: serializeDefinition(parsed.definition) as unknown as object,
      },
    });
    invalidateTournamentRulesetCache();
    await audit(req as AuthenticatedRequest, "tournament-ruleset.create", slug, null, { slug });
    res.status(201).json({ slug: created.slug, enabled: created.enabled });
  } catch (e: unknown) {
    serverLog.error("[admin-tournament-rulesets] création", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * Mise à jour. Le slug de l'URL fait foi : renommer un règlement casserait
 * les équipes et compétitions qui le référencent, on l'interdit.
 */
router.put("/:slug", validate(writeBodySchema), async (req, res) => {
  const slug = req.params.slug;
  const parsed = parseDefinition(req.body.definition);
  if (!parsed.ok) {
    invalid(res, parsed.issues);
    return;
  }
  if (parsed.definition.slug !== slug) {
    res.status(400).json({
      error:
        "Le slug d'un règlement ne peut pas changer : il est référencé par les équipes et compétitions déjà créées",
      issues: [{ path: "slug", message: `Attendu « ${slug} »` }],
    });
    return;
  }
  try {
    const before = await prisma.tournamentRuleset.findUnique({
      where: { slug },
      select: { enabled: true },
    });
    if (!before) {
      // Règlement encore servi par le registre du moteur : première édition
      // ⇒ on matérialise la ligne au lieu de renvoyer 404.
      await prisma.tournamentRuleset.create({
        data: {
          slug,
          enabled: req.body.enabled ?? true,
          definition: serializeDefinition(parsed.definition) as unknown as object,
        },
      });
    } else {
      await prisma.tournamentRuleset.update({
        where: { slug },
        data: {
          ...(req.body.enabled === undefined ? {} : { enabled: req.body.enabled }),
          definition: serializeDefinition(parsed.definition) as unknown as object,
        },
      });
    }
    invalidateTournamentRulesetCache();
    await audit(req as AuthenticatedRequest, "tournament-ruleset.update", slug, before, {
      slug,
      enabled: req.body.enabled,
    });
    res.json({ slug, enabled: req.body.enabled ?? before?.enabled ?? true });
  } catch (e: unknown) {
    serverLog.error("[admin-tournament-rulesets] mise à jour", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * Réinitialisation depuis le registre du moteur — filet de sécurité après une
 * édition malheureuse sur un pack officiel.
 */
router.post("/:slug/reset", async (req, res) => {
  const slug = req.params.slug;
  try {
    const result = await syncTournamentRulesets({ write: true, force: true, slug });
    if (result.created.length === 0 && result.updated.length === 0) {
      res.status(404).json({
        error: "Ce règlement n'existe pas dans le registre du moteur",
      });
      return;
    }
    await audit(req as AuthenticatedRequest, "tournament-ruleset.reset", slug);
    res.json({ slug, reset: true });
  } catch (e: unknown) {
    serverLog.error("[admin-tournament-rulesets] réinitialisation", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * Suppression. Refusée tant qu'une équipe ou une compétition référence le
 * slug : la désactivation (`enabled: false`) est la bonne sortie pour retirer
 * un règlement des listes sans casser l'existant.
 */
router.delete("/:slug", async (req, res) => {
  const slug = req.params.slug;
  try {
    const [teams, leagues, cups] = await Promise.all([
      prisma.team.count({ where: { tournamentRuleset: slug } }),
      prisma.league.count({ where: { tournamentRuleset: slug } }),
      prisma.cup.count({ where: { tournamentRuleset: slug } }),
    ]);
    const used = teams + leagues + cups;
    if (used > 0) {
      res.status(409).json({
        error:
          `Règlement utilisé par ${teams} équipe(s), ${leagues} ligue(s) et ${cups} coupe(s). ` +
          "Désactivez-le plutôt que de le supprimer.",
        usage: { teams, leagues, cups },
      });
      return;
    }
    const existing = await prisma.tournamentRuleset.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Règlement introuvable" });
      return;
    }
    await prisma.tournamentRuleset.delete({ where: { slug } });
    invalidateTournamentRulesetCache();
    await audit(req as AuthenticatedRequest, "tournament-ruleset.delete", slug, { slug });
    res.json({ slug, deleted: true });
  } catch (e: unknown) {
    serverLog.error("[admin-tournament-rulesets] suppression", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
