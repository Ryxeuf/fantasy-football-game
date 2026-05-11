-- Lot P.C.2 — Migration SQLite (test) miroir : flag mustChangePassword
-- sur User pour l'admin password reset override.

ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT 0;
