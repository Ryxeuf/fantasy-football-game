-- Lot 2.C.1 — sandbox test matches.
--
-- Flag `isTest` sur ProLeagueMatch pour distinguer les matchs lancés
-- depuis l'admin (`POST /admin/sim/test-match`) qui ne doivent ni
-- compter dans les standings/ELO, ni générer de paiement de paris,
-- ni alimenter les leaderboards/Hall of Fame.
--
-- Default false : tous les matchs Pro League existants restent
-- "production" (impact ELO normal). Les matchs "test" sont créés
-- explicitement avec isTest=true par les routes admin.

ALTER TABLE "public"."ProLeagueMatch"
    ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

-- Index partiel : on ne charge l'index que sur les `isTest=true`
-- (rare). Permet aux routes admin/sim/test-match/list de scanner
-- rapidement les matchs sandbox sans pénaliser les requêtes
-- production qui filtrent isTest=false (la majorité écrasante).
CREATE INDEX "ProLeagueMatch_isTest_idx"
    ON "public"."ProLeagueMatch" ("isTest")
    WHERE "isTest" = true;
