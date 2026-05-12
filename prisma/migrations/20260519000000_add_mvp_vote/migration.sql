-- Sprint Q lot Q.B.1 — Vote Player of the Match.
--
-- 1 vote par user par match (unique userId+matchId). Window 24h
-- ouverte apres match.completedAt, verifiee cote service.

CREATE TABLE "ProPlayerOfMatchVote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "votedRosterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProPlayerOfMatchVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProPlayerOfMatchVote_userId_matchId_key"
    ON "ProPlayerOfMatchVote"("userId", "matchId");
CREATE INDEX "ProPlayerOfMatchVote_matchId_votedRosterId_idx"
    ON "ProPlayerOfMatchVote"("matchId", "votedRosterId");
CREATE INDEX "ProPlayerOfMatchVote_votedRosterId_createdAt_idx"
    ON "ProPlayerOfMatchVote"("votedRosterId", "createdAt");

ALTER TABLE "ProPlayerOfMatchVote" ADD CONSTRAINT "ProPlayerOfMatchVote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProPlayerOfMatchVote" ADD CONSTRAINT "ProPlayerOfMatchVote_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "ProLeagueMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProPlayerOfMatchVote" ADD CONSTRAINT "ProPlayerOfMatchVote_votedRosterId_fkey"
    FOREIGN KEY ("votedRosterId") REFERENCES "ProTeamRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
