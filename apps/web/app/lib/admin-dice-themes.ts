/**
 * Admin — thèmes de dés et cosmétiques des coachs (wrappers typés de
 * `apps/server/src/routes/admin-dice-themes.ts`). Les Crowns s'ajustent par
 * la route wallet existante (`adjustCoachCrowns`).
 */
import { apiRequest } from "./api-client";
import type { CrownsTransaction } from "../contexts/CrownsContext";

export interface LocalizedText {
  readonly fr: string;
  readonly en: string;
}

export interface DiceThemeStats {
  readonly owners: number;
  readonly purchases: number;
  readonly gifts: number;
  readonly selectedBy: number;
  readonly revenueCrowns: number;
}

export interface AdminDiceTheme {
  readonly id: string;
  readonly collection: "classic" | "team";
  readonly priceCrowns: number | null;
  readonly enabled: boolean;
  readonly sortOrder: number;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly isDefault: boolean;
  readonly inDatabase: boolean;
  readonly compiled: {
    readonly priceCrowns: number | null;
    readonly enabled: boolean;
    readonly name: LocalizedText;
  };
  readonly stats: DiceThemeStats;
}

export interface DiceThemePatch {
  nameFr?: string;
  nameEn?: string;
  descriptionFr?: string | null;
  descriptionEn?: string | null;
  priceCrowns?: number | null;
  enabled?: boolean;
  sortOrder?: number;
}

export async function adminListDiceThemes(): Promise<AdminDiceTheme[]> {
  const res = await apiRequest<{ themes: AdminDiceTheme[] }>("/admin/dice-themes");
  return res.themes;
}

export async function adminUpdateDiceTheme(id: string, patch: DiceThemePatch): Promise<AdminDiceTheme> {
  const res = await apiRequest<{ theme: AdminDiceTheme }>(`/admin/dice-themes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return res.theme;
}

export async function adminResetDiceTheme(id: string): Promise<AdminDiceTheme> {
  const res = await apiRequest<{ theme: AdminDiceTheme }>(`/admin/dice-themes/${encodeURIComponent(id)}/reset`, {
    method: "POST",
  });
  return res.theme;
}

export interface CoachCosmeticsRow {
  readonly id: string;
  readonly email: string;
  readonly coachName: string;
  readonly crowns: number;
  readonly acquiredThemes: number;
  readonly diceTheme: string | null;
}

export interface CoachCosmeticsPage {
  readonly items: readonly CoachCosmeticsRow[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export async function adminListCoachCosmetics(query: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<CoachCosmeticsPage> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return apiRequest<CoachCosmeticsPage>(`/admin/coach-cosmetics${qs ? `?${qs}` : ""}`);
}

export interface CoachThemeAcquisition {
  readonly themeId: string;
  readonly source: string;
  readonly priceCrowns: number | null;
  readonly grantedById: string | null;
  readonly createdAt: string;
  readonly known: boolean;
}

export interface CoachCosmeticsDetail {
  readonly user: { readonly id: string; readonly email: string; readonly coachName: string };
  readonly crowns: number;
  readonly storedThemeId: string | null;
  readonly effectiveThemeId: string;
  readonly acquisitions: readonly CoachThemeAcquisition[];
  readonly themes: ReadonlyArray<{
    readonly id: string;
    readonly name: LocalizedText;
    readonly collection: string;
    readonly priceCrowns: number | null;
    readonly enabled: boolean;
    readonly owned: boolean;
    readonly free: boolean;
  }>;
  readonly transactions: readonly CrownsTransaction[];
}

function coachPath(userId: string): string {
  return `/admin/coach-cosmetics/${encodeURIComponent(userId)}`;
}

export function adminGetCoachCosmetics(userId: string): Promise<CoachCosmeticsDetail> {
  return apiRequest<CoachCosmeticsDetail>(coachPath(userId));
}

export function adminGrantDiceTheme(userId: string, themeId: string): Promise<CoachCosmeticsDetail> {
  return apiRequest<CoachCosmeticsDetail>(`${coachPath(userId)}/dice-themes/${encodeURIComponent(themeId)}`, {
    method: "POST",
  });
}

export function adminRevokeDiceTheme(
  userId: string,
  themeId: string,
  refund: boolean,
): Promise<CoachCosmeticsDetail & { refunded: number }> {
  return apiRequest(`${coachPath(userId)}/dice-themes/${encodeURIComponent(themeId)}`, {
    method: "DELETE",
    body: JSON.stringify({ refund }),
  });
}

export function adminSetCoachDiceTheme(userId: string, themeId: string | null): Promise<CoachCosmeticsDetail> {
  return apiRequest<CoachCosmeticsDetail>(`${coachPath(userId)}/dice-theme`, {
    method: "PUT",
    body: JSON.stringify({ themeId }),
  });
}

/** Ajustement du solde par la route wallet existante (journal `ADMIN_ADJUST`). */
export function adjustCoachCrowns(userId: string, delta: number, reason: string): Promise<unknown> {
  return apiRequest(`/admin/wallets/${encodeURIComponent(userId)}/balance`, {
    method: "PATCH",
    body: JSON.stringify({ delta, reason }),
  });
}

/** Libellé d'une source d'acquisition. */
export function acquisitionSourceLabel(source: string): string {
  if (source === "purchase") return "Achat";
  if (source === "admin_grant") return "Cadeau admin";
  return source;
}
