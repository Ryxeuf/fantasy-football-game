/**
 * Schemas Zod — Sprint Q lot Q.D.1 (mini-ligues de pronostics).
 *
 * Sépare ces schemas du fichier `admin.schemas.ts` parce qu'ils sont
 * user-facing (pas admin-only).
 */

import { z } from "zod";

export const createPredictionLeagueSchema = z.object({
  name: z.string().trim().min(3).max(50),
  isPrivate: z.boolean().optional(),
});

export const joinPredictionLeagueSchema = z.object({
  joinCode: z.string().trim().min(1).max(20),
});

export const submitPredictionPickSchema = z.object({
  matchId: z.string().min(1),
  selection: z.enum(["home", "draw", "away"]),
});
