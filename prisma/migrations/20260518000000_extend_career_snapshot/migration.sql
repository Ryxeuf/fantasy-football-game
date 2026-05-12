-- Sprint Q lot Q.A.2 — Extension du snapshot career joueur.
--
-- Ajoute :
--   - topMatchesJson : top 5 matches par SPP en JSON
--   - topNemesisIdsJson : top 3 nemesis teams en JSON
--   - topVictoryIdsJson : top 3 souffre-douleur teams en JSON
--   - casualtiesReceived : count CASUALTY events ou le joueur subit
--   - casualtiesDealt : count CASUALTY events ou le joueur inflige
--     (alias semantique de casTotal, garde pour clarte UI)
--
-- Tous les champs sont nullable / default=0. Pas de backfill — les
-- snapshots existants seront recomputed lazy a la prochaine lecture
-- via le staleness check.

ALTER TABLE "ProPlayerCareerSnapshot"
    ADD COLUMN "topMatchesJson" JSONB,
    ADD COLUMN "topNemesisIdsJson" JSONB,
    ADD COLUMN "topVictoryIdsJson" JSONB,
    ADD COLUMN "casualtiesReceived" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "casualtiesDealt" INTEGER NOT NULL DEFAULT 0;
