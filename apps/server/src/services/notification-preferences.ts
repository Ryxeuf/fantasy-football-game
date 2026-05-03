import { prisma } from "../prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum NotificationType {
  Turn = "turn",
  MatchFound = "matchFound",
  FriendMatchStarted = "friendMatchStarted",
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  turnNotification: boolean;
  matchFoundNotification: boolean;
  friendMatchStartedNotification: boolean;
}

const DEFAULTS: NotificationPreferences = {
  pushEnabled: true,
  turnNotification: true,
  matchFoundNotification: true,
  friendMatchStartedNotification: true,
};

// ---------------------------------------------------------------------------
// Read preferences
// ---------------------------------------------------------------------------

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const row = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (!row) return { ...DEFAULTS };
  return {
    pushEnabled: row.pushEnabled,
    turnNotification: row.turnNotification,
    matchFoundNotification: row.matchFoundNotification,
    // Legacy rows pre-dating S26.5 lack the column entirely; fall back
    // to the all-enabled default so existing users keep being notified.
    friendMatchStartedNotification:
      (row as { friendMatchStartedNotification?: boolean | null })
        .friendMatchStartedNotification ??
      DEFAULTS.friendMatchStartedNotification,
  };
}

// ---------------------------------------------------------------------------
// Update preferences (upsert)
// ---------------------------------------------------------------------------

export async function updateNotificationPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const row = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...prefs },
    update: prefs,
  });
  return {
    pushEnabled: row.pushEnabled,
    turnNotification: row.turnNotification,
    matchFoundNotification: row.matchFoundNotification,
    friendMatchStartedNotification:
      (row as { friendMatchStartedNotification?: boolean | null })
        .friendMatchStartedNotification ??
      DEFAULTS.friendMatchStartedNotification,
  };
}

// ---------------------------------------------------------------------------
// Check whether a push should be sent
// ---------------------------------------------------------------------------

export async function shouldSendNotification(
  userId: string,
  type: NotificationType,
): Promise<boolean> {
  const prefs = await getNotificationPreferences(userId);
  if (!prefs.pushEnabled) return false;

  switch (type) {
    case NotificationType.Turn:
      return prefs.turnNotification;
    case NotificationType.MatchFound:
      return prefs.matchFoundNotification;
    case NotificationType.FriendMatchStarted:
      return prefs.friendMatchStartedNotification;
    default:
      return true;
  }
}
