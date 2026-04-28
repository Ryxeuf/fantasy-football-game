import { apiRequest } from "./api-client";

export interface FeatureFlag {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  userOverrideCount: number;
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
