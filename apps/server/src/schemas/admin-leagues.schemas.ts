/**
 * L2.C.6 — Sprint Ligues v2 PR10 : Zod schemas pour les routes
 * `/admin/leagues/*`.
 *
 * Le réordonnancement des critères de classement n'y figure pas : son schéma
 * est PARTAGÉ avec la route du commissaire
 * (`schemas/league.schemas.leagueStandingsOrderSchema`) — deux copies
 * auraient divergé au premier critère ajouté.
 */

import { z } from "zod";
import { createLeagueSchema } from "./league.schemas";

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

/**
 * PATCH /admin/leagues/:id — édition d'une ligue par un administrateur.
 *
 * Sous-ensemble de `createLeagueSchema` (mêmes bornes) : identité, capacité,
 * visibilité et barème. L'édition (`ruleset`), le règlement de tournoi et
 * les rosters autorisés n'y figurent pas : les équipes inscrites ont été
 * construites POUR eux. Le barème reste soumis au verrou « un match a été
 * scoré » (cf. route) ; la visibilité, elle, est une règle de LECTURE et se
 * change à tout moment.
 */
export const adminLeagueUpdateSchema = createLeagueSchema
  .pick({
    name: true,
    description: true,
    isPublic: true,
    maxParticipants: true,
    winPoints: true,
    drawPoints: true,
    lossPoints: true,
    forfeitPoints: true,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ a modifier est requis",
  });

export type AdminLeagueUpdateBody = z.infer<typeof adminLeagueUpdateSchema>;
