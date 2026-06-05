-- Lot C — Multi-poules pour les ligues.
--
-- Une saison peut etre divisee en plusieurs poules (groupes).
-- Comportement legacy preserve : si une saison n'a aucune poule,
-- elle se comporte exactement comme avant (single-pool implicite).
--
-- LeaguePool : poule d'une saison, avec qualifiesForPlayoffs pour
-- preciser combien d'equipes du top vont en playoffs.
-- LeagueParticipant.poolId : affectation a une poule (nullable).
-- LeagueRound.poolId : round optionnellement rattache a une poule
-- (multi-poules : chaque poule a son round-robin propre).

CREATE TABLE "LeaguePool" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "color" TEXT,
  "qualifiesForPlayoffs" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaguePool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaguePool_seasonId_name_key" ON "LeaguePool"("seasonId", "name");
CREATE INDEX "LeaguePool_seasonId_order_idx" ON "LeaguePool"("seasonId", "order");

ALTER TABLE "LeaguePool" ADD CONSTRAINT "LeaguePool_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "LeagueSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeagueParticipant" ADD COLUMN "poolId" TEXT;
CREATE INDEX "LeagueParticipant_seasonId_poolId_idx" ON "LeagueParticipant"("seasonId", "poolId");
ALTER TABLE "LeagueParticipant" ADD CONSTRAINT "LeagueParticipant_poolId_fkey"
  FOREIGN KEY ("poolId") REFERENCES "LeaguePool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeagueRound" ADD COLUMN "poolId" TEXT;
CREATE INDEX "LeagueRound_seasonId_poolId_roundNumber_idx"
  ON "LeagueRound"("seasonId", "poolId", "roundNumber");
ALTER TABLE "LeagueRound" ADD CONSTRAINT "LeagueRound_poolId_fkey"
  FOREIGN KEY ("poolId") REFERENCES "LeaguePool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
