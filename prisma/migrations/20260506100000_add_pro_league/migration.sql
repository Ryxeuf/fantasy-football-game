-- Pro League — sprint Pro League lot 1.A.1.
-- Modèles dédiés à la Pro League simulée (16 équipes, 15 journées).
-- Cf. prisma/schema.prisma sections "Pro League" pour la sémantique
-- complète des champs.

-- CreateTable: ProLeague (singleton league)
CREATE TABLE "public"."ProLeague" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "branding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProLeague_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProLeague_slug_key" ON "public"."ProLeague"("slug");

-- CreateTable: ProTeam (16 fixed teams)
CREATE TABLE "public"."ProTeam" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "race" TEXT NOT NULL,
    "nflFlavor" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "baseTv" INTEGER NOT NULL DEFAULT 1000,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProTeam_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProTeam_slug_key" ON "public"."ProTeam"("slug");
CREATE INDEX "ProTeam_leagueId_idx" ON "public"."ProTeam"("leagueId");

ALTER TABLE "public"."ProTeam" ADD CONSTRAINT "ProTeam_leagueId_fkey"
    FOREIGN KEY ("leagueId") REFERENCES "public"."ProLeague"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProTeamRoster
CREATE TABLE "public"."ProTeamRoster" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "ma" INTEGER NOT NULL,
    "st" INTEGER NOT NULL,
    "ag" INTEGER NOT NULL,
    "pa" INTEGER,
    "av" INTEGER NOT NULL,
    "skills" JSONB NOT NULL,
    "niggling" INTEGER NOT NULL DEFAULT 0,
    "maReduction" INTEGER NOT NULL DEFAULT 0,
    "stReduction" INTEGER NOT NULL DEFAULT 0,
    "agReduction" INTEGER NOT NULL DEFAULT 0,
    "avReduction" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "form" INTEGER NOT NULL DEFAULT 50,
    "careerStats" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProTeamRoster_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProTeamRoster_teamId_status_idx" ON "public"."ProTeamRoster"("teamId", "status");

ALTER TABLE "public"."ProTeamRoster" ADD CONSTRAINT "ProTeamRoster_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."ProTeam"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProLeagueSeason
CREATE TABLE "public"."ProLeagueSeason" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "engineVer" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProLeagueSeason_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProLeagueSeason_leagueId_year_key" ON "public"."ProLeagueSeason"("leagueId", "year");
CREATE INDEX "ProLeagueSeason_status_idx" ON "public"."ProLeagueSeason"("status");

ALTER TABLE "public"."ProLeagueSeason" ADD CONSTRAINT "ProLeagueSeason_leagueId_fkey"
    FOREIGN KEY ("leagueId") REFERENCES "public"."ProLeague"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProLeagueRound
CREATE TABLE "public"."ProLeagueRound" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProLeagueRound_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProLeagueRound_seasonId_roundNumber_key" ON "public"."ProLeagueRound"("seasonId", "roundNumber");
CREATE INDEX "ProLeagueRound_status_idx" ON "public"."ProLeagueRound"("status");

ALTER TABLE "public"."ProLeagueRound" ADD CONSTRAINT "ProLeagueRound_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "public"."ProLeagueSeason"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProLeagueMatch
CREATE TABLE "public"."ProLeagueMatch" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "simulatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "seed" BIGINT,
    "engineVer" TEXT,
    "replayId" TEXT,
    "scoreHome" INTEGER,
    "scoreAway" INTEGER,
    "outcome" TEXT,
    "touchdownCount" INTEGER,
    "casualtyCount" INTEGER,
    "turnoverCount" INTEGER,
    "nuffleCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProLeagueMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProLeagueMatch_replayId_key" ON "public"."ProLeagueMatch"("replayId");
CREATE INDEX "ProLeagueMatch_seasonId_status_idx" ON "public"."ProLeagueMatch"("seasonId", "status");
CREATE INDEX "ProLeagueMatch_roundId_idx" ON "public"."ProLeagueMatch"("roundId");
CREATE INDEX "ProLeagueMatch_scheduledAt_idx" ON "public"."ProLeagueMatch"("scheduledAt");
CREATE INDEX "ProLeagueMatch_homeTeamId_idx" ON "public"."ProLeagueMatch"("homeTeamId");
CREATE INDEX "ProLeagueMatch_awayTeamId_idx" ON "public"."ProLeagueMatch"("awayTeamId");

ALTER TABLE "public"."ProLeagueMatch" ADD CONSTRAINT "ProLeagueMatch_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "public"."ProLeagueSeason"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ProLeagueMatch" ADD CONSTRAINT "ProLeagueMatch_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "public"."ProLeagueRound"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ProLeagueMatch" ADD CONSTRAINT "ProLeagueMatch_homeTeamId_fkey"
    FOREIGN KEY ("homeTeamId") REFERENCES "public"."ProTeam"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ProLeagueMatch" ADD CONSTRAINT "ProLeagueMatch_awayTeamId_fkey"
    FOREIGN KEY ("awayTeamId") REFERENCES "public"."ProTeam"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProLeagueStandings
CREATE TABLE "public"."ProLeagueStandings" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tdFor" INTEGER NOT NULL DEFAULT 0,
    "tdAgainst" INTEGER NOT NULL DEFAULT 0,
    "casualtiesFor" INTEGER NOT NULL DEFAULT 0,
    "casualtiesAgainst" INTEGER NOT NULL DEFAULT 0,
    "form" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProLeagueStandings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProLeagueStandings_seasonId_teamId_key" ON "public"."ProLeagueStandings"("seasonId", "teamId");
CREATE INDEX "ProLeagueStandings_seasonId_points_tdFor_idx" ON "public"."ProLeagueStandings"("seasonId", "points", "tdFor");

ALTER TABLE "public"."ProLeagueStandings" ADD CONSTRAINT "ProLeagueStandings_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "public"."ProLeagueSeason"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ProLeagueStandings" ADD CONSTRAINT "ProLeagueStandings_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."ProTeam"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
