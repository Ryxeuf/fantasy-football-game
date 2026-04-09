import { prisma } from "../prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum NotificationType {
  Turn = "turn",
  MatchFound = "matchFound",
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  turnNotification: boolean;
  matchFoundNotification: boolean;
}

const DEFAULTS: NotificationPreferences = {
  pushEnabled: true,
  turnNotification: true,
  matchFoundNotification: true,
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
    default:
      return true;
  }
}
