import { z } from "zod";

/** Forme seulement : l'existence et la possession sont vérifiées par le service. */
export const diceThemePreferenceSchema = z.object({
  themeId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
});

export type DiceThemePreferenceInput = z.infer<typeof diceThemePreferenceSchema>;
