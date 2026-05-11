-- Migration SQLite (test) miroir : visibilite User dans le classement ELO.

ALTER TABLE "User" ADD COLUMN "leaderboardStatus" TEXT NOT NULL DEFAULT 'visible';
ALTER TABLE "User" ADD COLUMN "leaderboardStatusReason" TEXT;
ALTER TABLE "User" ADD COLUMN "leaderboardStatusUpdatedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "leaderboardStatusUpdatedBy" TEXT;
