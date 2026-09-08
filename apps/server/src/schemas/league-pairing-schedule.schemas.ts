/**
 * Date prévisionnelle d'une rencontre de ligue (coachs impliqués ou
 * commissaire). `null` efface la date.
 */

import { z } from "zod";

const isoDate = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s));

export const schedulePairingSchema = z.object({
  scheduledAt: isoDate.nullable(),
});
export type SchedulePairingBody = z.infer<typeof schedulePairingSchema>;
