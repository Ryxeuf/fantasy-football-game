-- E11 — snapshot du roster de chaque équipe figé à la première soumission
-- de la feuille de match (« version du match », consultable par l'adversaire).
ALTER TABLE "LeagueMatchSheet" ADD COLUMN "rosterSnapshotHome" JSONB;
ALTER TABLE "LeagueMatchSheet" ADD COLUMN "rosterSnapshotAway" JSONB;
