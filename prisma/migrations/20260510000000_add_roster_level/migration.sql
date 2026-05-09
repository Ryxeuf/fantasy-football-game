-- Lot 3.C.4 — Niveau joueur (1..7) calcule depuis SPP.
--
-- Ajoute `ProTeamRoster.level` (default 1 = rookie) qui sera mis a jour
-- transactionnellement par le service `pro-roster-level-up.ts` quand
-- les SPP cumules franchissent un seuil BB officiel
-- (6/16/31/51/76/176).
--
-- Le niveau est `redondant` avec `spp` (calculable a la volee), mais
-- stocke pour :
--   - permettre les requetes "joueurs au-dessus de level 3" sans
--     fonctions SQL custom
--   - servir d'idempotence : si level=3 mais spp>=31 et que skills
--     contient deja les 2 advancements, on n'en ajoute pas un de plus
--   - exposer un compteur lisible dans l'UI roster

ALTER TABLE "ProTeamRoster"
    ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
