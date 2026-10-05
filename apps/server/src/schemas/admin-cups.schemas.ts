/**
 * Zod schemas pour les routes `/admin/cups/*`.
 */

import { z } from "zod";

export const ADMIN_CUP_STATUSES = [
  "ouverte",
  "en_cours",
  "terminee",
  "archivee",
] as const;

export const adminCupsQuerySchema = z.object({
  status: z.enum(ADMIN_CUP_STATUSES).optional(),
  visibility: z.enum(["public", "private"]).optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type AdminCupsQuery = z.infer<typeof adminCupsQuerySchema>;
