-- Lot P.A.2 — Migration SQLite (test) miroir : User.deletedAt + deletionReason.

ALTER TABLE "User" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "deletionReason" TEXT;
