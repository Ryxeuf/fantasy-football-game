import { z } from "zod";

/**
 * PATCH /me/naf — opt-in NAF (Naffinity Federation).
 *
 * Valide uniquement la *forme* du corps : `nafName` est une chaine,
 * `null` (desactivation), ou absent. La regle metier (2-64 chars ASCII)
 * reste portee par `isValidNafName` cote handler — le schema est un
 * sur-ensemble fidele de ce que le handler accepte.
 */
export const updateNafSchema = z.object({
  nafName: z.string().nullable().optional(),
});

export type UpdateNafInput = z.infer<typeof updateNafSchema>;

const NAF_NUMBER_FORMAT = "Le numéro NAF compte 1 à 7 chiffres";

/**
 * PUT /user/naf-number — numéro de membre NAF (1 à 7 chiffres).
 *
 * Accepte un nombre, une chaîne de chiffres (champ de formulaire) ou `null` ;
 * une chaîne vide vaut `null` (effacement). Sortie normalisée : `number | null`.
 */
export const updateNafNumberSchema = z.object({
  nafNumber: z.union([
    z.null(),
    z
      .number()
      .int(NAF_NUMBER_FORMAT)
      .min(1, NAF_NUMBER_FORMAT)
      .max(9_999_999, NAF_NUMBER_FORMAT),
    z
      .string()
      .trim()
      .regex(/^\d{0,7}$/, NAF_NUMBER_FORMAT)
      .transform((s) => (s === "" ? null : Number.parseInt(s, 10)))
      .refine((n) => n === null || n >= 1, NAF_NUMBER_FORMAT),
  ]),
});

export type UpdateNafNumberInput = z.output<typeof updateNafNumberSchema>;
