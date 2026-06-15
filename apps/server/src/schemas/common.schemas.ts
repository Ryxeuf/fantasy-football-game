import { z } from "zod";

/**
 * Schema partage pour les params de route `:id`.
 *
 * Permissif (non-vide) plutot que strict (cuid/uuid) pour ne pas casser
 * de liens/ids existants. `.passthrough()` preserve les autres params
 * d'une route multi-segments (ex : `/a/:id/b/:sub`) au lieu de les
 * effacer.
 */
export const idParamSchema = z
  .object({
    id: z.string().min(1, "id requis"),
  })
  .passthrough();
