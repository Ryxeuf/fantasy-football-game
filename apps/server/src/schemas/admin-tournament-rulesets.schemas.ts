/**
 * Zod schemas des routes admin `/admin/tournament-rulesets` (règlements de
 * tournoi éditables). La validation SÉMANTIQUE (rosters connus de
 * l'édition, tranches de taxe croissantes…) vit dans la route — ici les
 * formes et bornes.
 */

import { z } from "zod";

const packSlug = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9_]+$/,
    "slug invalide (minuscules, chiffres et underscores uniquement)",
  );

const rosterSlug = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/i, "slug de roster invalide");

/** Règles imposées à UN roster (budgets en kpo). */
const rosterRuleSchema = z.object({
  goldBudget: z.number().int().min(100).max(3000),
  sppBudget: z.number().int().min(0).max(300),
  skillStacking: z.enum(["none", "one_player", "two_players"]),
  starPlayersAllowed: z.boolean(),
});

const skillCostsSchema = z.object({
  firstPrimary: z.number().int().min(0).max(100),
  firstSecondary: z.number().int().min(0).max(100),
  secondPrimary: z.number().int().min(0).max(100),
  secondSecondary: z.number().int().min(0).max(100),
  eliteSurcharge: z.number().int().min(0).max(50),
});

/** Tranche de taxe SPP — `maxTotalCostK: null` = tranche ouverte (∞). */
const taxBracketSchema = z.object({
  maxTotalCostK: z.number().int().min(1).max(10_000).nullable(),
  spp: z.number().int().min(0).max(300),
});

/** Inducement autorisé (coût en po). */
const inducementSchema = z.object({
  slug: z.string().trim().min(1).max(64),
  cost: z.number().int().min(0).max(1_000_000),
  max: z.number().int().min(1).max(20).optional(),
  noteFr: z.string().trim().max(300).optional(),
});

const scoringSchema = z.object({
  win: z.number().int().min(-100).max(100),
  draw: z.number().int().min(-100).max(100),
  loss: z.number().int().min(-100).max(100),
  concession: z.number().int().min(-100).max(100),
});

export const createTournamentRulesetSchema = z.object({
  // Slug stable référencé par Team/League/Cup : IMMUABLE après création
  // (absent du schema d'update).
  slug: packSlug,
  nameFr: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  shortLabel: z.string().trim().min(1).max(60),
  version: z.string().trim().min(1).max(20),
  edition: z.enum(["season_2", "season_3"]),
  format: z.enum(["bb11", "sevens"]),
  descriptionFr: z.string().max(2000).optional().nullable(),
  resurrection: z.boolean().optional().default(true),
  minRegularPlayersBeforeStars: z.number().int().min(0).max(16).optional().default(11),
  // Un roster absent de la map est INTERDIT par le règlement.
  rosterRules: z
    .record(rosterSlug, rosterRuleSchema)
    .refine((map) => Object.keys(map).length > 0, {
      message: "Au moins un roster doit être autorisé",
    }),
  skillCosts: skillCostsSchema,
  eliteSkills: z.array(z.string().trim().min(1).max(64)).max(64).optional().default([]),
  bannedStarPlayers: z
    .array(z.string().trim().min(1).max(64))
    .max(128)
    .optional()
    .default([]),
  starPlayerSppTax: z.array(taxBracketSchema).max(10).optional().default([]),
  allowedInducements: z.array(inducementSchema).max(32).optional().default([]),
  scoring: scoringSchema,
});
export type CreateTournamentRulesetBody = z.infer<
  typeof createTournamentRulesetSchema
>;

/**
 * Édition : tous les champs optionnels SAUF le slug (immuable, absent).
 * Un champ absent est conservé tel quel ; un champ fourni remplace la
 * valeur entière (pas de merge profond des maps/arrays).
 */
export const updateTournamentRulesetSchema = createTournamentRulesetSchema
  .omit({ slug: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ à modifier est requis",
  });
export type UpdateTournamentRulesetBody = z.infer<
  typeof updateTournamentRulesetSchema
>;
