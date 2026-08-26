/**
 * Schémas Zod des routes `/admin/team-journal/*` (recherche transversale
 * du journal d'équipe).
 *
 * Toute la coercition vit ici : les handlers consomment un objet déjà typé
 * (`z.infer`) et ne recastent jamais `req.query`, pour que tout drift
 * schéma/handler échoue à `tsc` plutôt qu'en prod.
 */

import { z } from "zod";

import {
  MAX_EXPORT_ROWS,
  MAX_SEARCH_PAGE_SIZE,
} from "../services/team-audit-search";

/** Cases à cocher de l'UI : `?onlyEconomic=1` comme `?onlyEconomic=true`. */
const boolFlag = z
  .enum(["1", "0", "true", "false"])
  .optional()
  .transform((v) => v === "1" || v === "true");

/** Chaîne de filtre : trimée, bornée, et `""` traité comme absent. */
const filterText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

export const auditSortOrders = z.enum([
  "recent",
  "oldest",
  "treasury-impact",
  "team-value-impact",
]);

/** Filtres partagés par la liste, l'export et les agrégats. */
const baseFilters = {
  teamId: filterText(64),
  teamSearch: filterText(100),
  ownerId: filterText(64),
  actorUserId: filterText(64),
  action: filterText(120),
  actionPrefix: filterText(120),
  actorRole: z
    .enum(["owner", "admin", "commissioner", "system", "anonymous"])
    .optional(),
  source: z.enum(["http", "job", "script", "test"]).optional(),
  entity: z.enum(["Team", "TeamPlayer", "TeamStarPlayer"]).optional(),
  entityId: filterText(64),
  correlationId: filterText(128),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  onlyEconomic: boolFlag,
  onlyFailed: boolFlag,
  onlyImpersonated: boolFlag,
  /** Seuils en po (pas en kpo) : un export sert à calculer. */
  minAbsTreasuryDelta: z.coerce.number().int().min(0).optional(),
  minAbsTeamValueDelta: z.coerce.number().int().min(0).optional(),
  q: filterText(200),
  deep: boolFlag,
};

export const adminTeamJournalQuerySchema = z.object({
  ...baseFilters,
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_SEARCH_PAGE_SIZE)
    .optional()
    .default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  order: auditSortOrders.optional().default("recent"),
});

export const adminTeamJournalExportQuerySchema = z.object({
  ...baseFilters,
  format: z.enum(["csv", "ndjson"]).optional().default("csv"),
  /**
   * Un export est plafonné : au-delà, resserrer les filtres ou paginer.
   * Mieux vaut un refus explicite qu'un fichier tronqué en silence.
   */
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_EXPORT_ROWS)
    .optional()
    .default(MAX_EXPORT_ROWS),
  offset: z.coerce.number().int().min(0).optional().default(0),
  order: auditSortOrders.optional().default("recent"),
});

export const adminTeamJournalStatsQuerySchema = z.object({
  ...baseFilters,
  topN: z.coerce.number().int().min(1).max(50).optional().default(15),
});

export type AdminTeamJournalQuery = z.infer<typeof adminTeamJournalQuerySchema>;
export type AdminTeamJournalExportQuery = z.infer<
  typeof adminTeamJournalExportQuerySchema
>;
export type AdminTeamJournalStatsQuery = z.infer<
  typeof adminTeamJournalStatsQuerySchema
>;
