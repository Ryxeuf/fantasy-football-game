/**
 * Notifications internes (in-app).
 *
 * Complète les canaux de LIVRAISON existants (push web/Expo, e-mail) par un
 * HISTORIQUE persistant par utilisateur (`Notification`), consulté depuis le
 * menu (compteur de non lus) et la page `/me/notifications`.
 *
 * Deux règles, dans l'esprit du pattern « hook post-settlement encapsulé »
 * (cf. CLAUDE.md) :
 *
 *  1. `createInAppNotification` / `createInAppNotifications` NE THROW JAMAIS :
 *     une notification est un effet secondaire, son échec est journalisé et
 *     ne doit jamais faire échouer l'action métier (invitation, appariement,
 *     demande d'ami, archivage…) qui l'a déclenchée.
 *  2. La création est INDÉPENDANTE des préférences push
 *     (`shouldSendNotification`) : un coach qui a coupé le push garde son
 *     historique interne.
 *
 * Les lectures (`markNotificationRead`, `markAllNotificationsRead`) sont
 * filtrées par `userId` dans le WHERE : un utilisateur ne peut jamais toucher
 * la notification d'un autre, et les appels sont idempotents.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

/** Familles de notifications (dot-case). Étendre ici, jamais en chaîne libre. */
export type NotificationKind =
  | "league.invitation"
  | "cup.invitation"
  | "cup.round_pairing"
  | "league.round_pairing"
  | "league.pairing_scheduled"
  | "league.round_followup"
  | "league.match_validation"
  | "friend.request"
  | "friend.accepted"
  | "league.archived"
  | "league.deleted"
  | "cup.archived"
  | "cup.deleted";

export interface InAppNotificationPayload {
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  /** Lien relatif web (ex. `/leagues/abc`). Absent/null = pas de cible. */
  readonly url?: string | null;
  /** Ids libres pour le client (leagueId, code…). */
  readonly meta?: Record<string, unknown> | null;
}

export interface InAppNotificationInput extends InAppNotificationPayload {
  readonly userId: string;
}

/** Forme servie par l'API (`GET /notifications`). */
export interface NotificationView {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly url: string | null;
  readonly meta: Record<string, unknown> | null;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface ListNotificationsOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly unreadOnly?: boolean;
}

export interface NotificationListResult {
  readonly items: NotificationView[];
  readonly total: number;
  readonly unreadCount: number;
  readonly limit: number;
  readonly offset: number;
}

export type MarkReadOutcome = "read" | "already_read" | "not_found";

/** Bornes défensives : un titre/corps hors gabarit est tronqué, jamais refusé. */
export const MAX_TITLE_LENGTH = 120;
export const MAX_BODY_LENGTH = 500;
export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;

/** Ligne Prisma (PG ou miroir sqlite) — typée structurellement. */
interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  meta: unknown;
  readAt: Date | null;
  createdAt: Date;
}

function clamp(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/**
 * `meta` peut être un objet natif (PG), une chaîne sérialisée (miroir
 * sqlite / anciennes lignes) ou null. Toute forme inattendue → null.
 */
export function parseNotificationMeta(
  raw: unknown,
): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

export function serializeNotification(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    url: row.url ?? null,
    meta: parseNotificationMeta(row.meta),
    readAt: row.readAt ? new Date(row.readAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

function toCreateData(userId: string, payload: InAppNotificationPayload) {
  return {
    userId,
    kind: payload.kind,
    title: clamp(payload.title, MAX_TITLE_LENGTH),
    body: clamp(payload.body, MAX_BODY_LENGTH),
    url: payload.url ?? null,
    // `undefined` = colonne omise (NULL). Un `null` JS exigerait
    // `Prisma.JsonNull` sur une colonne Json nullable.
    meta: payload.meta ?? undefined,
  };
}

/**
 * Crée UNE notification. Ne throw jamais : renvoie la vue créée, ou `null`
 * si la persistance a échoué (erreur journalisée).
 */
export async function createInAppNotification(
  input: InAppNotificationInput,
): Promise<NotificationView | null> {
  try {
    const row = (await prisma.notification.create({
      data: toCreateData(input.userId, input),
    })) as NotificationRow;
    return serializeNotification(row);
  } catch (e: unknown) {
    serverLog.error(
      `[in-app-notifications] create failed for user ${input.userId} (${input.kind})`,
      e,
    );
    return null;
  }
}

/**
 * Fan-out : la même notification pour plusieurs utilisateurs (participants
 * d'une compétition…). Dédoublonne les ids, ignore les vides. Ne throw
 * jamais ; renvoie le nombre de lignes créées.
 */
export async function createInAppNotifications(
  userIds: readonly string[],
  payload: InAppNotificationPayload,
): Promise<number> {
  const unique = Array.from(new Set(userIds.filter((id) => !!id)));
  if (unique.length === 0) return 0;
  try {
    const result = (await prisma.notification.createMany({
      data: unique.map((userId) => toCreateData(userId, payload)),
    })) as { count: number };
    return result.count;
  } catch (e: unknown) {
    serverLog.error(
      `[in-app-notifications] createMany failed (${payload.kind}, ${unique.length} users)`,
      e,
    );
    return 0;
  }
}

export async function listNotifications(
  userId: string,
  options: ListNotificationsOptions = {},
): Promise<NotificationListResult> {
  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_LIST_LIMIT, 1),
    MAX_LIST_LIMIT,
  );
  const offset = Math.max(options.offset ?? 0, 0);
  const where = options.unreadOnly ? { userId, readAt: null } : { userId };
  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }) as Promise<NotificationRow[]>,
    prisma.notification.count({ where }) as Promise<number>,
    prisma.notification.count({
      where: { userId, readAt: null },
    }) as Promise<number>,
  ]);
  return {
    items: rows.map(serializeNotification),
    total,
    unreadCount,
    limit,
    offset,
  };
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return (await prisma.notification.count({
    where: { userId, readAt: null },
  })) as number;
}

/**
 * Marque UNE notification lue. Le WHERE porte `userId` : une notification
 * d'un autre utilisateur est indiscernable d'une notification inexistante
 * (`not_found`), et un second appel renvoie `already_read` sans écriture.
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<MarkReadOutcome> {
  const result = (await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  })) as { count: number };
  if (result.count > 0) return "read";
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true },
  });
  return existing ? "already_read" : "not_found";
}

/** Marque TOUTES les notifications non lues de l'utilisateur. Idempotent. */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = (await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })) as { count: number };
  return result.count;
}
