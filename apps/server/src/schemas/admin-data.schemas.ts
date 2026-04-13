import { z } from "zod";

// ── Query schemas ──

export const adminSkillsQuerySchema = z.object({
  category: z.string().max(100).optional(),
  search: z.string().max(200).optional(),
  ruleset: z.string().max(50).optional(),
});

export const adminRostersQuerySchema = z.object({
  ruleset: z.string().max(50).optional(),
});

export const adminPositionsQuerySchema = z.object({
  rosterId: z.string().optional(),
  ruleset: z.string().max(50).optional(),
});

export const adminStarPlayersQuerySchema = z.object({
  search: z.string().max(200).optional(),
});

// ── Body schemas: Skills ──

export const createSkillSchema = z.object({
  slug: z.string().min(1, "slug requis").max(100),
  nameFr: z.string().min(1, "nameFr requis").max(200),
  nameEn: z.string().min(1, "nameEn requis").max(200),
  description: z.string().min(1, "description requis"),
  descriptionEn: z.string().optional().nullable(),
  category: z.string().min(1, "category requis").max(100),
  ruleset: z.string().max(50).optional(),
});

export const updateSkillSchema = z.object({
  nameFr: z.string().min(1).max(200).optional(),
  nameEn: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  descriptionEn: z.string().optional().nullable(),
  category: z.string().min(1).max(100).optional(),
  ruleset: z.string().max(50).optional(),
  isElite: z.boolean().optional(),
  isPassive: z.boolean().optional(),
  isModified: z.boolean().optional(),
});

export const duplicateToRulesetSchema = z.object({
  targetRuleset: z.string().min(1, "targetRuleset requis").max(50),
});

// ── Body schemas: Rosters ──

export const createRosterSchema = z.object({
  slug: z.string().min(1, "slug requis").max(100),
  name: z.string().min(1, "name requis").max(200),
  nameEn: z.string().min(1, "nameEn requis").max(200),
  descriptionFr: z.string().optional().nullable(),
  descriptionEn: z.string().optional().nullable(),
  budget: z.number({ message: "budget requis" }),
  tier: z.string().min(1, "tier requis").max(50),
  regionalRules: z.any().optional().nullable(),
  specialRules: z.string().optional().nullable(),
  naf: z.boolean().optional().default(false),
  ruleset: z.string().max(50).optional(),
});

export const updateRosterSchema = z.object({
  name: z.string().min(1, "name requis").max(200),
  nameEn: z.string().min(1, "nameEn requis").max(200),
  descriptionFr: z.string().optional().nullable(),
  descriptionEn: z.string().optional().nullable(),
  budget: z.number().optional(),
  tier: z.string().max(50).optional(),
  regionalRules: z.any().optional().nullable(),
  specialRules: z.string().optional().nullable(),
  naf: z.boolean().optional(),
  ruleset: z.string().max(50).optional(),
});

// ── Body schemas: Positions ──

export const createPositionSchema = z.object({
  rosterId: z.string().min(1, "rosterId requis"),
  slug: z.string().min(1, "slug requis").max(100),
  displayName: z.string().min(1, "displayName requis").max(200),
  cost: z.number({ message: "cost requis" }),
  min: z.number({ message: "min requis" }).int(),
  max: z.number({ message: "max requis" }).int(),
  ma: z.number({ message: "ma requis" }).int(),
  st: z.number({ message: "st requis" }).int(),
  ag: z.number({ message: "ag requis" }).int(),
  pa: z.number({ message: "pa requis" }).int(),
  av: z.number({ message: "av requis" }).int(),
  keywords: z.string().optional().nullable(),
  skillSlugs: z.array(z.string()).optional(),
});

export const updatePositionSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  cost: z.number().optional(),
  min: z.number().int().optional(),
  max: z.number().int().optional(),
  ma: z.number().int().optional(),
  st: z.number().int().optional(),
  ag: z.number().int().optional(),
  pa: z.number().int().optional(),
  av: z.number().int().optional(),
  keywords: z.string().optional().nullable(),
  skillSlugs: z.array(z.string()).optional(),
});

export const duplicatePositionSchema = z.object({
  targetRosterId: z.string().min(1, "Le roster cible est requis"),
});

// ── Body schemas: Star Players ──

const hirableByItem = z.union([
  z.string(),
  z.object({ rule: z.string(), rosterId: z.string().optional().nullable() }),
]);

export const createStarPlayerDataSchema = z.object({
  slug: z.string().min(1, "slug requis").max(100),
  displayName: z.string().min(1, "displayName requis").max(200),
  cost: z.number({ message: "cost requis" }),
  ma: z.number({ message: "ma requis" }).int(),
  st: z.number({ message: "st requis" }).int(),
  ag: z.number({ message: "ag requis" }).int(),
  pa: z.number().int().optional().nullable(),
  av: z.number({ message: "av requis" }).int(),
  specialRule: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  skillSlugs: z.array(z.string()).optional(),
  hirableBy: z.array(hirableByItem).optional(),
});

export const updateStarPlayerDataSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  cost: z.number().optional(),
  ma: z.number().int().optional(),
  st: z.number().int().optional(),
  ag: z.number().int().optional(),
  pa: z.number().int().optional().nullable(),
  av: z.number().int().optional(),
  specialRule: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  skillSlugs: z.array(z.string()).optional(),
  hirableBy: z.array(hirableByItem).optional(),
});
