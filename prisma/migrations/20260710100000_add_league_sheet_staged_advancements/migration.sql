-- Évolutions saisies sur la feuille de match (staging par coach, avant
-- validation commissaire) : [{ playerId, type, skillSlug?, category?,
-- stat?, d8? }]. Appliquées aux rosters à la validation (enrichies
-- applied/cost), reversées à l'invalidation.
ALTER TABLE "LeagueMatchSheet" ADD COLUMN "advancementsHome" JSONB;
ALTER TABLE "LeagueMatchSheet" ADD COLUMN "advancementsAway" JSONB;
