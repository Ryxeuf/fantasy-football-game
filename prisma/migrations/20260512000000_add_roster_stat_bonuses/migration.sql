-- Lot 4.D.1 — Stat increases gagnes via doubles roll au level-up.
--
-- BB rules (Season 2/3) : sur un advancement roll, un "double"
-- (1/6 sur 2D6) permet au coach de prendre un stat increase au lieu
-- d'un skill General. Notre level-up applier (Lot 3.C.4) simule cette
-- proba via mulberry32 et stocke le resultat dans ces compteurs.
--
-- Costs ajoutes a la TV (cf. computePlayerTv) :
--   MA / AV = +30k chacun
--   AG      = +40k
--   PA      = +20k
--   ST      = +80k (rare et tres puissant)
--
-- Aucune migration de donnees : tous les rosters existants commencent
-- a 0 sur tous les compteurs (les stat increases passes ne sont pas
-- retroactivement attribues).

ALTER TABLE "ProTeamRoster"
    ADD COLUMN "maBonus" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "agBonus" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "paBonus" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "avBonus" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "stBonus" INTEGER NOT NULL DEFAULT 0;
