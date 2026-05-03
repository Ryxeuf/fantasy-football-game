-- S26.5 — Preference utilisateur pour la notification
-- "{ami} demarre un match contre {adversaire}".
-- Default true pour ne pas casser les utilisateurs existants
-- qui s'attendent au comportement opt-in par defaut.

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN "friendMatchStartedNotification" BOOLEAN NOT NULL DEFAULT true;
