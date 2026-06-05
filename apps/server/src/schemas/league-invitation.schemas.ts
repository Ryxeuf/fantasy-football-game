/**
 * Lot A — Zod schemas pour les routes d'invitation de ligue.
 */

import { z } from "zod";

export const createInvitationSchema = z
  .object({
    seasonId: z.string().min(1).optional(),
    inviteeUserId: z.string().min(1).optional(),
    inviteeEmail: z.string().email().optional(),
    inviteeTeamId: z.string().min(1).optional(),
    message: z.string().max(500).optional(),
    expiresInDays: z.number().int().min(1).max(90).optional(),
  })
  .refine(
    (v) => v.inviteeUserId || v.inviteeEmail || v.seasonId,
    "Au moins un des champs `inviteeUserId`, `inviteeEmail` ou `seasonId` est requis",
  );
export type CreateInvitationBody = z.infer<typeof createInvitationSchema>;

export const acceptInvitationSchema = z.object({
  teamId: z.string().min(1, "teamId requis"),
  seasonId: z.string().min(1).optional(),
});
export type AcceptInvitationBody = z.infer<typeof acceptInvitationSchema>;

export const searchCoachesQuerySchema = z.object({
  q: z.string().min(1).max(64),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  leagueId: z.string().min(1).optional(),
  seasonId: z.string().min(1).optional(),
});
export type SearchCoachesQuery = z.infer<typeof searchCoachesQuerySchema>;
