/**
 * Routes d'administration pour gérer les données statiques en base de données
 * - Skills (compétences)
 * - Rosters (équipes)
 * - Positions
 * - Star Players
 */

import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { adminOnly } from "../middleware/adminOnly";
import { authUser } from "../middleware/authUser";
import { resolveRuleset, type Ruleset } from "../utils/ruleset-helpers";
import { toCanonicalAccessCsv } from "../services/skill-access";
import { revalidateRosterPages } from "../services/revalidate-web";
import { validate, validateQuery } from "../middleware/validate";

/**
 * Normalise une saisie d'accès admin pour le stockage Position :
 *   - `undefined` -> `undefined` (Prisma : champ ignoré, pas d'écrasement)
 *   - `null`      -> `null` (accès non géré)
 *   - string      -> CSV canonique ordonnée (F→S, dédup), `""` autorisé.
 */
function normalizeAccessInput(
  v: string | null | undefined,
): string | null | undefined {
  if (v === undefined || v === null) return v;
  // Vide après normalisation -> null (accès non géré) plutot que "" : evite
  // qu'un edit admin laissant les cases vides force un pool vide (et active la
  // validation) sur une position jusque-la non gérée (ex: season_2).
  const csv = toCanonicalAccessCsv(v);
  return csv === "" ? null : csv;
}
import {
  adminSkillsQuerySchema,
  adminRostersQuerySchema,
  adminPositionsQuerySchema,
  adminStarPlayersQuerySchema,
  createSkillSchema,
  updateSkillSchema,
  duplicateToRulesetSchema,
  createRosterSchema,
  updateRosterSchema,
  createPositionSchema,
  updatePositionSchema,
  duplicatePositionSchema,
  createStarPlayerDataSchema,
  updateStarPlayerDataSchema,
} from "../schemas/admin-data.schemas";
import { serverLog } from "../utils/server-log";
import {
  safeRecordAdminActionFromRequest,
  type RecordAdminActionInput,
} from "../services/audit-log";
import type { AuthenticatedRequest } from "../middleware/authUser";

const router = Router();

router.use(authUser, adminOnly);

/**
 * S27.6.4 — Wrapper local autour de `safeRecordAdminActionFromRequest`
 * pour reduire le boilerplate sur chaque route admin/data. Les erreurs
 * d'audit sont swallowees (le log reste cote ops via serverLog).
 */
async function safeAudit(
  req: AuthenticatedRequest,
  partial: Omit<RecordAdminActionInput, "userId" | "ipAddress" | "userAgent">,
): Promise<void> {
  await safeRecordAdminActionFromRequest(prisma, req, partial);
}

/**
 * Erreur levee quand un slug de competence n'existe pas pour le ruleset cible.
 * Mappee en HTTP 400 par les handlers (cf. `instanceof` dans les catch).
 */
class SkillResolutionError extends Error {
  constructor(public readonly missingSlugs: readonly string[]) {
    super(`Compétences introuvables pour ce ruleset : ${missingSlugs.join(", ")}`);
    this.name = "SkillResolutionError";
  }
}

/**
 * Resout une liste de slugs de competences en IDs `Skill`.
 *
 * `Skill` porte une contrainte `@@unique([slug, ruleset])` : un meme slug
 * (ex: "bone-head") existe pour plusieurs rulesets. Un `connect: { slug }`
 * est donc ambigu et rejete par Prisma ("needs at least one of id or
 * slug_ruleset"). On resout les IDs dans le ruleset du roster et on connecte
 * par `id`. La resolution se fait AVANT toute operation destructive pour
 * eviter de vider les relations en cas de slug invalide.
 */
