-- A68 (données) — les Séquelles n'incrémentaient que les compteurs
-- xxReduction sans jamais muter la caractéristique de base : aucun
-- affichage ni le moteur ne les consommait. Le code applique désormais
-- la perte directement sur ma/st/ag/pa/av ; cette migration répercute
-- les réductions DÉJÀ accumulées sur les joueurs existants, bornées aux
-- limites BB2025 (MA/ST >= 1, AV >= 3+, AG/PA <= 6+, PA « — » intacte).
UPDATE "TeamPlayer"
SET
  "ma" = GREATEST(1, "ma" - "maReduction"),
  "st" = GREATEST(1, "st" - "stReduction"),
  "ag" = LEAST(6, "ag" + "agReduction"),
  "pa" = CASE WHEN "pa" IS NULL THEN NULL ELSE LEAST(6, "pa" + "paReduction") END,
  "av" = GREATEST(3, "av" - "avReduction")
WHERE "maReduction" > 0
   OR "stReduction" > 0
   OR "agReduction" > 0
   OR ("paReduction" > 0 AND "pa" IS NOT NULL)
   OR "avReduction" > 0;
