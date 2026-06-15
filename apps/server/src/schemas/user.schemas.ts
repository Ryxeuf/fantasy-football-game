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
