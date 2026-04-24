import { z } from "zod";

/**
 * Schéma du payload webhook Ko-fi.
 *
 * Ko-fi envoie un `POST` en `application/x-www-form-urlencoded` avec un champ
 * unique `data` contenant le JSON complet. Ce schéma modélise le JSON interne.
 *
 * Références :
 * - https://help.ko-fi.com/hc/en-us/articles/360004162298-Does-Ko-fi-have-an-API-or-webhook
 * - n8n workflow "Process Ko-fi donations" (payload réel observé)
 */
export const kofiShopItemSchema = z.object({
  direct_link_code: z.string(),
  variation_name: z.string().optional().nullable(),
  quantity: z.number().int().positive().optional().default(1),
});

export const kofiWebhookPayloadSchema = z.object({
  verification_token: z.string().min(1),
  message_id: z.string().min(1),
  timestamp: z.string().min(1),
  type: z.enum(["Donation", "Subscription", "Commission", "Shop Order"]),
  is_public: z.boolean().optional().default(false),
  from_name: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  // Ko-fi envoie le montant en string décimale ("5.00", "12.50").
  amount: z.string().min(1),
  url: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  currency: z.string().min(1),
  is_subscription_payment: z.boolean().optional().default(false),
  is_first_subscription_payment: z.boolean().optional().default(false),
  kofi_transaction_id: z.string().min(1),
  // tier_name non fourni par Ko-fi pour les dons simples.
  tier_name: z.string().optional().nullable(),
  shop_items: z.array(kofiShopItemSchema).optional().nullable(),
  // Champs Discord (présents quand le donateur a lié Ko-fi à son compte Discord).
  // Servent à matcher la donation à un User si le compte cible a renseigné son Discord ID.
  discord_username: z.string().optional().nullable(),
  discord_userid: z.string().optional().nullable(),
});

export type KofiWebhookPayload = z.infer<typeof kofiWebhookPayloadSchema>;

/**
 * Convertit le champ `amount` (string décimale) en centimes (entier).
 * "5.00" → 500, "12.5" → 1250, "0.99" → 99.
 */
export function amountToCents(amount: string): number {
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid Ko-fi amount: ${amount}`);
  }
  return Math.round(parsed * 100);
}
