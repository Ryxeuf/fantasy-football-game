import webpush from "web-push";
import {
  shouldSendNotification,
  NotificationType,
} from "./notification-preferences";

// ---------------------------------------------------------------------------
// VAPID Configuration
// ---------------------------------------------------------------------------

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:contact@nufflearena.fr";
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

/** Auto-generated VAPID keys used when env vars are not set (dev mode). */
let devKeys: { publicKey: string; privateKey: string } | null = null;

function getKeys(): { publicKey: string; privateKey: string } {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY };
  }
  if (!devKeys) {
    devKeys = webpush.generateVAPIDKeys();
  }
  return devKeys;
}

// Initialise VAPID on module load
const keys = getKeys();
webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);

// ---------------------------------------------------------------------------
// Subscription types
// ---------------------------------------------------------------------------

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Expo Push (mobile) types
// ---------------------------------------------------------------------------

export type ExpoPlatform = "ios" | "android" | "web" | "unknown";

export interface ExpoSubscriptionData {
  token: string;
  platform: ExpoPlatform;
}

export const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";

const EXPO_TOKEN_RE = /^(?:Exponent|Expo)PushToken\[[^\]]+\]$/;

export function isValidExpoPushToken(token: string): boolean {
  return !!token && EXPO_TOKEN_RE.test(token);
}

// ---------------------------------------------------------------------------
// In-memory subscription store
// ---------------------------------------------------------------------------

const subscriptions = new Map<string, PushSubscriptionData[]>();

export function addSubscription(
  userId: string,
  sub: PushSubscriptionData,
): void {
  const userSubs = subscriptions.get(userId) ?? [];
  // Replace if same endpoint (re-subscribe from same device)
  const filtered = userSubs.filter((s) => s.endpoint !== sub.endpoint);
  filtered.push(sub);
  subscriptions.set(userId, filtered);
}

export function removeSubscription(
  userId: string,
  endpoint: string,
): boolean {
  const userSubs = subscriptions.get(userId);
  if (!userSubs) return false;
  const before = userSubs.length;
  const filtered = userSubs.filter((s) => s.endpoint !== endpoint);
  if (filtered.length === before) return false;
  if (filtered.length === 0) {
    subscriptions.delete(userId);
  } else {
    subscriptions.set(userId, filtered);
  }
  return true;
}

export function getSubscriptions(userId: string): PushSubscriptionData[] {
  return subscriptions.get(userId) ?? [];
}

export function clearSubscriptions(): void {
  subscriptions.clear();
}

// ---------------------------------------------------------------------------
// In-memory Expo push token store (per user, multiple devices)
// ---------------------------------------------------------------------------

const expoSubscriptions = new Map<string, ExpoSubscriptionData[]>();

export function addExpoSubscription(
  userId: string,
  sub: ExpoSubscriptionData,
): boolean {
  if (!isValidExpoPushToken(sub.token)) {
    return false;
  }
  const userSubs = expoSubscriptions.get(userId) ?? [];
  const filtered = userSubs.filter((s) => s.token !== sub.token);
  filtered.push(sub);
  expoSubscriptions.set(userId, filtered);
  return true;
}

export function removeExpoSubscription(
  userId: string,
  token: string,
): boolean {
  const userSubs = expoSubscriptions.get(userId);
  if (!userSubs) return false;
  const filtered = userSubs.filter((s) => s.token !== token);
  if (filtered.length === userSubs.length) return false;
  if (filtered.length === 0) {
    expoSubscriptions.delete(userId);
  } else {
    expoSubscriptions.set(userId, filtered);
  }
  return true;
}

export function getExpoSubscriptions(
  userId: string,
): ExpoSubscriptionData[] {
  return expoSubscriptions.get(userId) ?? [];
}

export function clearExpoSubscriptions(): void {
  expoSubscriptions.clear();
}

// ---------------------------------------------------------------------------
// Send push notification
// ---------------------------------------------------------------------------

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  const userSubs = getSubscriptions(userId);
  if (userSubs.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];

  const results = await Promise.allSettled(
    userSubs.map((sub) =>
      webpush.sendNotification(sub, JSON.stringify(payload)),
    ),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      sent++;
    } else {
      failed++;
      const err = result.reason as { statusCode?: number };
      // 404 or 410 = subscription expired/invalid, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        expiredEndpoints.push(userSubs[i].endpoint);
      }
    }
  }

  // Clean up expired subscriptions
  for (const endpoint of expiredEndpoints) {
    removeSubscription(userId, endpoint);
  }

  return { sent, failed };
}

