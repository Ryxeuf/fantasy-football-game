/**
 * Schémas Zod des outils de calendrier du commissaire : renommer une journée
 * (et ses dates) — `PATCH /leagues/rounds/:roundId`.
 */

import { z } from "zod";

const isoDate = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s));

/**
 * `name` : chaîne vide ou `null` ⇒ nom par défaut (« Journée N ») ; le
 * service normalise. Dates : mêmes formes que la création manuelle.
 */
export const updateLeagueRoundSchema = z
  .object({
    name: z.string().max(120).nullable().optional(),
    startDate: isoDate.nullable().optional(),
    endDate: isoDate.nullable().optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.startDate !== undefined ||
      v.endDate !== undefined,
    "Aucun champ a modifier",
  );
export type UpdateLeagueRoundBody = z.infer<typeof updateLeagueRoundSchema>;
