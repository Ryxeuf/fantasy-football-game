import { z } from "zod";

/** Tailles de bracket supportées : 0 (aucun), finale, demies, quarts. */
export const CUP_PLAYOFF_SIZES = [0, 2, 4, 8] as const;

export const startCupPlayoffsSchema = z
  .object({
    /**
     * Clôt les rencontres de classement encore ouvertes (annulées) avant de
     * générer. Acte explicite : sans lui, un bracket seedé sur un classement
     * incomplet serait faux.
     */
    force: z.boolean().optional(),
  })
  .default({});
export type StartCupPlayoffsBody = z.infer<typeof startCupPlayoffsSchema>;

export const publishCupPlayoffsSchema = z.object({
  published: z.boolean(),
});
export type PublishCupPlayoffsBody = z.infer<typeof publishCupPlayoffsSchema>;

export const cupPlayoffSeedsSchema = z.object({
  /** Têtes de série, de la 1re à la dernière. Longueur validée au service. */
  teamIds: z.array(z.string().min(1).max(64)).min(2).max(8),
});
export type CupPlayoffSeedsBody = z.infer<typeof cupPlayoffSeedsSchema>;
