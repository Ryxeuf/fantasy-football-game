// API client for mobile app.
// Uses the same backend as the web app.
// API_BASE can be overridden via EXPO_PUBLIC_API_BASE env var.

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:8201";

export { API_BASE };

const TOKEN_KEY = "auth_token";

// In-memory fallback for web where SecureStore is unavailable
let memoryToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") return memoryToken;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    memoryToken = token;
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export async function removeToken(): Promise<void> {
  if (Platform.OS === "web") {
    memoryToken = null;
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export async function apiPost(path: string, body: unknown) {
  const auth = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json?.error || `Erreur ${res.status}`, res.status);
  }
  return json;
}

export async function apiGet(path: string) {
  const auth = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...auth },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json?.error || `Erreur ${res.status}`, res.status);
  }
  return json;
}
