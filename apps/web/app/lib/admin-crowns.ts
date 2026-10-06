/**
 * Admin — Couronnes et wallets (wrappers typés de
 * `apps/server/src/routes/admin-crowns.ts`) + libellés PURS.
 */
import { apiRequest } from "./api-client";

export type WalletStatusFilter = "all" | "with" | "without";

/** Filtre initial lu dans `?status=` (lien « coachs sans wallet » de la page Couronnes). */
export function parseWalletStatus(raw: string | null): WalletStatusFilter {
  return raw === "with" || raw === "without" ? raw : "all";
}

export interface AdminWalletSummary {
  readonly crowns: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly transactions: number;
}

export interface AdminWalletRow {
  readonly id: string;
  readonly email: string;
  readonly coachName: string;
  readonly createdAt: string;
  /** `null` = le coach n'a pas de wallet. */
  readonly wallet: AdminWalletSummary | null;
}

export interface AdminWalletPage {
  readonly items: readonly AdminWalletRow[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly counts: { readonly all: number; readonly with: number; readonly without: number };
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function adminListWallets(query: {
  status?: WalletStatusFilter;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<AdminWalletPage> {
  return apiRequest<AdminWalletPage>(`/admin/wallets${qs(query)}`);
}

export interface CreateWalletResult {
  readonly created: boolean;
  readonly wallet: { readonly userId: string; readonly crowns: number; readonly createdAt: string };
}

export function adminCreateWallet(userId: string): Promise<CreateWalletResult> {
  return apiRequest<CreateWalletResult>(`/admin/wallets/${encodeURIComponent(userId)}`, { method: "POST" });
}

export function adminCreateMissingWallets(): Promise<{ created: number; remaining: number }> {
  return apiRequest(`/admin/wallets/create-missing`, { method: "POST" });
}

export interface CrownsFlow {
  readonly type: string;
  readonly count: number;
  readonly credited: number;
  readonly debited: number;
  readonly net: number;
}

export interface CrownsOverview {
  readonly supply: number;
  readonly wallets: number;
  readonly usersWithoutWallet: number;
  readonly days: number;
  readonly flows: { readonly allTime: readonly CrownsFlow[]; readonly recent: readonly CrownsFlow[] };
  readonly topHolders: ReadonlyArray<{
    readonly userId: string;
    readonly coachName: string;
    readonly email: string;
    readonly crowns: number;
  }>;
  readonly flag: { readonly exists: boolean; readonly enabled: boolean; readonly userOverrides: number };
}

export function adminGetCrownsOverview(days?: number): Promise<CrownsOverview> {
  return apiRequest<CrownsOverview>(`/admin/crowns/overview${qs({ days })}`);
}

export interface CrownsLedgerEntry {
  readonly id: string;
  readonly type: string;
  readonly amount: number;
  readonly ref: string | null;
  readonly createdAt: string;
  readonly user: { readonly id: string; readonly coachName: string; readonly email: string };
}

export interface CrownsLedgerPage {
  readonly items: readonly CrownsLedgerEntry[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export function adminListCrownsLedger(query: {
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<CrownsLedgerPage> {
  return apiRequest<CrownsLedgerPage>(`/admin/crowns/transactions${qs(query)}`);
}

/** Types du journal, dans l'ordre du serveur (`PRO_TX_TYPES`). */
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

const TX_TYPE_LABELS: Record<string, string> = {
  BET: "Mise de pari",
  WIN: "Gain de pari",
  REWARD: "Bonus de bienvenue",
  DAILY: "Bonus quotidien",
  BADGE: "Récompense de badge",
  SINK: "Dépense (boutique)",
  ADMIN_ADJUST: "Ajustement admin",
  ADMIN_REFUND: "Remboursement admin",
};

/** Libellé d'un type du journal (repli : le code brut). */
export function crownsTxTypeLabel(type: string): string {
  return TX_TYPE_LABELS[type] ?? type;
}

export type CrownsFlagState = "missing" | "off" | "overrides" | "on";

/**
 * État du flag `crowns` tel que l'admin doit le lire (PUR) :
 *  - `missing`   : la ligne n'existe pas en base — rien n'est activable tant
 *                  qu'on n'a pas synchronisé les flags depuis le code ;
 *  - `off`       : éteint pour tous ;
 *  - `overrides` : éteint globalement, ouvert à quelques comptes ;
 *  - `on`        : ouvert à tous.
 */
export function crownsFlagState(flag: CrownsOverview["flag"]): CrownsFlagState {
  if (!flag.exists) return "missing";
  if (flag.enabled) return "on";
  return flag.userOverrides > 0 ? "overrides" : "off";
}
