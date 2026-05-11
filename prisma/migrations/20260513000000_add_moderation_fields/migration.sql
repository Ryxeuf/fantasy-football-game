-- Lot P.B.4 — Moderation matchs humains + ban users.
--
-- 1) Match : colonnes nullables pour tracer une moderation admin
--    (forfait force ou annulation). Le statut existant (`status`)
--    reste source de verite ; ces colonnes apportent la metadata
--    (date, cote vainqueur, raison) sans casser les requetes.
--
-- 2) User : colonnes nullables pour le bannissement temporaire ou
--    permanent. `bannedUntil` est compare a `now()` au login : si
--    > now() le user est refuse. Un ban permanent est materialise
--    par une date tres lointaine (year 9999) plutot qu'un booleen
--    pour unifier le code du middleware.
--
-- Aucune migration de donnees : tous les enregistrements existants
-- prennent NULL sur ces colonnes (pas forfeite, pas banni).

ALTER TABLE "Match"
    ADD COLUMN "forfeitedAt" TIMESTAMP(3),
    ADD COLUMN "forfeitWinnerSide" TEXT,
    ADD COLUMN "forfeitReason" TEXT,
    ADD COLUMN "cancelledAt" TIMESTAMP(3),
    ADD COLUMN "cancelReason" TEXT;

ALTER TABLE "User"
    ADD COLUMN "bannedAt" TIMESTAMP(3),
    ADD COLUMN "bannedUntil" TIMESTAMP(3),
    ADD COLUMN "banReason" TEXT;

-- Index partiel pour les jobs admin qui listent les users actuellement
-- bannes (rare, mais coupe rapide les scans full table). Postgres seul.
CREATE INDEX "User_bannedUntil_idx" ON "User"("bannedUntil") WHERE "bannedUntil" IS NOT NULL;
