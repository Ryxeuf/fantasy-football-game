import { z } from "zod";

/**
 * Schemas de query/params pour les routes publiques `/api/positions`.
 *
 * GET non-mutant servi a des clients publics (SSR/ISR) : tous les champs
 * sont optionnels et `.passthrough()` ne supprime pas les cles inconnues,
 * pour ne jamais renvoyer un 400 sur un parametre superflu. `validateQuery`
 * se contente de normaliser/typer.
 */
export const positionsListQuerySchema = z
  .object({
    lang: z.enum(["fr", "en"]).optional(),
    ruleset: z.string().optional(),
    rosterSlug: z.string().optional(),
  })
  .passthrough();
export type PositionsListQuery = z.infer<typeof positionsListQuerySchema>;

export const positionDetailQuerySchema = z
  .object({
    lang: z.enum(["fr", "en"]).optional(),
    ruleset: z.string().optional(),
  })
  .passthrough();
export type PositionDetailQuery = z.infer<typeof positionDetailQuerySchema>;

export const positionSlugParamSchema = z
  .object({
    slug: z.string().min(1, "slug requis"),
  })
  .passthrough();
export type PositionSlugParam = z.infer<typeof positionSlugParamSchema>;
