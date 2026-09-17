/**
 * L2.C.6 — Sprint Ligues v2 PR10 : Zod schemas pour les routes
 * `/admin/leagues/*`.
 */

import { z } from "zod";
import { LEAGUE_TIE_BREAK_SLUGS } from "../services/league-standings-order";

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

/**
 * Critères de classement d'une ligue, réordonnés par un administrateur.
 * Les slugs viennent de `services/league-standings-order` (module PUR) :
 * pas de miroir manuel à tenir. `null` (ou une liste vide) remet la ligue
 * sur l'ordre par défaut.
 */
export const adminLeagueStandingsOrderSchema = z.object({
  tieBreakRules: z
    .array(z.enum(LEAGUE_TIE_BREAK_SLUGS))
    .max(LEAGUE_TIE_BREAK_SLUGS.length)
    .nullable(),
});

export type AdminLeaguesQuery = z.infer<typeof adminLeaguesQuerySchema>;
export type AdminLeagueStatusBody = z.infer<typeof adminLeagueStatusSchema>;
export type AdminLeagueTransferBody = z.infer<
  typeof adminLeagueTransferSchema
>;
export type AdminLeagueStandingsOrderBody = z.infer<
  typeof adminLeagueStandingsOrderSchema
>;
