import { prisma } from "../prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum NotificationType {
  Turn = "turn",
  MatchFound = "matchFound",
  FriendMatchStarted = "friendMatchStarted",
  /**
   * L2.A.12 — Sprint Ligues v2 PR3 : "Vous avez ete apparie a {coach}
   * pour la J{n}, deadline {date}". Envoye au demarrage d'une saison
   * (`startSeason`) pour informer chaque coach de ses pairings.
   */
  LeagueRoundReminder = "leagueRoundReminder",
  /**
   * Lot H — "Un match est pret a valider". Envoye au commissaire quand
   * les 2 coachs ont soumis leur feuille (`both_submitted`). Reutilise
   * la preference league-umbrella `leagueRoundReminderNotification`
   * (pas de colonne dediee pour eviter une migration).
   */
  LeagueMatchValidation = "leagueMatchValidation",
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  turnNotification: boolean;
  matchFoundNotification: boolean;
  friendMatchStartedNotification: boolean;
  leagueRoundReminderNotification: boolean;
}

const DEFAULTS: NotificationPreferences = {
  pushEnabled: true,
  turnNotification: true,
  matchFoundNotification: true,
  friendMatchStartedNotification: true,
  leagueRoundReminderNotification: true,
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
    // L2.A.12 — meme logique pour la nouvelle preference ligues v2.
    leagueRoundReminderNotification:
      (row as { leagueRoundReminderNotification?: boolean | null })
        .leagueRoundReminderNotification ??
      DEFAULTS.leagueRoundReminderNotification,
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
    leagueRoundReminderNotification:
      (row as { leagueRoundReminderNotification?: boolean | null })
        .leagueRoundReminderNotification ??
      DEFAULTS.leagueRoundReminderNotification,
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
    case NotificationType.LeagueRoundReminder:
      return prefs.leagueRoundReminderNotification;
    // Lot H — reutilise l'umbrella league pour l'alerte commissaire.
    case NotificationType.LeagueMatchValidation:
      return prefs.leagueRoundReminderNotification;
    default:
      return true;
  }
}
