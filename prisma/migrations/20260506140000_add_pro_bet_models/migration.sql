-- Pro League bet markets + bets + settlements (sprint 1.D.2).

-- CreateTable: ProBetMarket
CREATE TABLE "public"."ProBetMarket" (
    "id"        TEXT NOT NULL,
    "matchId"   TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "config"    JSONB NOT NULL,
    "status"    TEXT NOT NULL DEFAULT 'open',
    "closesAt"  TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProBetMarket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProBetMarket_matchId_type_key"
  ON "public"."ProBetMarket"("matchId", "type");

CREATE INDEX "ProBetMarket_status_closesAt_idx"
  ON "public"."ProBetMarket"("status", "closesAt");

ALTER TABLE "public"."ProBetMarket"
  ADD CONSTRAINT "ProBetMarket_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "public"."ProLeagueMatch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProBet
CREATE TABLE "public"."ProBet" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "marketId"     TEXT NOT NULL,
    "selection"    TEXT NOT NULL,
    "stake"        INTEGER NOT NULL,
    "oddsAtPlace"  DOUBLE PRECISION NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'pending',
    "payoutAmount" INTEGER,
    "clientToken"  TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProBet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProBet_clientToken_key"
  ON "public"."ProBet"("clientToken");

CREATE INDEX "ProBet_userId_createdAt_idx"
  ON "public"."ProBet"("userId", "createdAt");

CREATE INDEX "ProBet_marketId_status_idx"
  ON "public"."ProBet"("marketId", "status");

CREATE INDEX "ProBet_status_idx"
  ON "public"."ProBet"("status");

ALTER TABLE "public"."ProBet"
  ADD CONSTRAINT "ProBet_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ProBet"
  ADD CONSTRAINT "ProBet_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "public"."ProBetMarket"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProBetSettlement
CREATE TABLE "public"."ProBetSettlement" (
    "id"               TEXT NOT NULL,
    "marketId"         TEXT NOT NULL,
    "winningSelection" TEXT NOT NULL,
    "totalStake"       INTEGER NOT NULL DEFAULT 0,
    "totalPayout"      INTEGER NOT NULL DEFAULT 0,
    "betCount"         INTEGER NOT NULL DEFAULT 0,
    "settledAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProBetSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProBetSettlement_marketId_key"
  ON "public"."ProBetSettlement"("marketId");

ALTER TABLE "public"."ProBetSettlement"
  ADD CONSTRAINT "ProBetSettlement_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "public"."ProBetMarket"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
