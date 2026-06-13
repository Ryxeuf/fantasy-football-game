import webpush from "web-push";
import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
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

// Sécurité / ops : ne jamais hardcoder les clés VAPID. Si elles sont
// absentes de l'environnement on dégrade proprement (clés dev éphémères
// générées ci-dessus) mais on log un avertissement explicite au
// démarrage : en prod, des clés éphémères = abonnements invalidés à
// chaque restart (la subscription navigateur référence l'ancienne clé).
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  serverLog.warn(
    "[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY absents — clés de dev " +
      "éphémères générées. En production, configurer ces variables d'env " +
      "(sinon les abonnements push ne survivent pas à un redémarrage).",
  );
}

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
// Persistent subscription store (Prisma)
//
// Réengagement : les subscriptions web-push sont persistées en base
// (modèle `PushSubscription`) plutôt qu'en mémoire, pour survivre aux
// redémarrages serveur et fonctionner en multi-instance. `endpoint` est
// la clé d'unicité (un endpoint = un navigateur/appareil).
// ---------------------------------------------------------------------------

export async function addSubscription(
  userId: string,
  sub: PushSubscriptionData,
): Promise<void> {
  // Upsert par endpoint : ré-abonnement depuis le même device (clés
  // tournées) OU device repris par un autre user (re-affecte le userId).
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    update: {
      userId,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
  });
}

export async function removeSubscription(
  userId: string,
  endpoint: string,
): Promise<boolean> {
  const res = await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
  return res.count > 0;
}

export async function getSubscriptions(
  userId: string,
): Promise<PushSubscriptionData[]> {
  const rows: ReadonlyArray<{
    endpoint: string;
    p256dh: string;
    auth: string;
  }> = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });
  return rows.map((r) => ({
    endpoint: r.endpoint,
    keys: { p256dh: r.p256dh, auth: r.auth },
  }));
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
  const userSubs = await getSubscriptions(userId);
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
    await removeSubscription(userId, endpoint);
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
 * S26.5 — Send a "friend started a match" push notification.
 * Checks user preferences before sending.
 * Non-blocking — errors are silently ignored.
 */
export function sendFriendMatchStartedPush(
  friendUserId: string,
  matchId: string,
  friendCoachName: string,
  opponentCoachName: string,
): void {
  shouldSendNotification(friendUserId, NotificationType.FriendMatchStarted)
    .then(async (allowed) => {
      if (!allowed) return;
      const url = `/play/${matchId}`;
      const payload: PushPayload = {
        title: "Nuffle Arena",
        body: `${friendCoachName} joue contre ${opponentCoachName}`,
        icon: "/images/favicon-optimized.png",
        url,
        tag: `friend-match-${matchId}`,
        data: {
          kind: "friendMatchStarted",
          matchId,
          friendCoachName,
          opponentCoachName,
          url,
        },
      };
      await Promise.all([
        sendPushToUser(friendUserId, payload),
        sendExpoPushToUser(friendUserId, payload),
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

/**
 * L2.A.12 — Sprint Ligues v2 PR3 : push "Vous avez ete apparie a
 * {opponent} pour la J{n}, deadline {YYYY-MM-DD}". Envoye au
 * demarrage d'une saison (`startSeason`) pour chaque coach implique
 * dans un pairing du round 1. Verifie la preference utilisateur
 * `leagueRoundReminderNotification`. Non-bloquant.
 *
 * `seasonId` est inclus dans la payload pour permettre au client de
 * deep-link vers `/leagues/:leagueId` (route fournie par le caller).
 */
export interface LeagueRoundReminderInput {
  readonly userId: string;
  readonly leagueId: string;
  readonly seasonId: string;
  readonly opponentCoachName: string;
  readonly roundNumber: number;
  readonly deadlineAt: Date | null;
}

export function sendLeagueRoundReminderPush(
  input: LeagueRoundReminderInput,
): void {
  shouldSendNotification(input.userId, NotificationType.LeagueRoundReminder)
    .then(async (allowed) => {
      if (!allowed) return;
      const url = `/leagues/${input.leagueId}`;
      const deadlineLabel = input.deadlineAt
        ? input.deadlineAt.toISOString().slice(0, 10)
        : null;
      const body = deadlineLabel
        ? `Apparie contre ${input.opponentCoachName} pour la J${input.roundNumber} (deadline ${deadlineLabel})`
        : `Apparie contre ${input.opponentCoachName} pour la J${input.roundNumber}`;
      const payload: PushPayload = {
        title: "Nuffle Arena",
        body,
        icon: "/images/favicon-optimized.png",
        url,
        tag: `league-round-${input.seasonId}-${input.roundNumber}-${input.userId}`,
        data: {
          kind: "leagueRoundReminder",
          leagueId: input.leagueId,
          seasonId: input.seasonId,
          roundNumber: input.roundNumber,
          opponentCoachName: input.opponentCoachName,
          deadlineAt: input.deadlineAt?.toISOString() ?? null,
          url,
        },
      };
      await Promise.all([
        sendPushToUser(input.userId, payload),
        sendExpoPushToUser(input.userId, payload),
      ]);
    })
    .catch(() => {
      // Push failure is non-blocking — match the existing pattern.
    });
}

/**
 * Lot H — Alerte le commissaire qu'un match est pret a valider (les 2
 * coachs ont soumis leur feuille). Non-bloquant. Deep-link vers la
 * page "Matchs a valider" de la ligue.
 */
export interface LeagueMatchValidationInput {
  readonly commissionerUserId: string;
  readonly leagueId: string;
  readonly pairingId: string;
  readonly homeTeamName: string;
  readonly awayTeamName: string;
}

export function sendLeagueMatchValidationPush(
  input: LeagueMatchValidationInput,
): void {
  shouldSendNotification(
    input.commissionerUserId,
    NotificationType.LeagueMatchValidation,
  )
    .then(async (allowed) => {
      if (!allowed) return;
      const url = `/leagues/${input.leagueId}/pending-validations`;
      const payload: PushPayload = {
        title: "Nuffle Arena",
        body: `Match a valider : ${input.homeTeamName} vs ${input.awayTeamName}`,
        icon: "/images/favicon-optimized.png",
        url,
        tag: `league-validate-${input.pairingId}`,
        data: {
          kind: "leagueMatchValidation",
          leagueId: input.leagueId,
          pairingId: input.pairingId,
          url,
        },
      };
      await Promise.all([
        sendPushToUser(input.commissionerUserId, payload),
        sendExpoPushToUser(input.commissionerUserId, payload),
      ]);
    })
    .catch(() => {
      // Push failure is non-blocking.
    });
}
