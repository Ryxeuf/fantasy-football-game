-- L2.B.1 — Sprint Ligues v2 PR4 : sequence post-match Jeu en Ligue.
-- 1 sequence par Match de ligue (matchId @unique). Cree apres
-- recordLeagueMatchResult pour orchestrer winnings + lasting injuries
-- + level-up choices. Idempotent via les flags `winningsApplied`,
-- `lastingInjuriesApplied`, `advancementsResolved` + status final
-- "completed" quand tous les pendingChoices sont resolus.

-- CreateTable
CREATE TABLE "public"."LeaguePostMatchSequence" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "winningsApplied" BOOLEAN NOT NULL DEFAULT false,
    "lastingInjuriesApplied" BOOLEAN NOT NULL DEFAULT false,
    "advancementsResolved" BOOLEAN NOT NULL DEFAULT false,
    "treasuryDeltaA" INTEGER NOT NULL DEFAULT 0,
    "treasuryDeltaB" INTEGER NOT NULL DEFAULT 0,
    "fanFactorDeltaA" INTEGER NOT NULL DEFAULT 0,
    "fanFactorDeltaB" INTEGER NOT NULL DEFAULT 0,
    "pendingChoices" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LeaguePostMatchSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (unique)
CREATE UNIQUE INDEX "LeaguePostMatchSequence_matchId_key" ON "public"."LeaguePostMatchSequence"("matchId");

-- CreateIndex
CREATE INDEX "LeaguePostMatchSequence_seasonId_idx" ON "public"."LeaguePostMatchSequence"("seasonId");
CREATE INDEX "LeaguePostMatchSequence_status_idx" ON "public"."LeaguePostMatchSequence"("status");

-- AddForeignKey
ALTER TABLE "public"."LeaguePostMatchSequence" ADD CONSTRAINT "LeaguePostMatchSequence_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
