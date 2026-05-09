-- Lot 3.C.5 — TV (Team Value) individuelle cachee.
--
-- Stocke la TV en gold pieces calculee a partir du position base cost
-- et du nombre de skills (+20k par skill General). Update transactionnel
-- par le level-up applier (Lot 3.C.4).
--
-- Default 50_000 = cost d'un Lineman generique. Les rosters existants
-- demarrent avec cette valeur ; le job batch `sweepRecomputeTvs` peut
-- ensuite les recalculer en lot pour appliquer le cost reel par
-- position.
--
-- Index `(teamId, tvCached)` pour les leaderboards "joueurs les plus
-- chers par equipe" et le calcul dynamique du TV total d'une equipe.

ALTER TABLE "ProTeamRoster"
    ADD COLUMN "tvCached" INTEGER NOT NULL DEFAULT 50000;

CREATE INDEX "ProTeamRoster_teamId_tvCached_idx"
    ON "ProTeamRoster"("teamId", "tvCached");
