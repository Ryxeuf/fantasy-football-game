-- Sprint test-leagues — flag `isTest` sur ProLeagueSeason + label.
--
-- Permet a un admin de creer une saison Pro League complete (rounds,
-- matchs simules, replays) destinee aux tests / regressions, isolee
-- de la production et supprimable d'un coup (cascade).
--
-- Toutes les saisons existantes restent prod : default false.
-- Le filtre `isTest=false` s'applique cote hub, standings, leaderboards,
-- feed fans, et tous les agregateurs (Lot 2.C.3 + ext.).
--
-- Index partiel sur `isTest=true` : la majorite ecrasante des seasons
-- sont prod, donc on cible uniquement les test-seasons pour les listings
-- admin sans penaliser les queries prod.

ALTER TABLE "public"."ProLeagueSeason"
    ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "testLabel" TEXT;

CREATE INDEX "ProLeagueSeason_isTest_idx"
    ON "public"."ProLeagueSeason" ("isTest")
    WHERE "isTest" = true;
