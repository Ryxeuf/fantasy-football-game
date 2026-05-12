-- Sprint Q lot Q.A.1 — Snapshot stats career joueur.
--
-- Table 1-1 avec ProTeamRoster via playerId @unique. Mise a jour
-- "best-effort lazy" lors de la lecture si recomputedAt est obsolete.

CREATE TABLE "ProPlayerCareerSnapshot" (
    "id" TEXT NOT NULL,
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
    "recomputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProPlayerCareerSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProPlayerCareerSnapshot_playerId_key"
    ON "ProPlayerCareerSnapshot"("playerId");
CREATE INDEX "ProPlayerCareerSnapshot_recomputedAt_idx"
    ON "ProPlayerCareerSnapshot"("recomputedAt");

ALTER TABLE "ProPlayerCareerSnapshot" ADD CONSTRAINT "ProPlayerCareerSnapshot_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "ProTeamRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
