-- L2.C.5 — Sprint Ligues v2 PR9 : tie-break configurable.
-- Ajoute `League.tieBreakRules` (JSON array de slugs) pour permettre
-- au createur de la ligue de personnaliser l'ordre de departage du
-- classement. null (default) = ordre historique :
--   ["points","td_diff","td_for","season_elo","name"].

ALTER TABLE "public"."League" ADD COLUMN "tieBreakRules" TEXT;
