import { z } from "zod";

/**
 * POST /pro-league/gazette/articles/:id/comments — creation d'un
 * commentaire. Le corps doit contenir `body` (chaine). Les regles de
 * longueur (BODY_EMPTY / BODY_TOO_LONG) restent portees par le service
 * `createComment` — le schema valide la forme.
 */
export const createCommentSchema = z.object({
  body: z.string(),
});
