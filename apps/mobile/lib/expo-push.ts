// Pure helpers for Expo Push Notifications.
// Kept free of expo-notifications imports so they can be unit-tested in Node.

export const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";

export type NotificationKind = "turn" | "matchFound" | "unknown";

export type Platform = "ios" | "android" | "web" | "unknown";

export interface NotificationData {
  kind: NotificationKind;
  matchId?: string;
  url?: string;
}

export interface ExpoSubscribePayload {
  token: string;
  platform: Platform;
}

const EXPO_TOKEN_RE = /^(?:Exponent|Expo)PushToken\[[^\]]+\]$/;

export function isExpoPushToken(token: string): boolean {
  if (!token) return false;
  return EXPO_TOKEN_RE.test(token);
}

const KNOWN_PLATFORMS: readonly Platform[] = ["ios", "android", "web"] as const;

function normalisePlatform(raw: string): Platform {
  return (KNOWN_PLATFORMS as readonly string[]).includes(raw)
    ? (raw as Platform)
    : "unknown";
}

export function buildSubscribePayload(
  token: string,
  platform: string,
): ExpoSubscribePayload {
  return {
    token,
    platform: normalisePlatform(platform),
  };
}

const VALID_KINDS: readonly NotificationKind[] = [
  "turn",
  "matchFound",
] as const;

function isValidKind(value: unknown): value is "turn" | "matchFound" {
  return (
    typeof value === "string" &&
    (VALID_KINDS as readonly string[]).includes(value)
  );
}

function extractString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function parseNotificationData(raw: unknown): NotificationData {
  if (!raw || typeof raw !== "object") {
    return { kind: "unknown" };
  }
  const obj = raw as Record<string, unknown>;
  const kind: NotificationKind = isValidKind(obj.kind) ? obj.kind : "unknown";
  const matchId = extractString(obj.matchId);
  const url = extractString(obj.url);
  return { kind, matchId, url };
}

// Allow only relative paths that cannot escape the app (no scheme, no parent
// traversal, no protocol-relative URL). This prevents push payloads from
// redirecting users to arbitrary hosts when tapped.
function isSafeInternalPath(url: string): boolean {
  if (!url.startsWith("/")) return false;
  if (url.startsWith("//")) return false;
  if (url.includes("..")) return false;
  return true;
}

function isSafeMatchId(matchId: string): boolean {
  return !matchId.includes("/") && !matchId.includes("..");
}

export function resolveNavigationRoute(
  data: NotificationData,
): string | null {
  if (data.url && isSafeInternalPath(data.url)) {
    return data.url;
  }
  if (data.matchId && isSafeMatchId(data.matchId)) {
    if (data.kind === "turn" || data.kind === "matchFound") {
      return `/play/${data.matchId}`;
    }
  }
  return null;
}
