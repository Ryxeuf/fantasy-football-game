import webpush from "web-push";

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
// Game-specific push helpers
// ---------------------------------------------------------------------------

/**
 * Send a "your turn" push notification to a user.
 * Non-blocking — errors are silently ignored.
 */
export function sendTurnPush(userId: string, matchId: string): void {
  sendPushToUser(userId, {
    title: "Nuffle Arena",
    body: "C'est votre tour de jouer !",
    icon: "/images/favicon-optimized.png",
    url: `/play-hidden/${matchId}`,
    tag: `turn-${matchId}`,
  }).catch(() => {
    // Push failure is non-blocking
  });
}

/**
 * Send a "match found" push notification to a user.
 * Non-blocking — errors are silently ignored.
 */
export function sendMatchFoundPush(userId: string, matchId: string): void {
  sendPushToUser(userId, {
    title: "Nuffle Arena",
    body: "Un adversaire a ete trouve !",
    icon: "/images/favicon-optimized.png",
    url: `/play-hidden/${matchId}`,
    tag: `match-found-${matchId}`,
  }).catch(() => {
    // Push failure is non-blocking
  });
}
