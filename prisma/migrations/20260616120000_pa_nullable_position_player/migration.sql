-- PA (Passing) nullable sur Position et Player.
--
-- Certaines positions Blood Bowl n'ont aucune caractéristique de Passe
-- (ex. Cinglé Gobelin, no-hands) : la fiche affiche "-", pas une valeur.
-- On assouplit la contrainte NOT NULL pour représenter cette absence par
-- NULL (cohérent avec StarPlayer.pa, déjà nullable).
--
-- Migration additive et non destructive : les valeurs PA existantes sont
-- conservées. La correction des données (positions sans passe → NULL) est
-- portée par le seed idempotent (`pa = 0` côté game-engine → NULL en base).

ALTER TABLE "Position" ALTER COLUMN "pa" DROP NOT NULL;
ALTER TABLE "TeamPlayer" ALTER COLUMN "pa" DROP NOT NULL;
