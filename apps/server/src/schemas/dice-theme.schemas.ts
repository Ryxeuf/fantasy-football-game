import { z } from "zod";

/** Slug de thème : forme seulement, l'existence est vérifiée par le service. */
export const diceThemeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/);

/** Forme seulement : l'existence et la possession sont vérifiées par le service. */
export const diceThemePreferenceSchema = z.object({
  themeId: diceThemeIdSchema,
});

export type DiceThemePreferenceInput = z.infer<typeof diceThemePreferenceSchema>;

export const diceThemeParamsSchema = z.object({
  themeId: diceThemeIdSchema,
});

export type DiceThemeParams = z.infer<typeof diceThemeParamsSchema>;

/** Édition admin d'une entrée du catalogue (champs absents = inchangés). */
export const adminDiceThemeUpdateSchema = z
  .object({
    nameFr: z.string().trim().min(1).max(80).optional(),
    nameEn: z.string().trim().min(1).max(80).optional(),
    descriptionFr: z.string().trim().max(300).nullable().optional(),
    descriptionEn: z.string().trim().max(300).nullable().optional(),
    /** Prix en Crowns ; `null` = gratuit. */
    priceCrowns: z.number().int().min(0).max(1_000_000).nullable().optional(),
    enabled: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(100_000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Aucun champ à modifier" });

export type AdminDiceThemeUpdateInput = z.infer<typeof adminDiceThemeUpdateSchema>;

export const adminCoachCosmeticsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type AdminCoachCosmeticsQuery = z.infer<typeof adminCoachCosmeticsQuerySchema>;

export const adminCoachParamsSchema = z.object({
  userId: z.string().trim().min(1).max(64),
});

export const adminCoachThemeParamsSchema = z.object({
  userId: z.string().trim().min(1).max(64),
  themeId: diceThemeIdSchema,
});

export const adminRevokeDiceThemeSchema = z.object({
  /** Recrédite le prix payé (achat seulement) en `ADMIN_REFUND`. */
  refund: z.boolean().default(false),
});

export type AdminRevokeDiceThemeInput = z.infer<typeof adminRevokeDiceThemeSchema>;

export const adminSetCoachDiceThemeSchema = z.object({
  /** `null` = retour au thème par défaut. */
  themeId: diceThemeIdSchema.nullable(),
});

export type AdminSetCoachDiceThemeInput = z.infer<typeof adminSetCoachDiceThemeSchema>;
