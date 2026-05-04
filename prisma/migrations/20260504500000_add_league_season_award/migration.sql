-- L2.C.1 — Sprint Ligues v2 PR7 : awards de fin de saison.
-- 1 row par saison (`seasonId @unique`). Snapshot persiste a la
-- cloture de saison ; le JSON `awards` contient le tableau d'entrees
-- structure (top scorer, basher, MVP, etc.). `championUserId` est le
-- 1er du classement final selon les regles de tie-break existantes
-- de `computeSeasonStandings`.

-- CreateTable
CREATE TABLE "public"."LeagueSeasonAward" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "championUserId" TEXT,
    "championTeamId" TEXT,
    "awards" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueSeasonAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (unique)
CREATE UNIQUE INDEX "LeagueSeasonAward_seasonId_key" ON "public"."LeagueSeasonAward"("seasonId");

-- CreateIndex
CREATE INDEX "LeagueSeasonAward_championUserId_idx" ON "public"."LeagueSeasonAward"("championUserId");

-- AddForeignKey
ALTER TABLE "public"."LeagueSeasonAward" ADD CONSTRAINT "LeagueSeasonAward_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."LeagueSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
