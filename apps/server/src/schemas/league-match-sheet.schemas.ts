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
    "team_throw",
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
  /** Mi-temps de l'evenement (1 ou 2). Fusionne dans meta.half. */
  half: z.number().int().min(1).max(2).optional().nullable(),
  /** Tour de l'evenement (1..16). Fusionne dans meta.turn. */
  turn: z.number().int().min(1).max(16).optional().nullable(),
  meta: z.record(z.string(), z.unknown()).optional().nullable(),
})
  // A67/A68 — une Sequelle (stat_loss) sans caracteristique visee etait
  // silencieusement droppee a l'application sur le roster. On refuse
  // l'event a la saisie plutot que de perdre la blessure.
  .superRefine((v, ctx) => {
    if (v.injurySeverity !== "stat_loss") return;
    const rawStat =
      v.meta && typeof v.meta === "object"
        ? (v.meta as Record<string, unknown>).stat
        : undefined;
    const stat = typeof rawStat === "string" ? rawStat.toLowerCase() : "";
    if (!["ma", "st", "ag", "pa", "av"].includes(stat)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meta", "stat"],
        message:
          "Une Séquelle (stat_loss) requiert la caractéristique affectée (meta.stat parmi ma/st/ag/pa/av)",
      });
    }
  });
export type AddEventBody = z.infer<typeof addEventSchema>;

// Prières à Nuffle (coup de pouce 0-3, S2025) : chaque entrée = un jet de
// D16 sur la table des Prières. Les doublons sont relancés à la table,
// donc interdits ici.
const prayerEntrySchema = z.object({
  roll: z.number().int().min(1).max(16),
  prayerId: z.string().max(64).optional().nullable(),
});
const prayersSchema = z
  .array(prayerEntrySchema)
  .max(3, "Maximum 3 Prières à Nuffle par équipe")
  .refine(
    (l) => new Set(l.map((e) => e.roll)).size === l.length,
    "Doublon de jet de D16 : les résultats déjà obtenus se relancent",
  )
  .optional()
  .nullable();

export const preMatchSchema = z
  .object({
    weatherTable: z.string().max(64).optional().nullable(),
    weather: z.string().max(64).optional().nullable(),
    popularityHome: z.number().int().min(0).max(20).optional().nullable(),
    popularityAway: z.number().int().min(0).max(20).optional().nullable(),
    forfeitSide: z.enum(["home", "away"]).optional().nullable(),
    /** Toss d'avant-match : côté vainqueur + son choix (engager/recevoir). */
    tossWinner: z.enum(["home", "away"]).optional().nullable(),
    tossChoice: z.enum(["kick", "receive"]).optional().nullable(),
    inducementsHome: z.array(z.record(z.string(), z.unknown())).optional().nullable(),
    inducementsAway: z.array(z.record(z.string(), z.unknown())).optional().nullable(),
    prayersHome: prayersSchema,
    prayersAway: prayersSchema,
  })
  .refine(
    (v) => Object.keys(v).length > 0,
    "Au moins un champ d'avant-match requis",
  );
export type PreMatchBody = z.infer<typeof preMatchSchema>;

// Polish — apres-match : override tresorerie, fans, erreurs couteuses,
// achats, MVP.
const MAX_GOLD = 10_000_000;

/**
 * Achat post-match. `position` (slug roster) et `staff` (sous-type)
 * sont optionnels : ils permettent de MATERIALISER precisement l'element
 * achete (joueur d'une position donnee / type de staff). A defaut, le
 * serveur tente de resoudre par cout (joueur) ou par libelle (staff).
 */
const purchaseSchema = z.object({
  kind: z.enum(["player", "reroll", "staff", "other"]),
  name: z.string().max(120),
  cost: z.number().int().min(0).max(MAX_GOLD),
  position: z.string().max(64).optional().nullable(),
  staff: z
    .enum(["assistant", "cheerleader", "apothecary", "dedicated_fan"])
    .optional()
    .nullable(),
  number: z.number().int().min(1).max(99).optional().nullable(),
});

// Évolutions saisies pendant la feuille de match (staging) : appliquées
// aux rosters uniquement à la validation commissaire. Une seule évolution
// par joueur et par match (le tirage random-primary est seedé sur le
// nombre d'avancements pris : plusieurs entrées le fausseraient).
const stagedAdvancementSchema = z
  .object({
    playerId: z.string().min(1).max(64),
    type: z.enum(["primary", "secondary", "random-primary", "characteristic"]),
    skillSlug: z.string().max(64).optional().nullable(),
    category: z.string().max(2).optional().nullable(),
    stat: z.enum(["ma", "st", "ag", "pa", "av"]).optional().nullable(),
    d8: z.number().int().min(1).max(8).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "characteristic") {
      if (!v.stat)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stat"],
          message: "stat requise pour une amélioration de caractéristique",
        });
      if (typeof v.d8 !== "number")
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["d8"],
          message: "d8 requis pour une amélioration de caractéristique",
        });
      return;
    }
    if (!v.skillSlug || v.skillSlug.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["skillSlug"],
        message: "skillSlug requis pour une évolution de compétence",
      });
    }
    if (v.type === "random-primary" && !v.category) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: "category requise pour un tirage aléatoire",
      });
    }
  });

const stagedAdvancementsSchema = z
  .array(stagedAdvancementSchema)
  .max(32)
  .refine(
    (l) => new Set(l.map((e) => e.playerId)).size === l.length,
    "Une seule évolution par joueur et par match",
  )
  .optional()
  .nullable();

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
    purchasesHome: z.array(purchaseSchema).optional().nullable(),
    purchasesAway: z.array(purchaseSchema).optional().nullable(),
    motmPlayerIds: z.array(z.string().min(1)).max(20).optional(),
    /** Licenciements de fin de match : [teamPlayerId]. */
    firedPlayerIds: z.array(z.string().min(1)).max(32).optional().nullable(),
    /** Évolutions stagées par coach (appliquées à la validation). */
    advancementsHome: stagedAdvancementsSchema,
    advancementsAway: stagedAdvancementsSchema,
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
