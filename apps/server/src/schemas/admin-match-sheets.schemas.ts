/**
 * Zod schemas pour les routes `/admin/match-sheets/*`.
 */

import { z } from "zod";

export const ADMIN_MATCH_SHEET_STATUSES = [
  "draft",
  "submitted_home",
  "submitted_away",
  "both_submitted",
  "validated",
  "invalidated",
] as const;

export const adminMatchSheetsQuerySchema = z.object({
  status: z.enum(ADMIN_MATCH_SHEET_STATUSES).optional(),
  kind: z.enum(["league", "cup"]).optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type AdminMatchSheetsQuery = z.infer<typeof adminMatchSheetsQuerySchema>;
