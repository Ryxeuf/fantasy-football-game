/**
 * Zod schemas des routes `/notifications` (notifications internes).
 */

import { z } from "zod";

/** Booléen de query string : `?unread=true|1`. */
const queryBoolean = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  unread: queryBoolean.optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
