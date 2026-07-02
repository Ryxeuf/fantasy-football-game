import { z } from "zod";

/**
 * Création d'une invitation de coupe. Tous les ciblages sont optionnels :
 *  - `inviteeUserId` : coach déjà inscrit (invitation personnelle) ;
 *  - `inviteeEmail` : coach hors plateforme ;
 *  - aucun des deux : lien public partageable (par `code`).
 */
export const createCupInvitationSchema = z.object({
  inviteeUserId: z.string().min(1).optional(),
  inviteeEmail: z.string().email().optional(),
  inviteeTeamId: z.string().min(1).optional(),
  message: z.string().max(500).optional(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});
export type CreateCupInvitationBody = z.infer<typeof createCupInvitationSchema>;

/** Acceptation : le coach choisit l'équipe (existante) à inscrire. */
export const acceptCupInvitationSchema = z.object({
  teamId: z.string().min(1, "teamId requis"),
});
export type AcceptCupInvitationBody = z.infer<typeof acceptCupInvitationSchema>;

/** Autocomplete de coachs (invitation personnelle). */
export const searchCoachesQuerySchema = z.object({
  q: z.string().min(1).max(64),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type SearchCoachesQuery = z.infer<typeof searchCoachesQuerySchema>;
