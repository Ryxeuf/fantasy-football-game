// Auth token storage for mobile app.
// Uses expo-secure-store on native devices, falls back to in-memory on web.

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

// In-memory fallback for environments where SecureStore is unavailable (web)
let memoryToken: string | null = null;
let memoryUser: string | null = null;

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    memoryToken = token;
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return memoryToken;
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken(): Promise<void> {
  if (Platform.OS === "web") {
    memoryToken = null;
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export async function saveUser(user: Record<string, unknown>): Promise<void> {
  const json = JSON.stringify(user);
  if (Platform.OS === "web") {
    memoryUser = json;
  } else {
    await SecureStore.setItemAsync(USER_KEY, json);
  }
}

export async function getUser(): Promise<Record<string, unknown> | null> {
  let json: string | null;
  if (Platform.OS === "web") {
    json = memoryUser;
  } else {
    json = await SecureStore.getItemAsync(USER_KEY);
  }
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function clearAuth(): Promise<void> {
  await removeToken();
  if (Platform.OS === "web") {
    memoryUser = null;
  } else {
    await SecureStore.deleteItemAsync(USER_KEY);
  }
}
