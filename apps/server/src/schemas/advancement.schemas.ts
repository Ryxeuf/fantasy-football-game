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

// BB2025 (Saison 3) : la « secondaire au hasard » a ete retiree de la
// table des choix. L'amelioration de caracteristique devient un type
// d'avancement achetable a part entiere.
const advancementType = z.enum([
  "primary",
  "secondary",
  "random-primary",
  "characteristic",
]);

const characteristicStat = z.enum(["ma", "st", "ag", "pa", "av"]);

export const applyAdvancementSchema = z
  .object({
    type: advancementType,
    /**
     * Slug de la skill choisie. Obligatoire pour `primary` /
     * `secondary` (choix du coach), facultatif pour `random-primary`
     * (le serveur/le client tire au sort). Inutilise pour
     * `characteristic`.
     */
    skillSlug: z
      .string()
      .min(1, "skillSlug ne peut pas etre vide")
      .max(64, "skillSlug trop long")
      .regex(/^[a-z0-9_-]+$/i, "slug invalide")
      .optional(),
    /**
     * Caracteristique a ameliorer. Obligatoire (et uniquement utilise)
     * pour type=characteristic.
     */
    stat: characteristicStat.optional(),
    /**
     * Resultat du jet D8 (BB2025) qui restreint les caracteristiques
     * ameliorables. Obligatoire pour type=characteristic ; le serveur
     * verifie que `stat` fait partie des options de ce jet.
     */
    d8: z.number().int().min(1).max(8).optional(),
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
  )
  .refine(
    (v) => {
      if (v.type === "characteristic") {
        return v.stat !== undefined;
      }
      return true;
    },
    {
      message: "stat est obligatoire pour type=characteristic",
      path: ["stat"],
    },
  )
  .refine(
    (v) => {
      if (v.type === "characteristic") {
        return v.d8 !== undefined;
      }
      return true;
    },
    {
      message: "d8 est obligatoire pour type=characteristic (jet BB2025)",
      path: ["d8"],
    },
  );

export type ApplyAdvancementBody = z.infer<typeof applyAdvancementSchema>;
