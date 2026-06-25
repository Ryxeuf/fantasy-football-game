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
    weatherTable: z.string().max(64).optional().nullable(),
    weather: z.string().max(64).optional().nullable(),
    popularityHome: z.number().int().min(0).max(20).optional().nullable(),
    popularityAway: z.number().int().min(0).max(20).optional().nullable(),
    forfeitSide: z.enum(["home", "away"]).optional().nullable(),
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

// Polish — apres-match : override tresorerie, fans, erreurs couteuses,
// achats, MVP.
const MAX_GOLD = 10_000_000;
export const postMatchSchema = z
  .object({
    winningsHomeManual: z.number().int().min(0).max(MAX_GOLD).optional().nullable(),
    winningsAwayManual: z.number().int().min(0).max(MAX_GOLD).optional().nullable(),
    dedicatedFansDeltaHome: z.number().int().min(-6).max(6).optional().nullable(),
    dedicatedFansDeltaAway: z.number().int().min(-6).max(6).optional().nullable(),
    rankingBonusHome: z.number().int().min(-50).max(50).optional().nullable(),
    rankingBonusAway: z.number().int().min(-50).max(50).optional().nullable(),
    sppBonus: z
      .array(
        z.object({
          playerId: z.string().min(1),
          spp: z.number().int().min(0).max(20),
        }),
      )
      .optional()
      .nullable(),
    costlyErrorsHome: z
      .array(
        z.object({
          playerId: z.string().min(1).optional(),
          cost: z.number().int().min(0).max(MAX_GOLD),
          reason: z.string().max(120).optional(),
        }),
      )
      .optional()
      .nullable(),
    costlyErrorsAway: z
      .array(
        z.object({
          playerId: z.string().min(1).optional(),
          cost: z.number().int().min(0).max(MAX_GOLD),
          reason: z.string().max(120).optional(),
        }),
      )
      .optional()
      .nullable(),
    purchasesHome: z
      .array(
        z.object({
          kind: z.enum(["player", "reroll", "staff", "other"]),
          name: z.string().max(120),
          cost: z.number().int().min(0).max(MAX_GOLD),
        }),
      )
      .optional()
      .nullable(),
    purchasesAway: z
      .array(
        z.object({
          kind: z.enum(["player", "reroll", "staff", "other"]),
          name: z.string().max(120),
          cost: z.number().int().min(0).max(MAX_GOLD),
        }),
      )
      .optional()
      .nullable(),
    motmPlayerIds: z.array(z.string().min(1)).max(20).optional(),
  })
  .refine(
    (v) => Object.keys(v).length > 0,
    "Au moins un champ d'apres-match requis",
  );
export type PostMatchBody = z.infer<typeof postMatchSchema>;

export const invalidateSheetSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type InvalidateSheetBody = z.infer<typeof invalidateSheetSchema>;
