import { z } from "zod";

/** Couleur de présentation : hex 6 chiffres, dièse optionnel. */
const colorHex = z
  .string()
  .regex(/^#?[0-9A-Fa-f]{6}$/, "Couleur attendue au format #RRGGBB");

export const createCupPoolSchema = z.object({
  name: z.string().trim().min(1).max(60),
  qualifiesForPlayoffs: z.number().int().min(0).max(128).optional(),
  color: colorHex.optional().nullable(),
  order: z.number().int().min(0).max(64).optional(),
});
export type CreateCupPoolBody = z.infer<typeof createCupPoolSchema>;

export const updateCupPoolSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    qualifiesForPlayoffs: z.number().int().min(0).max(128).optional(),
    color: colorHex.optional().nullable(),
    order: z.number().int().min(0).max(64).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Au moins un champ doit être fourni",
  });
export type UpdateCupPoolBody = z.infer<typeof updateCupPoolSchema>;

/**
 * Affectations en lot. `poolId: null` retire l'équipe de sa poule — c'est ce
 * que la liste déroulante « — Non affectée — » envoie.
 */
export const assignCupPoolsSchema = z.object({
  assignments: z
    .array(
      z.object({
        participantId: z.string().min(1).max(64),
        poolId: z.string().min(1).max(64).nullable(),
      }),
    )
    .min(1)
    .max(256),
});
export type AssignCupPoolsBody = z.infer<typeof assignCupPoolsSchema>;
