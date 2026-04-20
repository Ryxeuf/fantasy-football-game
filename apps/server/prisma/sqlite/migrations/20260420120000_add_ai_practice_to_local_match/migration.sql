-- N.4 — Mode pratique contre IA : extension du modele LocalMatch.
PRAGMA foreign_keys=OFF;

ALTER TABLE "LocalMatch" ADD COLUMN "aiOpponent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LocalMatch" ADD COLUMN "aiDifficulty" TEXT;
ALTER TABLE "LocalMatch" ADD COLUMN "aiTeamSide" TEXT;

CREATE INDEX "LocalMatch_aiOpponent_idx" ON "LocalMatch"("aiOpponent");

PRAGMA foreign_keys=ON;
