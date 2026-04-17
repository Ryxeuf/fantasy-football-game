import { z } from "zod";

const flagKeyRegex = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const createFeatureFlagSchema = z.object({
  key: z
    .string()
    .regex(flagKeyRegex, {
      message:
        "key invalide : minuscules, chiffres, '_' ou '-', 1 à 64 caractères",
    }),
  description: z.string().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
});

export const updateFeatureFlagSchema = z
  .object({
    description: z.string().max(500).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine(
    (data) => data.description !== undefined || data.enabled !== undefined,
    { message: "Aucun champ à mettre à jour" },
  );

export const addFeatureFlagUserSchema = z.object({
  userId: z.string().min(1).max(64),
});

export type CreateFeatureFlagInput = z.infer<typeof createFeatureFlagSchema>;
export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;
export type AddFeatureFlagUserInput = z.infer<typeof addFeatureFlagUserSchema>;
