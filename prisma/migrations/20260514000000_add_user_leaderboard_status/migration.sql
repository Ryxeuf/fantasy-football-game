-- Lot — Visibilite du joueur dans le classement ELO.
--
-- Ajoute un statut "leaderboardStatus" sur User pour permettre a un
-- admin de masquer un joueur du classement public ELO et des sections
-- ELO de son profil coach (`/coach/{slug}`). Le profil reste visible
-- (le coach existe, ses equipes et succes sont publics) mais la
-- section ELO est remplacee par un badge "Non classe" cote UI.
--
-- Valeurs supportees :
--   - "visible" (defaut) : comportement normal.
--   - "hidden_admin"     : retire du leaderboard + sections ELO masquees.
--
-- L'enum est materialise en TEXT (et non un type ENUM Postgres) pour
-- coherence avec le reste de la base et pour rester compatible avec
-- le mirror SQLite des tests.
--
-- Aucun backfill : tous les comptes existants prennent "visible".

ALTER TABLE "User"
    ADD COLUMN "leaderboardStatus" TEXT NOT NULL DEFAULT 'visible',
    ADD COLUMN "leaderboardStatusReason" TEXT,
    ADD COLUMN "leaderboardStatusUpdatedAt" TIMESTAMP(3),
    ADD COLUMN "leaderboardStatusUpdatedBy" TEXT;

-- Index sur le statut : le leaderboard public filtre dessus a chaque
-- requete et la quasi-totalite des comptes sera "visible", donc la
-- selectivite est faible cote "visible" mais utile pour les listes
-- admin filtrant "hidden_admin".
CREATE INDEX "User_leaderboardStatus_idx" ON "User"("leaderboardStatus");
