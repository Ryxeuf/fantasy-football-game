-- Migration SQLite (test) miroir de la migration Postgres :
-- 1. User.totalDonatedCents (Int) → User.totalDonatedCentsByCurrency (TEXT JSON).
-- 2. User.discordUserId (TEXT unique nullable).
-- 3. KofiTransaction.kofiTimestamp (DATETIME nullable).
-- 4. KofiTransaction.discordUserId (TEXT nullable).
--
-- SQLite 3.35+ supporte DROP COLUMN ; ce schéma cible une base de tests qui
-- est régénérée à chaque run (pnpm prisma:push:sqlite), donc pas de
-- préoccupation de backfill ici.

PRAGMA foreign_keys=OFF;

ALTER TABLE "User" ADD COLUMN "totalDonatedCentsByCurrency" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "User" DROP COLUMN "totalDonatedCents";

ALTER TABLE "User" ADD COLUMN "discordUserId" TEXT;
CREATE UNIQUE INDEX "User_discordUserId_key" ON "User"("discordUserId");

ALTER TABLE "KofiTransaction" ADD COLUMN "kofiTimestamp" DATETIME;
ALTER TABLE "KofiTransaction" ADD COLUMN "discordUserId" TEXT;

PRAGMA foreign_keys=ON;
