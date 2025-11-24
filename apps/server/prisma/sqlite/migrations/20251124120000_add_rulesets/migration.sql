PRAGMA foreign_keys=OFF;

ALTER TABLE "Team" ADD COLUMN "ruleset" TEXT NOT NULL DEFAULT 'season_2';
ALTER TABLE "Cup" ADD COLUMN "ruleset" TEXT NOT NULL DEFAULT 'season_2';

PRAGMA foreign_keys=ON;

