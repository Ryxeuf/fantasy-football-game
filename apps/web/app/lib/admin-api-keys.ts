/**
 * Admin — clés API d'administration (wrappers typés de
 * `apps/server/src/routes/admin-api-keys.ts`) + libellés PURS.
 *
 * Change OpenSpec `admin-api-keys`, doc `docs/admin-api-keys.md`.
 */
import { apiRequest } from "./api-client";

export type ApiKeyScope = "read" | "write";
export type ApiKeyStatus = "active" | "revoked" | "expired";

export interface AdminApiKey {
  readonly id: string;
  readonly name: string;
  /** 12 premiers caractères du secret (`nak_Ab12Cd34`). */
  readonly keyPrefix: string;
  readonly scope: ApiKeyScope;
  readonly status: ApiKeyStatus;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly lastUsedAt: string | null;
  readonly lastUsedIp: string | null;
  readonly revokedAt: string | null;
  readonly revokedById: string | null;
  readonly owner: { readonly id: string; readonly coachName: string; readonly email: string } | null;
}

export interface CreateApiKeyInput {
  readonly name: string;
  readonly scope: ApiKeyScope;
  /** `null` = sans expiration. */
  readonly expiresInDays: number | null;
}

export interface CreatedApiKey {
  readonly key: AdminApiKey;
  /** Le secret complet : renvoyé UNE fois, jamais relisible. */
  readonly secret: string;
}

export async function adminListApiKeys(): Promise<AdminApiKey[]> {
  const { keys } = await apiRequest<{ keys: AdminApiKey[] }>("/admin/api-keys");
  return keys;
}

export function adminCreateApiKey(input: CreateApiKeyInput): Promise<CreatedApiKey> {
  return apiRequest<CreatedApiKey>("/admin/api-keys", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function adminRevokeApiKey(
  id: string,
): Promise<{ key: AdminApiKey; alreadyRevoked: boolean }> {
  return apiRequest(`/admin/api-keys/${encodeURIComponent(id)}/revoke`, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Libellés purs
// ---------------------------------------------------------------------------

/** Expiration présélectionnée dans le formulaire (même défaut que le serveur). */
export const DEFAULT_API_KEY_EXPIRY_DAYS = 90;

export const API_KEY_EXPIRY_OPTIONS: ReadonlyArray<{
  readonly value: number | null;
  readonly label: string;
}> = [
  { value: 7, label: "7 jours" },
  { value: 30, label: "30 jours" },
  { value: 90, label: "90 jours" },
  { value: 365, label: "1 an" },
  { value: null, label: "Sans expiration" },
];

/** Valeur d'`<option>` ⇔ nombre de jours (`""` = sans expiration). */
export function expiryOptionValue(days: number | null): string {
  return days === null ? "" : String(days);
}

export function parseExpiryOption(raw: string): number | null {
  if (raw === "") return null;
  const days = Number.parseInt(raw, 10);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_API_KEY_EXPIRY_DAYS;
}

export function apiKeyScopeLabel(scope: ApiKeyScope): string {
  return scope === "write" ? "Lecture et écriture" : "Lecture seule";
}

export function apiKeyStatusLabel(status: ApiKeyStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "revoked":
      return "Révoquée";
    case "expired":
      return "Expirée";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function apiKeyExpiryLabel(key: Pick<AdminApiKey, "expiresAt" | "status">): string {
  if (!key.expiresAt) return "Sans expiration";
  const date = formatDate(key.expiresAt);
  return key.status === "expired" ? `Expirée le ${date}` : `Expire le ${date}`;
}

export function apiKeyLastUsedLabel(key: Pick<AdminApiKey, "lastUsedAt" | "lastUsedIp">): string {
  if (!key.lastUsedAt) return "Jamais utilisée";
  const when = formatDateTime(key.lastUsedAt);
  return key.lastUsedIp ? `${when} (${key.lastUsedIp})` : when;
}

/**
 * Variables à déclarer dans l'environnement du client (environnement cloud
 * Claude Code, CI…). Lues par `pnpm smoke:remote`.
 */
export function apiKeyEnvSnippet(apiBase: string, secret: string): string {
  return `NUFFLE_API_URL=${apiBase.replace(/\/+$/, "")}\nNUFFLE_API_KEY=${secret}`;
}
