-- Sprint Q lot Q.D.2 — Migration miroir sqlite : Survivor Pick'em.

CREATE TABLE "ProSurvivorEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "weekN" INTEGER NOT NULL,
    "pickedTeamId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "matchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProSurvivorEntry_seasonId_fkey"
        FOREIGN KEY ("seasonId") REFERENCES "ProLeagueSeason" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProSurvivorEntry_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProSurvivorEntry_roundId_fkey"
        FOREIGN KEY ("roundId") REFERENCES "ProLeagueRound" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProSurvivorEntry_pickedTeamId_fkey"
        FOREIGN KEY ("pickedTeamId") REFERENCES "ProTeam" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProSurvivorEntry_seasonId_userId_roundId_key"
    ON "ProSurvivorEntry"("seasonId", "userId", "roundId");
CREATE UNIQUE INDEX "ProSurvivorEntry_seasonId_userId_pickedTeamId_key"
    ON "ProSurvivorEntry"("seasonId", "userId", "pickedTeamId");
CREATE INDEX "ProSurvivorEntry_seasonId_weekN_idx" ON "ProSurvivorEntry"("seasonId", "weekN");
CREATE INDEX "ProSurvivorEntry_userId_seasonId_idx" ON "ProSurvivorEntry"("userId", "seasonId");
CREATE INDEX "ProSurvivorEntry_status_idx" ON "ProSurvivorEntry"("status");
