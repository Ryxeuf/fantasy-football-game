-- Lot P.B.4 — Migration SQLite (test) miroir de la migration Postgres :
-- colonnes nullables sur Match (forfait/annulation admin) et User (ban).
--
-- SQLite est regenere a chaque run (pnpm prisma:push:sqlite) donc pas
-- de preoccupation de backfill.

ALTER TABLE "Match" ADD COLUMN "forfeitedAt" DATETIME;
ALTER TABLE "Match" ADD COLUMN "forfeitWinnerSide" TEXT;
ALTER TABLE "Match" ADD COLUMN "forfeitReason" TEXT;
ALTER TABLE "Match" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Match" ADD COLUMN "cancelReason" TEXT;

ALTER TABLE "User" ADD COLUMN "bannedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "bannedUntil" DATETIME;
ALTER TABLE "User" ADD COLUMN "banReason" TEXT;
