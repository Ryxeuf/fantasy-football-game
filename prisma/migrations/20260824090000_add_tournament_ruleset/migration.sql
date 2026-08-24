-- Règlement de tournoi (slug du registre @bb/game-engine, ex :
-- "naf_world_cup_2027"). Axe orthogonal au ruleset (édition) et au format.
-- NULL = aucun règlement (règles standard) : migration additive, aucune
-- donnée existante modifiée.
ALTER TABLE "Team" ADD COLUMN "tournamentRuleset" TEXT;
ALTER TABLE "League" ADD COLUMN "tournamentRuleset" TEXT;
ALTER TABLE "Cup" ADD COLUMN "tournamentRuleset" TEXT;
