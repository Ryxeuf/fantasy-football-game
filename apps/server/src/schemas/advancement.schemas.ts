/**
 * L2.B.3 — Sprint Ligues v2 PR4 : Zod schemas pour les endpoints
 * `/team/:teamId/players/:playerId/advancement`.
 *
 * Le `type` decide du cout en SPP et du surcoût en TV (cf
 * `packages/game-engine/src/utils/advancements.ts`). Le `skillSlug`
 * doit etre present pour les types `primary` et `secondary` (le
 * coach choisit). Pour les types `random-*`, le caller (handler)
 * tire la skill au sort cote serveur.
 */

import { z } from "zod";

const advancementType = z.enum([
  "primary",
  "secondary",
  "random-primary",
  "random-secondary",
]);

export const applyAdvancementSchema = z
  .object({
    type: advancementType,
    /**
     * Slug de la skill choisie. Obligatoire pour `primary` /
     * `secondary` (choix du coach), facultatif pour `random-*`
     * (le serveur tire au sort).
     */
    skillSlug: z
      .string()
      .min(1, "skillSlug ne peut pas etre vide")
      .max(64, "skillSlug trop long")
      .regex(/^[a-z0-9_-]+$/i, "slug invalide")
      .optional(),
  })
  .refine(
    (v) => {
      if (v.type === "primary" || v.type === "secondary") {
        return typeof v.skillSlug === "string" && v.skillSlug.length > 0;
      }
      return true;
    },
    {
      message:
        "skillSlug est obligatoire pour type=primary ou secondary (choix du coach)",
      path: ["skillSlug"],
    },
  );

export type ApplyAdvancementBody = z.infer<typeof applyAdvancementSchema>;
