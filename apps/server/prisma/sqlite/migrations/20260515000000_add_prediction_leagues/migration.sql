-- Sprint Q lot Q.D.1 — Migration miroir sqlite : prediction mini-leagues.

CREATE TABLE "ProPredictionLeague" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProPredictionLeague_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "User" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProPredictionLeague_joinCode_key" ON "ProPredictionLeague"("joinCode");
CREATE INDEX "ProPredictionLeague_ownerId_idx" ON "ProPredictionLeague"("ownerId");


CREATE TABLE "ProPredictionLeagueMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProPredictionLeagueMember_leagueId_fkey"
        FOREIGN KEY ("leagueId") REFERENCES "ProPredictionLeague" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProPredictionLeagueMember_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProPredictionLeagueMember_leagueId_userId_key"
    ON "ProPredictionLeagueMember"("leagueId", "userId");
CREATE INDEX "ProPredictionLeagueMember_userId_idx" ON "ProPredictionLeagueMember"("userId");


CREATE TABLE "ProPredictionPick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "result" TEXT,
    "correct" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProPredictionPick_leagueId_fkey"
        FOREIGN KEY ("leagueId") REFERENCES "ProPredictionLeague" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProPredictionPick_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProPredictionPick_matchId_fkey"
        FOREIGN KEY ("matchId") REFERENCES "ProLeagueMatch" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProPredictionPick_leagueId_userId_matchId_key"
    ON "ProPredictionPick"("leagueId", "userId", "matchId");
CREATE INDEX "ProPredictionPick_leagueId_matchId_idx" ON "ProPredictionPick"("leagueId", "matchId");
CREATE INDEX "ProPredictionPick_userId_createdAt_idx" ON "ProPredictionPick"("userId", "createdAt");
