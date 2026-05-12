-- Sprint Q lot Q.D.1 — Prediction mini-leagues privees.
--
-- Trois tables :
--   - ProPredictionLeague : la ligue de pronostics (1 par groupe d'amis).
--   - ProPredictionLeagueMember : membres (1 par couple ligue/user).
--   - ProPredictionPick : pick d'un user sur un match dans une ligue.
--
-- Cascade onDelete pour ProPredictionLeague : si la ligue est supprimee,
-- les membres et picks sont nettoyes. Idem si l'owner supprime son
-- compte (cascade depuis User).

CREATE TABLE "ProPredictionLeague" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProPredictionLeague_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProPredictionLeague_joinCode_key" ON "ProPredictionLeague"("joinCode");
CREATE INDEX "ProPredictionLeague_ownerId_idx" ON "ProPredictionLeague"("ownerId");

ALTER TABLE "ProPredictionLeague" ADD CONSTRAINT "ProPredictionLeague_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE "ProPredictionLeagueMember" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProPredictionLeagueMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProPredictionLeagueMember_leagueId_userId_key"
    ON "ProPredictionLeagueMember"("leagueId", "userId");
CREATE INDEX "ProPredictionLeagueMember_userId_idx"
    ON "ProPredictionLeagueMember"("userId");

ALTER TABLE "ProPredictionLeagueMember" ADD CONSTRAINT "ProPredictionLeagueMember_leagueId_fkey"
    FOREIGN KEY ("leagueId") REFERENCES "ProPredictionLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProPredictionLeagueMember" ADD CONSTRAINT "ProPredictionLeagueMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE "ProPredictionPick" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "result" TEXT,
    "correct" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProPredictionPick_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProPredictionPick_leagueId_userId_matchId_key"
    ON "ProPredictionPick"("leagueId", "userId", "matchId");
CREATE INDEX "ProPredictionPick_leagueId_matchId_idx"
    ON "ProPredictionPick"("leagueId", "matchId");
CREATE INDEX "ProPredictionPick_userId_createdAt_idx"
    ON "ProPredictionPick"("userId", "createdAt");

ALTER TABLE "ProPredictionPick" ADD CONSTRAINT "ProPredictionPick_leagueId_fkey"
    FOREIGN KEY ("leagueId") REFERENCES "ProPredictionLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProPredictionPick" ADD CONSTRAINT "ProPredictionPick_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProPredictionPick" ADD CONSTRAINT "ProPredictionPick_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "ProLeagueMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
