import { z } from "zod";

export const emailDigestPreferenceSchema = z.object({
  enabled: z.boolean(),
});