// ---------------------------------------------------------------------------
// Public key accessor
// ---------------------------------------------------------------------------

export function getVapidPublicKey(): string {
  return getKeys().publicKey;
}

// ---------------------------------------------------------------------------
// Expo Push delivery (native mobile)
// ---------------------------------------------------------------------------

interface ExpoPushResponse {
  data?: {
    status: "ok" | "error";
    id?: string;
    message?: string;
    details?: { error?: string };
  };
  errors?: unknown[];
}

function buildExpoBody(
  token: string,
  payload: PushPayload,
): Record<string, unknown> {
  const data: Record<string, unknown> = { ...(payload.data ?? {}) };
  if (payload.url && !("url" in data)) data.url = payload.url;
  return {
    to: token,
    title: payload.title,
    body: payload.body,
    data,
    sound: "default",
    priority: "high",
    channelId: "default",
  };
}

async function sendToExpo(
  token: string,
  payload: PushPayload,
): Promise<{ ok: boolean; unregistered: boolean }> {
  try {
    const res = await fetch(EXPO_PUSH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(buildExpoBody(token, payload)),
    });
    if (!res.ok) {
      return { ok: false, unregistered: false };
    }
    const json = (await res.json().catch(() => ({}))) as ExpoPushResponse;
    if (json.data?.status === "ok") {
      return { ok: true, unregistered: false };
    }
    const errCode = json.data?.details?.error;
    const unregistered =
      errCode === "DeviceNotRegistered" || errCode === "InvalidCredentials";
    return { ok: false, unregistered };
  } catch {
    return { ok: false, unregistered: false };
  }
}

export async function sendExpoPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  const subs = getExpoSubscriptions(userId);
  if (subs.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const tokensToRemove: string[] = [];

  const results = await Promise.all(
    subs.map((s) => sendToExpo(s.token, payload)),
  );
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.ok) {
      sent++;
    } else {
      failed++;
      if (result.unregistered) tokensToRemove.push(subs[i].token);
    }
  }

  for (const token of tokensToRemove) {
    removeExpoSubscription(userId, token);
  }

  return { sent, failed };
}

// ---------------------------------------------------------------------------
// Game-specific push helpers
// ---------------------------------------------------------------------------

/**
 * Send a "your turn" push notification to a user.
 * Checks user preferences before sending.
 * Non-blocking — errors are silently ignored.
 */
export function sendTurnPush(userId: string, matchId: string): void {
  shouldSendNotification(userId, NotificationType.Turn)
    .then(async (allowed) => {
      if (!allowed) return;
      const url = `/play/${matchId}`;
      const payload: PushPayload = {
        title: "Nuffle Arena",
        body: "C'est votre tour de jouer !",
        icon: "/images/favicon-optimized.png",
        url,
        tag: `turn-${matchId}`,
        data: { kind: "turn", matchId, url },
      };
      await Promise.all([
        sendPushToUser(userId, payload),
        sendExpoPushToUser(userId, payload),
      ]);
    })
    .catch(() => {
      // Push failure is non-blocking
    });
}

/**
 * Send a "match found" push notification to a user.
 * Checks user preferences before sending.
 * Non-blocking — errors are silently ignored.
 */
export function sendMatchFoundPush(userId: string, matchId: string): void {
  shouldSendNotification(userId, NotificationType.MatchFound)
    .then(async (allowed) => {
      if (!allowed) return;
      const url = `/play/${matchId}`;
      const payload: PushPayload = {
        title: "Nuffle Arena",
        body: "Un adversaire a ete trouve !",
        icon: "/images/favicon-optimized.png",
        url,
        tag: `match-found-${matchId}`,
        data: { kind: "matchFound", matchId, url },
      };
      await Promise.all([
        sendPushToUser(userId, payload),
        sendExpoPushToUser(userId, payload),
      ]);
    })
    .catch(() => {
      // Push failure is non-blocking
    });
}
