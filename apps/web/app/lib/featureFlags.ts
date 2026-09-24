import { apiRequest } from "./api-client";

export interface FeatureFlag {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  userOverrideCount: number;
  /**
   * Faux quand la clé n'est plus déclarée dans le code (flag retiré) : la
   * ligne ne gate plus rien et peut être supprimée. Optionnel pour rester
   * compatible avec un serveur qui ne l'expose pas encore.
   */
  knownInCode?: boolean;
}

/**
 * Vrai si le serveur signale le flag comme absent du code. Un champ absent
 * (serveur antérieur) n'est PAS lu comme « absent du code ».
 */
export function isFlagMissingFromCode(flag: Pick<FeatureFlag, "knownInCode">): boolean {
  return flag.knownInCode === false;
}

/** Bandeau du panneau admin listant les flags que le code n'utilise plus. */
export function missingFromCodeNotice(keys: readonly string[]): string {
  const list = keys.join(", ");
  if (keys.length === 1) {
    return `Le flag ${list} n'est plus utilisé par le code : il ne gate plus rien et peut être supprimé.`;
  }
  return `${keys.length} flags ne sont plus utilisés par le code (${list}) : ils ne gatent plus rien et peuvent être supprimés.`;
}

export interface FeatureFlagUser {
  id: string;
  userId: string;
  email: string;
  coachName: string;
  createdAt: string;
}

// S25.5b — request<T> remplace par apiRequest<T> partage (lib/api-client).
// L'ancienne implementation locale est supprimee : elle dupliquait l'auth
// header et le parse de l'enveloppe `{ success, data, error }`.
const request = apiRequest;

// ── API utilisateur ────────────────────────────────────────────────

export async function fetchMyFlags(): Promise<string[]> {
  return request<string[]>("/api/feature-flags/me");
}

// ── API admin ──────────────────────────────────────────────────────

export async function adminListFlags(): Promise<FeatureFlag[]> {
  return request<FeatureFlag[]>("/admin/feature-flags");
}

export async function adminCreateFlag(input: {
  key: string;
  description?: string | null;
  enabled?: boolean;
}): Promise<FeatureFlag> {
  return request<FeatureFlag>("/admin/feature-flags", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function adminUpdateFlag(
  id: string,
  input: { description?: string | null; enabled?: boolean },
): Promise<FeatureFlag> {
  return request<FeatureFlag>(`/admin/feature-flags/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function adminDeleteFlag(id: string): Promise<void> {
  await request<{ id: string }>(`/admin/feature-flags/${id}`, {
    method: "DELETE",
  });
}

export interface SyncFlagsResult {
  created: string[];
  skipped: string[];
  total: number;
}

/**
 * Crée en base les feature flags déclarés dans le code mais absents de la
 * BDD. Idempotent : ne modifie pas les flags déjà présents.
 */
export async function adminSyncFlags(): Promise<SyncFlagsResult> {
  return request<SyncFlagsResult>("/admin/feature-flags/sync", {
    method: "POST",
  });
}

export async function adminListFlagUsers(
  id: string,
): Promise<FeatureFlagUser[]> {
  return request<FeatureFlagUser[]>(`/admin/feature-flags/${id}/users`);
}

export async function adminAddFlagUser(
  id: string,
  userId: string,
): Promise<void> {
  await request<{ userId: string }>(`/admin/feature-flags/${id}/users`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function adminRemoveFlagUser(
  id: string,
  userId: string,
): Promise<void> {
  await request<{ userId: string }>(
    `/admin/feature-flags/${id}/users/${userId}`,
    { method: "DELETE" },
  );
}