async function resolveSkillIdsForRuleset(
  skillSlugs: readonly string[] | undefined | null,
  ruleset: Ruleset,
): Promise<string[]> {
  if (!skillSlugs || skillSlugs.length === 0) return [];
  const uniqueSlugs = Array.from(new Set(skillSlugs));
  const skills = await prisma.skill.findMany({
    where: { slug: { in: uniqueSlugs }, ruleset },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(skills.map((s: { id: string; slug: string }) => [s.slug, s.id]));
  const missing = uniqueSlugs.filter((slug) => !idBySlug.has(slug));
  if (missing.length > 0) {
    throw new SkillResolutionError(missing);
  }
  return uniqueSlugs.map((slug) => idBySlug.get(slug) as string);
}

// =============================================================================
// SKILLS (Compétences)
// =============================================================================

router.get("/skills", validateQuery(adminSkillsQuerySchema), async (req, res) => {
  try {
    const { category, search, ruleset } = req.query;
    const where: any = {};
    
    if (category) {
      where.category = category;
    }

    if (ruleset && ruleset !== "all") {
      where.ruleset = resolveRuleset(ruleset as string);
    }
    
    if (search) {
      where.OR = [
        { slug: { contains: search as string, mode: "insensitive" } },
        { nameFr: { contains: search as string, mode: "insensitive" } },
        { nameEn: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const skills = await prisma.skill.findMany({
      where,
      orderBy: [{ ruleset: "asc" }, { category: "asc" }, { nameFr: "asc" }],
    });
    res.json({ skills });
  } catch (error: any) {
    serverLog.error("Erreur lors de la récupération des compétences:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.get("/skills/:id", async (req, res) => {
  try {
    const skill = await prisma.skill.findUnique({
      where: { id: req.params.id },
      include: {
        positionSkills: {
          include: { position: { include: { roster: true } } },
        },
        starPlayerSkills: {
          include: { starPlayer: true },
        },
      },
    });
    if (!skill) {
      return res.status(404).json({ error: "Compétence non trouvée" });
    }
    res.json({ skill });
  } catch (error: any) {
    serverLog.error("Erreur lors de la récupération de la compétence:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.post("/skills", validate(createSkillSchema), async (req, res) => {
  try {
    const { slug, nameFr, nameEn, description, descriptionEn, category, ruleset: rawRuleset } = req.body;

    const ruleset = resolveRuleset(rawRuleset);

    const skill = await prisma.skill.create({
      data: { slug, ruleset, nameFr, nameEn, description, descriptionEn: descriptionEn || null, category },
    });
    await safeAudit(req, {
      action: "skill.create",
      entity: "Skill",
      entityId: skill.id,
      newValue: { slug: skill.slug, ruleset: skill.ruleset, category: skill.category },
    });
    res.status(201).json({ skill });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Cette compétence existe déjà pour ce ruleset" });
    }
    serverLog.error("Erreur lors de la création de la compétence:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.put("/skills/:id", validate(updateSkillSchema), async (req, res) => {
  try {
    const { nameFr, nameEn, description, descriptionEn, category, ruleset: rawRuleset, isElite, isPassive, isModified } = req.body;

    const data: any = {
      nameFr,
      nameEn,
      description,
      descriptionEn: descriptionEn || null,
      category
    };

    if (rawRuleset) {
      data.ruleset = resolveRuleset(rawRuleset);
    }

    // Gestion des booléens (isElite, isPassive, isModified)
    if (typeof isElite === "boolean") {
      data.isElite = isElite;
    }
    if (typeof isPassive === "boolean") {
      data.isPassive = isPassive;
    }
    if (typeof isModified === "boolean") {
      data.isModified = isModified;
    }

    const previous = await prisma.skill.findUnique({
      where: { id: req.params.id },
      select: {
        slug: true,
        ruleset: true,
        nameFr: true,
        nameEn: true,
        category: true,
        isElite: true,
        isPassive: true,
        isModified: true,
      },
    });

    const skill = await prisma.skill.update({
      where: { id: req.params.id },
      data,
    });
    await safeAudit(req, {
      action: "skill.update",
      entity: "Skill",
      entityId: skill.id,
      oldValue: previous,
      newValue: {
        slug: skill.slug,
        ruleset: skill.ruleset,
        nameFr: skill.nameFr,
        nameEn: skill.nameEn,
        category: skill.category,
        isElite: skill.isElite,
        isPassive: skill.isPassive,
        isModified: skill.isModified,
      },
    });
    res.json({ skill });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Compétence non trouvée" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Ce slug existe déjà pour ce ruleset" });
    }
    serverLog.error("Erreur lors de la mise à jour de la compétence:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.post("/skills/:id/duplicate", validate(duplicateToRulesetSchema), async (req, res) => {
  try {
    const sourceSkill = await prisma.skill.findUnique({
      where: { id: req.params.id },
    });

    if (!sourceSkill) {
      return res.status(404).json({ error: "Compétence source non trouvée" });
    }

    const { targetRuleset } = req.body;
    const newRuleset = resolveRuleset(targetRuleset);

    // Vérifier si la compétence existe déjà pour ce ruleset
    const existing = await prisma.skill.findFirst({
      where: {
        slug: sourceSkill.slug,
        ruleset: newRuleset,
      },
    });

    if (existing) {
      return res.status(409).json({ 
        error: `La compétence "${sourceSkill.slug}" existe déjà pour le ruleset ${newRuleset}` 
      });
    }

    // Dupliquer la compétence
    const newSkill = await prisma.skill.create({
      data: {
        slug: sourceSkill.slug,
        ruleset: newRuleset,
        nameFr: sourceSkill.nameFr,
        nameEn: sourceSkill.nameEn,
        description: sourceSkill.description,
        descriptionEn: sourceSkill.descriptionEn,
        category: sourceSkill.category,
        isElite: sourceSkill.isElite,
        isPassive: sourceSkill.isPassive,
        isModified: sourceSkill.isModified,
      },
    });

    await safeAudit(req, {
      action: "skill.duplicate",
      entity: "Skill",
      entityId: newSkill.id,
      oldValue: { sourceId: sourceSkill.id, sourceRuleset: sourceSkill.ruleset, slug: sourceSkill.slug },
      newValue: { slug: newSkill.slug, ruleset: newSkill.ruleset, category: newSkill.category },
    });

    res.status(201).json({
      skill: newSkill,
      message: `Compétence dupliquée avec succès vers ${newRuleset}`,
    });
  } catch (error: any) {
    serverLog.error("Erreur lors de la duplication de la compétence:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.delete("/skills/:id", async (req, res) => {
  try {
    const previous = await prisma.skill.findUnique({
      where: { id: req.params.id },
      select: { id: true, slug: true, ruleset: true, category: true, nameFr: true },
    });
    await prisma.skill.delete({
      where: { id: req.params.id },
    });
    await safeAudit(req, {
      action: "skill.delete",
      entity: "Skill",
      entityId: req.params.id,
      oldValue: previous,
    });
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Compétence non trouvée" });
    }
    serverLog.error("Erreur lors de la suppression de la compétence:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

// =============================================================================
// ROSTERS (Équipes)
// =============================================================================

router.get("/rosters", validateQuery(adminRostersQuerySchema), async (req, res) => {
  try {
    const { ruleset } = req.query;
    const where: any = {};

    if (ruleset && ruleset !== "all") {
      where.ruleset = resolveRuleset(ruleset as string);
    }

    const rosters = await prisma.roster.findMany({
      where,
      select: {
        id: true,
        slug: true,
        ruleset: true,
        name: true,
        nameEn: true,
        descriptionFr: true,
        descriptionEn: true,
        budget: true,
        tier: true,
        regionalRules: true,
        specialRules: true,
        naf: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { positions: true },
        },
      },
      orderBy: [
        { slug: "asc" },
        { ruleset: "asc" },
        { name: "asc" },
      ],
    });
    // Parse regionalRules JSON string to array for each roster
    const rostersWithParsedRules = rosters.map((roster: any) => ({
      ...roster,
      regionalRules: roster.regionalRules ? JSON.parse(roster.regionalRules) : null,
    }));
    res.json({ rosters: rostersWithParsedRules });
  } catch (error: any) {
    serverLog.error("Erreur lors de la récupération des rosters:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.get("/rosters/:id", async (req, res) => {
  try {
    const roster = await prisma.roster.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        slug: true,
        ruleset: true,
        name: true,
        nameEn: true,
        descriptionFr: true,
        descriptionEn: true,
        budget: true,
        tier: true,
        regionalRules: true,
        specialRules: true,
        naf: true,
        createdAt: true,
        updatedAt: true,
        positions: {
          include: {
            skills: {
              include: { skill: true },
            },
          },
          orderBy: { displayName: "asc" },
        },
      },
    });
    if (!roster) {
      return res.status(404).json({ error: "Roster non trouvé" });
    }
    // Parse regionalRules JSON string to array
    const rosterWithParsedRules = {
      ...roster,
      regionalRules: roster.regionalRules ? JSON.parse(roster.regionalRules) : null,
    };
    res.json({ roster: rosterWithParsedRules });
  } catch (error: any) {
    serverLog.error("Erreur lors de la récupération du roster:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.post("/rosters", validate(createRosterSchema), async (req, res) => {
  try {
    const {
      slug,
      name,
      nameEn,
      descriptionFr,
      descriptionEn,
      budget,
      tier,
      regionalRules,
      specialRules,
      naf,
      ruleset: rawRuleset,
    } = req.body;

    const ruleset = resolveRuleset(rawRuleset);
    const regionalRulesJson = regionalRules ? JSON.stringify(regionalRules) : null;

    const roster = await prisma.roster.create({
      data: {
        slug,
        ruleset,
        name,
        nameEn,
        descriptionFr: descriptionFr || null,
        descriptionEn: descriptionEn || null,
        budget,
        tier,
        regionalRules: regionalRulesJson,
        specialRules: specialRules || null,
        naf: naf || false
      },
    });
    await safeAudit(req, {
      action: "roster.create",
      entity: "Roster",
      entityId: roster.id,
      newValue: { slug: roster.slug, ruleset: roster.ruleset, name: roster.name, tier: roster.tier },
    });
    void revalidateRosterPages([roster.slug]);
    res.status(201).json({ roster });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Ce roster existe déjà pour ce ruleset" });
    }
    serverLog.error("Erreur lors de la création du roster:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.put("/rosters/:id", validate(updateRosterSchema), async (req, res) => {
  try {
    const {
      name,
      nameEn,
      descriptionFr,
      descriptionEn,
      budget,
      tier,
      regionalRules,
      specialRules,
      naf,
      ruleset: rawRuleset,
    } = req.body;
    
    const regionalRulesJson = regionalRules ? JSON.stringify(regionalRules) : null;
    const data: any = {
      name, 
      nameEn, 
      descriptionFr: descriptionFr || null,
      descriptionEn: descriptionEn || null,
      budget, 
      tier, 
      regionalRules: regionalRulesJson,
      specialRules: specialRules || null,
      naf,
    };

    if (rawRuleset) {
      data.ruleset = resolveRuleset(rawRuleset);
    }

    const previous = await prisma.roster.findUnique({
      where: { id: req.params.id },
      select: {
        slug: true,
        ruleset: true,
        name: true,
        nameEn: true,
        budget: true,
        tier: true,
        naf: true,
      },
    });

    const roster = await prisma.roster.update({
      where: { id: req.params.id },
      data,
    });
    await safeAudit(req, {
      action: "roster.update",
      entity: "Roster",
      entityId: roster.id,
      oldValue: previous,
      newValue: {
        slug: roster.slug,
        ruleset: roster.ruleset,
        name: roster.name,
        nameEn: roster.nameEn,
        budget: roster.budget,
        tier: roster.tier,
        naf: roster.naf,
      },
    });
    void revalidateRosterPages([roster.slug]);
    res.json({ roster });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Roster non trouvé" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Slug déjà utilisé pour ce ruleset" });
    }
    serverLog.error("Erreur lors de la mise à jour du roster:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.post("/rosters/:id/duplicate", validate(duplicateToRulesetSchema), async (req, res) => {
  try {
    const sourceRoster = await prisma.roster.findUnique({
      where: { id: req.params.id },
      include: {
        positions: {
          include: {
            skills: {
              include: { skill: true },
            },
          },
        },
      },
    });

    if (!sourceRoster) {
      return res.status(404).json({ error: "Roster source non trouvé" });
    }

    const { targetRuleset } = req.body;
    const newRuleset = resolveRuleset(targetRuleset);

    // Vérifier si le roster existe déjà pour ce ruleset
    const existing = await prisma.roster.findFirst({
      where: {
        slug: sourceRoster.slug,
        ruleset: newRuleset,
      },
    });

    if (existing) {
      return res.status(409).json({ 
        error: `Le roster "${sourceRoster.slug}" existe déjà pour le ruleset ${newRuleset}` 
      });
    }

    // Dupliquer le roster
    const newRoster = await prisma.roster.create({
      data: {
        slug: sourceRoster.slug,
        ruleset: newRuleset,
        name: sourceRoster.name,
        nameEn: sourceRoster.nameEn,
        descriptionFr: sourceRoster.descriptionFr,
        descriptionEn: sourceRoster.descriptionEn,
        budget: sourceRoster.budget,
        tier: sourceRoster.tier,
        regionalRules: sourceRoster.regionalRules,
        specialRules: sourceRoster.specialRules,
        naf: sourceRoster.naf,
      },
    });

    // Dupliquer les positions
    for (const position of sourceRoster.positions) {
      const newPosition = await prisma.position.create({
        data: {
          rosterId: newRoster.id,
          slug: position.slug,
          displayName: position.displayName,
          cost: position.cost,
          min: position.min,
          max: position.max,
          ma: position.ma,
          st: position.st,
          ag: position.ag,
          pa: position.pa,
          av: position.av,
          keywords: position.keywords,
        },
      });

      // Dupliquer les skills de la position
      for (const positionSkill of position.skills) {
        await prisma.positionSkill.create({
          data: {
            positionId: newPosition.id,
            skillId: positionSkill.skillId,
          },
        });
      }
    }

    await safeAudit(req, {
      action: "roster.duplicate",
      entity: "Roster",
      entityId: newRoster.id,
      oldValue: { sourceId: sourceRoster.id, sourceRuleset: sourceRoster.ruleset, slug: sourceRoster.slug },
      newValue: { slug: newRoster.slug, ruleset: newRoster.ruleset, positionCount: sourceRoster.positions.length },
    });

    void revalidateRosterPages([newRoster.slug]);
    res.status(201).json({
      roster: newRoster,
      message: `Roster dupliqué avec succès vers ${newRuleset}`,
    });
  } catch (error: any) {
    serverLog.error("Erreur lors de la duplication du roster:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.delete("/rosters/:id", async (req, res) => {
  try {
    const previous = await prisma.roster.findUnique({
      where: { id: req.params.id },
      select: { id: true, slug: true, ruleset: true, name: true, tier: true },
    });
    await prisma.roster.delete({
      where: { id: req.params.id },
    });
    await safeAudit(req, {
      action: "roster.delete",
      entity: "Roster",
      entityId: req.params.id,
      oldValue: previous,
    });
    void revalidateRosterPages(previous?.slug ? [previous.slug] : undefined);
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Roster non trouvé" });
    }
    serverLog.error("Erreur lors de la suppression du roster:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

// =============================================================================
// POSITIONS
// =============================================================================

router.get("/positions", validateQuery(adminPositionsQuerySchema), async (req, res) => {
  try {
    const { rosterId, ruleset } = req.query;
    const where: any = {};
    
    if (rosterId) {
      where.rosterId = rosterId;
    }
    if (ruleset && ruleset !== "all") {
      where.roster = {
        ...(where.roster || {}),
        ruleset: resolveRuleset(ruleset as string),
      };
    }

    const positions = await prisma.position.findMany({
      where,
      include: {
        roster: {
          select: {
            id: true,
            slug: true,
            name: true,
            nameEn: true,
            ruleset: true,
          },
        },
        skills: {
          include: { skill: true },
        },
      },
      orderBy: [{ roster: { slug: "asc" } }, { displayName: "asc" }],
    });
    res.json({ positions });
  } catch (error: any) {
    serverLog.error("Erreur lors de la récupération des positions:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.get("/positions/:id", async (req, res) => {
  try {
    const position = await prisma.position.findUnique({
      where: { id: req.params.id },
      include: {
        roster: {
          select: {
            id: true,
            slug: true,
            name: true,
            nameEn: true,
            ruleset: true,
          },
        },
        skills: {
          include: { skill: true },
        },
      },
    });
    if (!position) {
      return res.status(404).json({ error: "Position non trouvée" });
    }
    res.json({ position });
  } catch (error: any) {
    serverLog.error("Erreur lors de la récupération de la position:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.post("/positions", validate(createPositionSchema), async (req, res) => {
  try {
    const { rosterId, slug, displayName, cost, min, max, ma, st, ag, pa, av, keywords, primarySkills, secondarySkills, skillSlugs } = req.body;

    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      select: { ruleset: true },
    });
    if (!roster) {
      return res.status(404).json({ error: "Roster non trouvé" });
    }

    // Resout les slugs en IDs dans le ruleset du roster (slug seul est ambigu)
    const skillIds = await resolveSkillIdsForRuleset(skillSlugs, roster.ruleset);

    const position = await prisma.position.create({
      data: {
        rosterId,
        slug,
        displayName,
        cost,
        min,
        max,
        ma,
        st,
        ag,
        pa,
        av,
        keywords: keywords || null,
        primarySkills: normalizeAccessInput(primarySkills),
        secondarySkills: normalizeAccessInput(secondarySkills),
        skills: {
          create: skillIds.map((skillId) => ({
            skill: {
              connect: { id: skillId },
            },
          })),
        },
      },
      include: {
        skills: {
          include: { skill: true },
        },
      },
    });
    await safeAudit(req, {
      action: "position.create",
      entity: "Position",
      entityId: position.id,
      newValue: {
        rosterId: position.rosterId,
        slug: position.slug,
        displayName: position.displayName,
        cost: position.cost,
        skillCount: position.skills.length,
      },
    });
    res.status(201).json({ position });
  } catch (error: any) {
    if (error instanceof SkillResolutionError) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Cette position existe déjà pour ce roster" });
    }
    serverLog.error("Erreur lors de la création de la position:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.put("/positions/:id", validate(updatePositionSchema), async (req, res) => {
  try {
    const { displayName, cost, min, max, ma, st, ag, pa, av, keywords, primarySkills, secondarySkills, skillSlugs } = req.body;

    const previous = await prisma.position.findUnique({
      where: { id: req.params.id },
      select: {
        slug: true,
        displayName: true,
        cost: true,
        min: true,
        max: true,
        ma: true,
        st: true,
        ag: true,
        pa: true,
        av: true,
        roster: { select: { ruleset: true } },
      },
    });

    if (!previous) {
      return res.status(404).json({ error: "Position non trouvée" });
    }

    // Resout les slugs en IDs AVANT toute operation destructive : si un slug
    // est invalide, on echoue ici sans avoir vide les relations existantes.
    const skillIds = await resolveSkillIdsForRuleset(skillSlugs, previous.roster.ruleset);
    const { roster: _previousRoster, ...previousScalars } = previous;

    // Suppression + recreation des relations dans une transaction atomique :
    // une erreur sur l'update rollback le deleteMany (plus de vidage partiel).
    const position = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.positionSkill.deleteMany({
        where: { positionId: req.params.id },
      });
      return tx.position.update({
        where: { id: req.params.id },
        data: {
          displayName,
          cost,
          min,
          max,
          ma,
          st,
          ag,
          pa,
          av,
          keywords: keywords || null,
          primarySkills: normalizeAccessInput(primarySkills),
          secondarySkills: normalizeAccessInput(secondarySkills),
          skills: {
            create: skillIds.map((skillId) => ({
              skill: {
                connect: { id: skillId },
              },
            })),
          },
        },
        include: {
          skills: {
            include: { skill: true },
          },
        },
      });
    });
    await safeAudit(req, {
      action: "position.update",
      entity: "Position",
      entityId: position.id,
      oldValue: previousScalars,
      newValue: {
        slug: position.slug,
        displayName: position.displayName,
        cost: position.cost,
        min: position.min,
        max: position.max,
        ma: position.ma,
        st: position.st,
        ag: position.ag,
        pa: position.pa,
        av: position.av,
        skillCount: position.skills.length,
      },
    });
    res.json({ position });
  } catch (error: any) {
    if (error instanceof SkillResolutionError) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Position non trouvée" });
    }
    serverLog.error("Erreur lors de la mise à jour de la position:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.post("/positions/:id/duplicate", validate(duplicatePositionSchema), async (req, res) => {
  try {
    const sourcePosition = await prisma.position.findUnique({
      where: { id: req.params.id },
      include: {
        roster: true,
        skills: {
          include: { skill: true },
        },
      },
    });

    if (!sourcePosition) {
      return res.status(404).json({ error: "Position source non trouvée" });
    }

    const { targetRosterId } = req.body;

    // Vérifier que le roster cible existe
    const targetRoster = await prisma.roster.findUnique({
      where: { id: targetRosterId },
    });

    if (!targetRoster) {
      return res.status(404).json({ error: "Roster cible non trouvé" });
    }

    // Les skillId source appartiennent au ruleset source ; on ne peut pas les
    // réutiliser tels quels si le roster cible est d'un autre ruleset (chaque
    // slug a un id distinct par ruleset). On remappe par slug dans le ruleset
    // cible ; les skills sans équivalent dans ce ruleset sont ignorés et
    // signalés dans la réponse.
    const sourceSlugs: string[] = sourcePosition.skills.map(
      (ps: { skill: { slug: string } }) => ps.skill.slug,
    );
    const targetSkills = await prisma.skill.findMany({
      where: { slug: { in: sourceSlugs }, ruleset: targetRoster.ruleset },
      select: { id: true, slug: true },
    });
    const targetIdBySlug = new Map(
      targetSkills.map((s: { id: string; slug: string }) => [s.slug, s.id]),
    );
    const skippedSlugs = sourceSlugs.filter((slug) => !targetIdBySlug.has(slug));

    // Dupliquer la position + ses skills (résolus dans le ruleset cible) en une
    // seule opération atomique.
    const result = await prisma.position.create({
      data: {
        rosterId: targetRosterId,
        slug: sourcePosition.slug,
        displayName: sourcePosition.displayName,
        cost: sourcePosition.cost,
        min: sourcePosition.min,
        max: sourcePosition.max,
        ma: sourcePosition.ma,
        st: sourcePosition.st,
        ag: sourcePosition.ag,
        pa: sourcePosition.pa,
        av: sourcePosition.av,
        keywords: sourcePosition.keywords,
        primarySkills: sourcePosition.primarySkills,
        secondarySkills: sourcePosition.secondarySkills,
        skills: {
          create: Array.from(targetIdBySlug.values()).map((skillId) => ({
            skill: { connect: { id: skillId } },
          })),
        },
      },
      include: {
        roster: true,
        skills: {
          include: { skill: true },
        },
      },
    });

    await safeAudit(req, {
      action: "position.duplicate",
      entity: "Position",
      entityId: result.id,
      oldValue: { sourceId: sourcePosition.id, sourceRosterId: sourcePosition.rosterId, slug: sourcePosition.slug },
      newValue: {
        rosterId: targetRosterId,
        slug: result.slug,
        skillCount: result.skills.length,
        skippedSkills: skippedSlugs,
      },
    });

    const message =
      skippedSlugs.length > 0
        ? `Position dupliquée vers le roster ${targetRoster.name}. Compétences sans équivalent dans le ruleset cible, ignorées : ${skippedSlugs.join(", ")}`
        : `Position dupliquée avec succès vers le roster ${targetRoster.name}`;

    res.status(201).json({
      position: result,
      message,
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Une position avec ce slug existe déjà dans le roster cible" });
    }
    serverLog.error("Erreur lors de la duplication de la position:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.delete("/positions/:id", async (req, res) => {
  try {
    const previous = await prisma.position.findUnique({
      where: { id: req.params.id },
      select: { id: true, rosterId: true, slug: true, displayName: true, cost: true },
    });
    await prisma.position.delete({
      where: { id: req.params.id },
    });
    await safeAudit(req, {
      action: "position.delete",
      entity: "Position",
      entityId: req.params.id,
      oldValue: previous,
    });
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Position non trouvée" });
    }
    serverLog.error("Erreur lors de la suppression de la position:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

// =============================================================================
// STAR PLAYERS
// =============================================================================

router.get("/star-players", validateQuery(adminStarPlayersQuerySchema), async (req, res) => {
  try {
    const { search } = req.query;
    const where: any = {};
    
    if (search) {
      where.OR = [
        { slug: { contains: search as string, mode: "insensitive" } },
        { displayName: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const starPlayers = await prisma.starPlayer.findMany({
      where,
      include: {
        skills: {
          include: { skill: true },
        },
        hirableBy: {
          include: { roster: true },
        },
      },
      orderBy: { displayName: "asc" },
    });
    res.json({ starPlayers });
  } catch (error: any) {
    serverLog.error("Erreur lors de la récupération des Star Players:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.get("/star-players/:id", async (req, res) => {
  try {
    const starPlayer = await prisma.starPlayer.findUnique({
      where: { id: req.params.id },
      include: {
        skills: {
          include: { skill: true },
        },
        hirableBy: {
          include: { roster: true },
        },
      },
    });
    if (!starPlayer) {
      return res.status(404).json({ error: "Star Player non trouvé" });
    }
    res.json({ starPlayer });
  } catch (error: any) {
    serverLog.error("Erreur lors de la récupération du Star Player:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.post("/star-players", validate(createStarPlayerDataSchema), async (req, res) => {
  try {
    const { slug, displayName, cost, ma, st, ag, pa, av, specialRule, imageUrl, skillSlugs, hirableBy } = req.body;

    const starPlayer = await prisma.starPlayer.create({
      data: {
        slug,
        displayName,
        cost,
        ma,
        st,
        ag,
        pa: pa ?? null,
        av,
        specialRule: specialRule || null,
        imageUrl: imageUrl || null,
        skills: {
          create: skillSlugs?.map((skillSlug: string) => ({
            skill: {
              connect: { slug: skillSlug }
            }
          })) || [],
        },
        hirableBy: {
          create: hirableBy?.map((rule: string | { rule: string; rosterId?: string }) => {
            if (typeof rule === "string") {
              return { rule, rosterId: null };
            }
            return { rule: rule.rule, rosterId: rule.rosterId || null };
          }) || [],
        },
      },
      include: {
        skills: {
          include: { skill: true },
        },
        hirableBy: {
          include: { roster: true },
        },
      },
    });
    await safeAudit(req, {
      action: "star-player.create",
      entity: "StarPlayer",
      entityId: starPlayer.id,
      newValue: {
        slug: starPlayer.slug,
        displayName: starPlayer.displayName,
        cost: starPlayer.cost,
        skillCount: starPlayer.skills.length,
        hirableCount: starPlayer.hirableBy.length,
      },
    });
    res.status(201).json({ starPlayer });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Ce Star Player existe déjà" });
    }
    serverLog.error("Erreur lors de la création du Star Player:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.put("/star-players/:id", validate(updateStarPlayerDataSchema), async (req, res) => {
  try {
    const { displayName, cost, ma, st, ag, pa, av, specialRule, imageUrl, skillSlugs, hirableBy } = req.body;

    const previous = await prisma.starPlayer.findUnique({
      where: { id: req.params.id },
      select: {
        slug: true,
        displayName: true,
        cost: true,
        ma: true,
        st: true,
        ag: true,
        pa: true,
        av: true,
        specialRule: true,
      },
    });

    // Supprimer les anciennes relations
    await prisma.starPlayerSkill.deleteMany({
      where: { starPlayerId: req.params.id },
    });
    await prisma.starPlayerHirableBy.deleteMany({
      where: { starPlayerId: req.params.id },
    });

    // Mettre à jour et créer les nouvelles relations
    const starPlayer = await prisma.starPlayer.update({
      where: { id: req.params.id },
      data: {
        displayName,
        cost,
        ma,
        st,
        ag,
        pa: pa ?? null,
        av,
        specialRule: specialRule || null,
        imageUrl: imageUrl || null,
        skills: {
          create: skillSlugs?.map((skillSlug: string) => ({
            skill: {
              connect: { slug: skillSlug }
            }
          })) || [],
        },
        hirableBy: {
          create: hirableBy?.map((rule: string | { rule: string; rosterId?: string }) => {
            if (typeof rule === "string") {
              return { rule, rosterId: null };
            }
            return { rule: rule.rule, rosterId: rule.rosterId || null };
          }) || [],
        },
      },
      include: {
        skills: {
          include: { skill: true },
        },
        hirableBy: {
          include: { roster: true },
        },
      },
    });
    await safeAudit(req, {
      action: "star-player.update",
      entity: "StarPlayer",
      entityId: starPlayer.id,
      oldValue: previous,
      newValue: {
        slug: starPlayer.slug,
        displayName: starPlayer.displayName,
        cost: starPlayer.cost,
        ma: starPlayer.ma,
        st: starPlayer.st,
        ag: starPlayer.ag,
        pa: starPlayer.pa,
        av: starPlayer.av,
        specialRule: starPlayer.specialRule,
        skillCount: starPlayer.skills.length,
        hirableCount: starPlayer.hirableBy.length,
      },
    });
    res.json({ starPlayer });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Star Player non trouvé" });
    }
    serverLog.error("Erreur lors de la mise à jour du Star Player:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

router.delete("/star-players/:id", async (req, res) => {
  try {
    const previous = await prisma.starPlayer.findUnique({
      where: { id: req.params.id },
      select: { id: true, slug: true, displayName: true, cost: true },
    });
    await prisma.starPlayer.delete({
      where: { id: req.params.id },
    });
    await safeAudit(req, {
      action: "star-player.delete",
      entity: "StarPlayer",
      entityId: req.params.id,
      oldValue: previous,
    });
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Star Player non trouvé" });
    }
    serverLog.error("Erreur lors de la suppression du Star Player:", error);
    res.status(500).json({ error: error.message || "Erreur serveur" });
  }
});

export default router;

