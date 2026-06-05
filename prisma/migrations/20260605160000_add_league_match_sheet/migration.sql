-- Lot G — Feuille de match v2 (saisie joueurs + validation commissaire).
--
-- LeagueMatchSheet : 1-1 avec LeaguePairing. Workflow status
-- draft -> submitted_home/away -> both_submitted -> validated
-- -> invalidated. Scores + blesses derives des events.
--
-- LeagueMatchEvent : evenements unitaires normalises (kickoff, TD,
-- casualty, pass, interception, aggression, expulsion, crowd_surge,
-- stalling, other_elim) pour agregation + edition fine.

CREATE TABLE "LeagueMatchSheet" (
  "id" TEXT NOT NULL,
  "pairingId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "submittedByHomeAt" TIMESTAMP(3),
  "submittedByAwayAt" TIMESTAMP(3),
  "validatedAt" TIMESTAMP(3),
  "validatedById" TEXT,
  "invalidatedAt" TIMESTAMP(3),
  "invalidationReason" TEXT,
  "weather" TEXT,
  "popularityHome" INTEGER,
  "popularityAway" INTEGER,
  "inducementsHome" JSONB,
  "inducementsAway" JSONB,
  "prayersHome" JSONB,
  "prayersAway" JSONB,
  "scoreHome" INTEGER NOT NULL DEFAULT 0,
  "scoreAway" INTEGER NOT NULL DEFAULT 0,
  "winningsHome" INTEGER NOT NULL DEFAULT 0,
  "winningsAway" INTEGER NOT NULL DEFAULT 0,
  "winningsHomeManual" INTEGER,
  "winningsAwayManual" INTEGER,
  "dedicatedFansDeltaHome" INTEGER,
  "dedicatedFansDeltaAway" INTEGER,
  "costlyErrorsHome" JSONB,
  "costlyErrorsAway" JSONB,
  "motmPlayerIds" JSONB NOT NULL DEFAULT '[]',
  "purchasesHome" JSONB,
  "purchasesAway" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeagueMatchSheet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeagueMatchSheet_pairingId_key" ON "LeagueMatchSheet"("pairingId");
CREATE INDEX "LeagueMatchSheet_status_idx" ON "LeagueMatchSheet"("status");

ALTER TABLE "LeagueMatchSheet" ADD CONSTRAINT "LeagueMatchSheet_pairingId_fkey"
  FOREIGN KEY ("pairingId") REFERENCES "LeaguePairing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LeagueMatchEvent" (
  "id" TEXT NOT NULL,
  "matchSheetId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "team" TEXT,
  "actorPlayerId" TEXT,
  "targetPlayerId" TEXT,
  "causeDetail" TEXT,
  "injurySeverity" TEXT,
  "meta" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeagueMatchEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeagueMatchEvent_matchSheetId_kind_idx" ON "LeagueMatchEvent"("matchSheetId", "kind");

ALTER TABLE "LeagueMatchEvent" ADD CONSTRAINT "LeagueMatchEvent_matchSheetId_fkey"
  FOREIGN KEY ("matchSheetId") REFERENCES "LeagueMatchSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
