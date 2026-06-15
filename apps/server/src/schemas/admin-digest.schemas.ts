import { z } from "zod";

/**
 * POST /admin/digest/run — declenchement manuel du digest hebdo.
 * Body optionnel : `force=true` ignore la fenetre d'idempotence.
 */
export const runDigestSchema = z.object({
  force: z.boolean().optional(),
});
