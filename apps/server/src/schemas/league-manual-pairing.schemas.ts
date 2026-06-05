/**
 * Lot F — Zod schemas pour la creation manuelle de pairings.
 */

import { z } from "zod";

const isoDate = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s));

export const createManualRoundSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  kind: z.enum(["regular", "playoff"]).optional(),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
});
export type CreateManualRoundBody = z.infer<typeof createManualRoundSchema>;

export const createManualPairingSchema = z.object({
  homeParticipantId: z.string().min(1, "homeParticipantId requis"),
  awayParticipantId: z.string().min(1, "awayParticipantId requis"),
  scheduledAt: isoDate.nullable().optional(),
  deadlineAt: isoDate.nullable().optional(),
});
export type CreateManualPairingBody = z.infer<
  typeof createManualPairingSchema
>;

export const updateManualPairingSchema = z
  .object({
    scheduledAt: isoDate.nullable().optional(),
    deadlineAt: isoDate.nullable().optional(),
    targetRoundId: z.string().min(1).optional(),
  })
  .refine(
    (v) =>
      v.scheduledAt !== undefined ||
      v.deadlineAt !== undefined ||
      v.targetRoundId !== undefined,
    "Aucun champ a modifier",
  );
export type UpdateManualPairingBody = z.infer<
  typeof updateManualPairingSchema
>;
