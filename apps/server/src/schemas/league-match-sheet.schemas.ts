/**
 * Lot G — Zod schemas pour les routes de feuille de match v2.
 */

import { z } from "zod";

export const addEventSchema = z.object({
  kind: z.enum([
    "kickoff",
    "touchdown",
    "casualty",
    "pass_complete",
    "interception",
    "aggression",
    "expulsion",
    "crowd_surge",
    "stalling",
    "other_elim",
  ]),
  team: z.enum(["home", "away"]).optional().nullable(),
  actorPlayerId: z.string().min(1).optional().nullable(),
  targetPlayerId: z.string().min(1).optional().nullable(),
  causeDetail: z.string().max(64).optional().nullable(),
  injurySeverity: z
    .enum(["badly_hurt", "mng", "niggling", "stat_loss", "dead"])
    .optional()
    .nullable(),
  meta: z.record(z.string(), z.unknown()).optional().nullable(),
});
export type AddEventBody = z.infer<typeof addEventSchema>;

export const preMatchSchema = z
  .object({
    weather: z.string().max(64).optional().nullable(),
    popularityHome: z.number().int().min(0).max(20).optional().nullable(),
    popularityAway: z.number().int().min(0).max(20).optional().nullable(),
    inducementsHome: z.array(z.record(z.string(), z.unknown())).optional().nullable(),
    inducementsAway: z.array(z.record(z.string(), z.unknown())).optional().nullable(),
    prayersHome: z.array(z.record(z.string(), z.unknown())).optional().nullable(),
    prayersAway: z.array(z.record(z.string(), z.unknown())).optional().nullable(),
  })
  .refine(
    (v) => Object.keys(v).length > 0,
    "Au moins un champ d'avant-match requis",
  );
export type PreMatchBody = z.infer<typeof preMatchSchema>;
