/**
 * Lot C — Zod schemas pour les routes de gestion des poules.
 */

import { z } from "zod";

const colorHex = z
  .string()
  .regex(/^#?[0-9A-Fa-f]{6}$/, "Format de couleur invalide (#RRGGBB)");

export const createPoolSchema = z.object({
  name: z.string().trim().min(1).max(60),
  qualifiesForPlayoffs: z.number().int().min(0).max(128).optional(),
  color: colorHex.optional().nullable(),
  order: z.number().int().min(0).max(64).optional(),
});
export type CreatePoolBody = z.infer<typeof createPoolSchema>;

export const updatePoolSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    qualifiesForPlayoffs: z.number().int().min(0).max(128).optional(),
    color: colorHex.optional().nullable(),
    order: z.number().int().min(0).max(64).optional(),
  })
  .refine(
    (v) => Object.keys(v).length > 0,
    "Au moins un champ doit etre fourni",
  );
export type UpdatePoolBody = z.infer<typeof updatePoolSchema>;

export const assignPoolsSchema = z.object({
  assignments: z
    .array(
      z.object({
        participantId: z.string().min(1),
        poolId: z.string().min(1).nullable(),
      }),
    )
    .min(1)
    .max(256),
});
export type AssignPoolsBody = z.infer<typeof assignPoolsSchema>;
