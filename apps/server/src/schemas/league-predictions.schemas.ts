/**
 * Pronostics de ligue — schémas Zod des routes `routes/league-predictions`.
 *
 * Forme seulement : la SÉMANTIQUE (score donné pour les deux côtés, score
 * cohérent avec le vainqueur) est tranchée par le module pur
 * `services/league-predictions-rules`, qui la sert aussi à la lecture.
 */

import { z } from "zod";
import {
  MAX_PREDICTED_SCORE,
  PREDICTION_PICKS,
  PREDICTION_SCOPES,
} from "../services/league-predictions-rules";

const predictedScore = z
  .number()
  .int("Le score est un nombre entier de touchdowns")
  .min(0)
  .max(MAX_PREDICTED_SCORE);

/** `PUT /leagues/pairings/:pairingId/prediction`. */
export const predictionUpsertSchema = z.object({
  pick: z.enum(PREDICTION_PICKS),
  homeScore: predictedScore.nullable().optional(),
  awayScore: predictedScore.nullable().optional(),
});

export type PredictionUpsertBody = z.infer<typeof predictionUpsertSchema>;

/**
 * `PATCH /leagues/:id/predictions-scope`. Champ OBLIGATOIRE : un body vide ne
 * doit rien changer par accident.
 */
export const predictionsScopeSchema = z.object({
  scope: z.enum(PREDICTION_SCOPES),
});

export type PredictionsScopeBody = z.infer<typeof predictionsScopeSchema>;
