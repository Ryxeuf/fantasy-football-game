-- Lot P.A.2 — Soft-delete RGPD-compatible pour User.
--
-- Quand `deletedAt` est non-null, le compte est considere supprime :
-- login refuse, profil public masque, recherches publiques (coach
-- search, friend search) le filtrent. Les FK existantes (matches,
-- replays, audit logs, classements pro league) sont preservees pour
-- l'integrite historique.
--
-- Un futur lot RGPD (purge job) purgera definitivement les comptes
-- soft-deleted depuis > 30j (anonymisation des champs personnels +
-- suppression effective). En attendant, /admin/users/:id/restore permet
-- d'annuler une suppression abusive.
--
-- Aucune migration de donnees : tous les enregistrements existants
-- prennent NULL (= compte actif).

ALTER TABLE "User"
    ADD COLUMN "deletedAt" TIMESTAMP(3),
    ADD COLUMN "deletionReason" TEXT;

-- Index partiel pour les jobs admin qui listent les comptes supprimes
-- (rare, mais coupe le scan full table).
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt") WHERE "deletedAt" IS NOT NULL;
