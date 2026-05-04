import { z } from "zod";

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

export const createCupSchema = z.object({
  name: z
    .string()
    .min(1, "Le nom de la coupe est requis")
    .max(100, "Le nom de la coupe ne peut pas depasser 100 caracteres"),
  isPublic: z.boolean().optional().default(true),
  ruleset: z.string().max(50).optional(),
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
});

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
