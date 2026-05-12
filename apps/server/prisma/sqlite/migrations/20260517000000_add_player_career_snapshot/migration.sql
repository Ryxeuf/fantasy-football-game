-- Sprint Q lot Q.A.1 — Migration miroir sqlite : Snapshot career joueur.

CREATE TABLE "ProPlayerCareerSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "tdTotal" INTEGER NOT NULL DEFAULT 0,
    "casTotal" INTEGER NOT NULL DEFAULT 0,
    "compTotal" INTEGER NOT NULL DEFAULT 0,
    "mvpTotal" INTEGER NOT NULL DEFAULT 0,
    "sppTotal" INTEGER NOT NULL DEFAULT 0,
    "bestMatchId" TEXT,
    "bestMatchSpp" INTEGER,
    "worstMatchId" TEXT,
    "worstMatchSpp" INTEGER,
    "topNemesisTeamId" TEXT,
    "topVictoryTeamId" TEXT,
    "streakKind" TEXT NOT NULL DEFAULT 'none',
    "streakLength" INTEGER NOT NULL DEFAULT 0,
    "recomputedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProPlayerCareerSnapshot_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "ProTeamRoster" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProPlayerCareerSnapshot_playerId_key"
    ON "ProPlayerCareerSnapshot"("playerId");
CREATE INDEX "ProPlayerCareerSnapshot_recomputedAt_idx"
    ON "ProPlayerCareerSnapshot"("recomputedAt");
