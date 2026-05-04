-- L2.A.12 — Sprint Ligues v2 PR3 : preference utilisateur pour la
-- notification "Vous avez ete apparie a {coach} pour la J{n}".
-- Default true pour que les utilisateurs existants recoivent les
-- annonces des saisons qu'ils ont rejointes sans avoir a opt-in.

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN "leagueRoundReminderNotification" BOOLEAN NOT NULL DEFAULT true;
