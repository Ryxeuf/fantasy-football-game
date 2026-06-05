-- Lot E — Points bonus configurables par ligue.
--
-- League.bonusPointsConfig : JSON array de regles
-- ([{ id, label, condition: {type, value?}, points, appliesTo }]).
-- null = pas de bonus applique au scoring.
--
-- LeaguePairing.bonusPointsHome/Away : snapshot des points bonus
-- effectivement appliques au scoring du pairing (= delta sur
-- LeagueParticipant.points).
-- LeaguePairing.bonusBreakdown : audit JSON des regles matchees.

ALTER TABLE "League"
  ADD COLUMN "bonusPointsConfig" JSONB;

ALTER TABLE "LeaguePairing"
  ADD COLUMN "bonusPointsHome" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bonusPointsAway" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bonusBreakdown" JSONB;
