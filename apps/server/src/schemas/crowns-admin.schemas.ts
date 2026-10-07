import { z } from "zod";

/** Filtre de la liste admin des wallets : tous, avec wallet, sans wallet. */
export const WALLET_STATUS_FILTERS = ["all", "with", "without"] as const;
export type WalletStatusFilter = (typeof WALLET_STATUS_FILTERS)[number];

export const adminWalletListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(WALLET_STATUS_FILTERS).default("all"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type AdminWalletListQuery = z.infer<typeof adminWalletListQuerySchema>;

export const adminWalletParamsSchema = z.object({
  userId: z.string().trim().min(1).max(64),
});

/**
 * Types du journal des Crowns (`ProTransaction.type`). Miroir de `ProTxType`
 * (`services/pro-wallet`) ; le test du service vérifie qu'ils ne divergent pas.
 */
export const CROWNS_TX_TYPES = [
  "BET",
  "WIN",
  "REWARD",
  "DAILY",
  "BADGE",
  "SINK",
  "ADMIN_ADJUST",
  "ADMIN_REFUND",
] as const;

export const adminCrownsLedgerQuerySchema = z.object({
  type: z.enum(CROWNS_TX_TYPES).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AdminCrownsLedgerQuery = z.infer<typeof adminCrownsLedgerQuerySchema>;

export const adminCrownsOverviewQuerySchema = z.object({
  /** Fenêtre des flux « récents », en jours. */
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type AdminCrownsOverviewQuery = z.infer<typeof adminCrownsOverviewQuerySchema>;
