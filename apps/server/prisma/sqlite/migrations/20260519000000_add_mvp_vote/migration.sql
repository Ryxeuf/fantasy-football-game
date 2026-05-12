-- Sprint Q lot Q.B.1 — Migration miroir sqlite : Vote MVP.

CREATE TABLE "ProPlayerOfMatchVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "votedRosterId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProPlayerOfMatchVote_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProPlayerOfMatchVote_matchId_fkey"
        FOREIGN KEY ("matchId") REFERENCES "ProLeagueMatch" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProPlayerOfMatchVote_votedRosterId_fkey"
        FOREIGN KEY ("votedRosterId") REFERENCES "ProTeamRoster" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProPlayerOfMatchVote_userId_matchId_key"
    ON "ProPlayerOfMatchVote"("userId", "matchId");
CREATE INDEX "ProPlayerOfMatchVote_matchId_votedRosterId_idx"
    ON "ProPlayerOfMatchVote"("matchId", "votedRosterId");
CREATE INDEX "ProPlayerOfMatchVote_votedRosterId_createdAt_idx"
    ON "ProPlayerOfMatchVote"("votedRosterId", "createdAt");
