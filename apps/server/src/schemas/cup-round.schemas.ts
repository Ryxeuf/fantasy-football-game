import { z } from "zod";
import { CUP_ROUND_SYSTEMS } from "../services/cup-round-systems";

/**
 * Génération d'une ronde de coupe (`POST /cup/:id/rounds`).
 *
 * `system` par défaut `swiss` : c'est ce que faisait l'unique route
 * historique (`/rounds/swiss`), et un corps vide doit continuer de générer
 * une ronde suisse.
 *
 * `pairings` n'a de sens qu'en saisie manuelle et le refine l'impose : une
 * saisie manuelle sans rencontres est une erreur d'appel, pas une ronde
 * vide. `awayTeamId: null` déclare l'équipe exemptée.
 */
export const generateCupRoundSchema = z
  .object({
    system: z.enum(CUP_ROUND_SYSTEMS).optional().default("swiss"),
    pairings: z
      .array(
        z.object({
          homeTeamId: z.string().min(1).max(64),
          awayTeamId: z.string().min(1).max(64).nullable().optional(),
        }),
      )
      .min(1)
      .max(128)
      .optional(),
  })
  .refine((v) => v.system !== "manual" || (v.pairings?.length ?? 0) > 0, {
    message: "Saisie manuelle : au moins une rencontre est requise",
    path: ["pairings"],
  });

export type GenerateCupRoundBody = z.infer<typeof generateCupRoundSchema>;
