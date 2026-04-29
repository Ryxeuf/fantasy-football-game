import { z } from "zod";

/**
 * Schemas Zod pour les endpoints du systeme d'amis.
 * Regles :
 *  - Pas d'auto-amitie (valide dans le service apres avoir compare avec req.user.id)
 *  - receiverId obligatoire et non vide pour les POST
 *  - listingstatus filtre optionnel
 */

/**
 * S26.4b — Le client peut envoyer soit `receiverId` (userId interne,
 * historique) soit `username` (pseudo de coach, nouveau). La route
 * resoud `username -> userId` via `findUserByCoachName`.
 */
export const sendFriendRequestSchema = z
  .object({
    receiverId: z.string().min(1).optional(),
    username: z.string().min(1).optional(),
  })
  .refine(
    (data) => Boolean(data.receiverId) !== Boolean(data.username),
    {
      message: "fournir exactement un de receiverId ou username",
    },
  );

export const respondFriendRequestSchema = z.object({
  action: z.enum(["accept", "decline"], {
    message: "action doit etre 'accept' ou 'decline'",
  }),
});

export const listFriendshipsQuerySchema = z.object({
  status: z.enum(["pending", "accepted", "declined", "blocked"]).optional(),
});

export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
export type RespondFriendRequestInput = z.infer<
  typeof respondFriendRequestSchema
>;
export type ListFriendshipsQuery = z.infer<typeof listFriendshipsQuerySchema>;
