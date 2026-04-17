import { API_BASE } from "../auth-client";

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

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) },
  });
  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Erreur ${res.status}`);
  }
  return json.data as T;
}

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
