/**
 * L2.C.6 — Sprint Ligues v2 PR10 : Zod schemas pour les routes
 * `/admin/leagues/*`.
 */

import { z } from "zod";

const leagueStatus = z.enum([
  "draft",
  "open",
  "in_progress",
  "completed",
  "archived",
]);

export const adminLeaguesQuerySchema = z.object({
  status: leagueStatus.optional(),
  search: z.string().trim().max(100).optional(),
  publicOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const adminLeagueStatusSchema = z.object({
  status: leagueStatus,
});

export const adminLeagueTransferSchema = z.object({
  userId: z.string().min(1, "userId requis"),
});

export type AdminLeaguesQuery = z.infer<typeof adminLeaguesQuerySchema>;
export type AdminLeagueStatusBody = z.infer<typeof adminLeagueStatusSchema>;
export type AdminLeagueTransferBody = z.infer<
  typeof adminLeagueTransferSchema
>;
