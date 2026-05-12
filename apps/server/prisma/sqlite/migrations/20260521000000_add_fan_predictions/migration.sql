-- Sprint Q lot Q.B.3 — Migration miroir sqlite : Fan predictions.

CREATE TABLE "ProMatchPrediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "score" TEXT,
    "scoredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProMatchPrediction_matchId_fkey"
        FOREIGN KEY ("matchId") REFERENCES "ProLeagueMatch" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProMatchPrediction_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProMatchPrediction_matchId_userId_key"
    ON "ProMatchPrediction"("matchId", "userId");
CREATE INDEX "ProMatchPrediction_matchId_createdAt_idx"
    ON "ProMatchPrediction"("matchId", "createdAt");
CREATE INDEX "ProMatchPrediction_userId_score_idx"
    ON "ProMatchPrediction"("userId", "score");
