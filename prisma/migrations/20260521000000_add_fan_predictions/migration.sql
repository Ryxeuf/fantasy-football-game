-- Sprint Q lot Q.B.3 — Fan predictions pre-match.
--
-- 1 prediction par user par match (unique matchId+userId). Body
-- max 200 chars verifie cote service. Score (perfect|winner|wrong)
-- attribue au settlement via heuristique.

CREATE TABLE "ProMatchPrediction" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "score" TEXT,
    "scoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProMatchPrediction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProMatchPrediction_matchId_userId_key"
    ON "ProMatchPrediction"("matchId", "userId");
CREATE INDEX "ProMatchPrediction_matchId_createdAt_idx"
    ON "ProMatchPrediction"("matchId", "createdAt");
CREATE INDEX "ProMatchPrediction_userId_score_idx"
    ON "ProMatchPrediction"("userId", "score");

ALTER TABLE "ProMatchPrediction" ADD CONSTRAINT "ProMatchPrediction_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "ProLeagueMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProMatchPrediction" ADD CONSTRAINT "ProMatchPrediction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
