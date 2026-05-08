-- Lot 3.C.2 — SPP / progression.
--
-- Ajoute :
--   - ProTeamRoster.{spp, tdCount, casCount, compCount, mvpCount}
--     (Int default 0) : compteurs cumulatifs sur la carriere du
--     joueur. Le SPP gouverne le level-up (table BB officielle :
--     6/16/31/51/76/176).
--   - ProLeagueMatch.sppAppliedAt (Timestamp nullable) : flag
--     d'idempotence pour le post-process SPP. null = pas encore
--     traite ; non-null = SPP attribues aux rosters.
--   - Index (teamId, spp) sur ProTeamRoster pour permettre des
--     leaderboards rapides "top scorer carriere par equipe".
--
-- Aucune migration de donnees : tous les rosters existants demarrent
-- a 0 SPP. Les matchs deja simules ne re-receveront PAS de SPP
-- retroactivement (deliberte : l'historique est figeable, le sweep ne
-- traite que les matchs avec sppAppliedAt=null ; pour declencher un
-- backfill manuel, faire un UPDATE direct des matchs vises).

ALTER TABLE "ProTeamRoster"
    ADD COLUMN "spp" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "tdCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "casCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "compCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "mvpCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ProLeagueMatch"
    ADD COLUMN "sppAppliedAt" TIMESTAMP(3);

CREATE INDEX "ProTeamRoster_teamId_spp_idx"
    ON "ProTeamRoster"("teamId", "spp");
