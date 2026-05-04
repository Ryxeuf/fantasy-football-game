-- L2.C.3 — Sprint Ligues v2 PR8 : playoffs (bracket d'elimination
-- directe en fin de saison reguliere).
--
-- Approche minimaliste : on etend les modeles existants au lieu de
-- creer un nouveau modele. Un round playoff est juste un LeagueRound
-- avec `kind="playoff"` + `bracketSlot` ("qf1", "sf1", "final"...) ;
-- les pairings reutilisent LeaguePairing.

-- AlterTable
ALTER TABLE "public"."LeagueSeason" ADD COLUMN "playoffSize" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."LeagueRound" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'regular';
ALTER TABLE "public"."LeagueRound" ADD COLUMN "bracketSlot" TEXT;

-- CreateIndex
CREATE INDEX "LeagueRound_seasonId_kind_idx" ON "public"."LeagueRound"("seasonId", "kind");
