import { z } from "zod";

/** Tiers de roster reconnus (clés des maps budget/PSP par tier). */
const CUP_TIERS = ["I", "II", "III", "IV"] as const;
const isCupTier = (k: string): boolean =>
  (CUP_TIERS as readonly string[]).includes(k);

/**
 * Map budget par tier (kpo). Partielle (`z.record(z.enum())` exigerait TOUS les
 * tiers), avec refine sur les clés valides. Tout tier absent = pas de contrainte.
 */
const tierBudgetsSchema = z
  .record(z.string(), z.number().int().min(0).max(5000))
  .refine((m) => Object.keys(m).every(isCupTier), {
    message: "Tier inconnu (attendu I/II/III/IV)",
  });

/** Map PSP de départ par tier. Partielle : tout tier absent = 0. */
const tierStartingPspSchema = z
  .record(z.string(), z.number().int().min(0).max(200))
  .refine((m) => Object.keys(m).every(isCupTier), {
    message: "Tier inconnu (attendu I/II/III/IV)",
  });

/** Surcharge de budget par roster (slug → kpo). */
const rosterBudgetOverridesSchema = z.record(
  z.string().min(1).max(50),
  z.number().int().min(0).max(5000),
);

/** Surcharge du pool de PSP par roster (slug → PSP). */
const rosterStartingPspOverridesSchema = z.record(
  z.string().min(1).max(50),
  z.number().int().min(0).max(200),
);

/**
 * Règles avancées de composition (mode coupe). Tous les champs sont
 * optionnels → une coupe sans ces champs se comporte comme avant.
 */
export const cupRulesConfigSchema = z.object({
  resurrectionMode: z.boolean().optional(),
  tierBudgets: tierBudgetsSchema.optional(),
  rosterBudgetOverrides: rosterBudgetOverridesSchema.optional(),
  tierStartingPsp: tierStartingPspSchema.optional(),
  rosterStartingPspOverrides: rosterStartingPspOverridesSchema.optional(),
});

/** Body de mise à jour dédiée des règles de composition (commissaire/admin). */
export const updateCupRulesSchema = cupRulesConfigSchema;

export type CupRulesConfigInput = z.infer<typeof cupRulesConfigSchema>;

const scoringConfigSchema = z.object({
  winPoints: z.number().optional(),
  drawPoints: z.number().optional(),
  lossPoints: z.number().optional(),
  forfeitPoints: z.number().optional(),
  touchdownPoints: z.number().optional(),
  blockCasualtyPoints: z.number().optional(),
  foulCasualtyPoints: z.number().optional(),
  passPoints: z.number().optional(),
});

export const createCupSchema = z
  .object({
    name: z
      .string()
      .min(1, "Le nom de la coupe est requis")
      .max(100, "Le nom de la coupe ne peut pas depasser 100 caracteres"),
    description: z.string().max(1000).optional().nullable(),
    isPublic: z.boolean().optional().default(true),
    ruleset: z.string().max(50).optional(),
    format: z.enum(["bb11", "sevens"]).optional(),
    scoringConfig: scoringConfigSchema.optional(),
    // Flat-level scoring fields (backwards compat)
    winPoints: z.number().optional(),
    drawPoints: z.number().optional(),
    lossPoints: z.number().optional(),
    forfeitPoints: z.number().optional(),
    touchdownPoints: z.number().optional(),
    blockCasualtyPoints: z.number().optional(),
    foulCasualtyPoints: z.number().optional(),
    passPoints: z.number().optional(),
    // S27.1i — couple optionnel pour designer une edition mensuelle
    // canonique. Validation admin enforce cote handler.
    monthlyYear: z.number().int().positive().optional(),
    monthlyMonth: z.number().int().min(1).max(12).optional(),
    // Règles avancées de composition (résurrection, budgets par tier, PSP).
    resurrectionMode: z.boolean().optional(),
    tierBudgets: tierBudgetsSchema.optional(),
    rosterBudgetOverrides: rosterBudgetOverridesSchema.optional(),
    tierStartingPsp: tierStartingPspSchema.optional(),
    rosterStartingPspOverrides: rosterStartingPspOverridesSchema.optional(),
  })
  .refine(
    (data) =>
      (data.monthlyYear === undefined && data.monthlyMonth === undefined) ||
      (data.monthlyYear !== undefined && data.monthlyMonth !== undefined),
    {
      message: "monthlyYear et monthlyMonth doivent etre fournis ensemble",
      path: ["monthlyMonth"],
    },
  );

export const registerCupSchema = z.object({
  teamId: z.string().min(1, "teamId requis"),
});

export const unregisterCupSchema = z.object({
  teamId: z.string().min(1, "teamId requis"),
  force: z.boolean().optional(),
});

const validCupStatuses = ["ouverte", "en_cours", "terminee", "archivee"] as const;

export const updateCupStatusSchema = z.object({
  status: z.enum(validCupStatuses, {
    message: "Statut invalide",
  }),
});

/**
 * S27.1b — Query schema pour `GET /cup/monthly`. Tous les filtres sont
 * optionnels : year/month restreignent l'edition, limit/offset bornent
 * la pagination (cap 100, defaut 50).
 */
export const listMonthlyCupsQuerySchema = z.object({
  year: z.coerce.number().int().positive().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ListMonthlyCupsQuery = z.infer<typeof listMonthlyCupsQuerySchema>;

/**
 * S27.1g — Body schema pour `POST /cup/match-of-the-week/:matchId`.
 * `note` optionnel (max 280 chars, format Twitter-like) et nullable.
 */
export const setMatchOfTheWeekSchema = z.object({
  note: z.string().trim().max(280).optional().nullable(),
});

export type SetMatchOfTheWeekBody = z.infer<typeof setMatchOfTheWeekSchema>;
