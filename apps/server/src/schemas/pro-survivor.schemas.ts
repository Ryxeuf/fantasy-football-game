/**
 * Schemas Zod — Sprint Q lot Q.D.2 (Survivor Pick'em).
 */

import { z } from "zod";

export const submitSurvivorPickSchema = z.object({
  seasonId: z.string().min(1),
  roundId: z.string().min(1),
  teamId: z.string().min(1),
});

export type SubmitSurvivorPickInput = z.infer<typeof submitSurvivorPickSchema>;
