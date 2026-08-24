-- Règlements de tournoi éditables en admin (source runtime ; le registre
-- statique @bb/game-engine reste la source de seed et le fallback).
-- Migration additive : aucune donnée existante modifiée. Les colonnes
-- Team/League/Cup.tournamentRuleset continuent de référencer le slug.
CREATE TABLE "TournamentRuleset" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "shortLabel" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "edition" "Ruleset" NOT NULL DEFAULT 'season_3',
    "format" "Format" NOT NULL DEFAULT 'bb11',
    "descriptionFr" TEXT,
    "resurrection" BOOLEAN NOT NULL DEFAULT true,
    "minRegularPlayersBeforeStars" INTEGER NOT NULL DEFAULT 11,
    "rosterRules" JSONB NOT NULL,
    "skillCosts" JSONB NOT NULL,
    "eliteSkills" JSONB,
    "bannedStarPlayers" JSONB,
    "starPlayerSppTax" JSONB,
    "allowedInducements" JSONB,
    "scoring" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentRuleset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentRuleset_slug_key" ON "TournamentRuleset"("slug");
CREATE INDEX "TournamentRuleset_archivedAt_idx" ON "TournamentRuleset"("archivedAt");
