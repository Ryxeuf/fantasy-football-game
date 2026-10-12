import { z } from "zod";

import {
  API_KEY_MAX_EXPIRY_DAYS,
  API_KEY_SCOPES,
} from "../services/api-key-rules";

/** Expiration proposée quand le client n'en précise aucune. */
export const DEFAULT_API_KEY_EXPIRY_DAYS = 90;

/**
 * `POST /admin/api-keys`. La portée par défaut est la LECTURE SEULE et
 * l'expiration par défaut 90 jours : une clé « sans expiration » ou « en
 * écriture » se demande explicitement (`expiresInDays: null`,
 * `scope: "write"`).
 */
export const createApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nom requis")
    .max(80, "80 caractères au plus"),
  scope: z.enum(API_KEY_SCOPES).default("read"),
  expiresInDays: z
    .number()
    .int()
    .min(1)
    .max(API_KEY_MAX_EXPIRY_DAYS)
    .nullable()
    .default(DEFAULT_API_KEY_EXPIRY_DAYS),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
