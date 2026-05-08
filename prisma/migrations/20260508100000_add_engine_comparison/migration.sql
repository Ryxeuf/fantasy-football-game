-- Lot 3.B.2 — Snapshots de comparaison hybrid vs full driver.
--
-- Une entree par execution du comparator depuis l'admin
-- (`POST /admin/sim/comparison`). Les runs CLI (`pnpm sim:compare`)
-- ne persistent PAS automatiquement — c'est un choix : le CLI sert
-- aux dev locaux, la table tracke les snapshots officiels.
--
-- Indices :
--   - (engineVer, createdAt)        => time-series par version
--   - (homeTeamId, awayTeamId, …)   => drift par pairing
--
-- Floats stockes en double precision (pas Decimal) — la precision
-- finance-grade n'est pas requise pour ces stats audits.

CREATE TABLE "EngineComparison" (
    "id" TEXT NOT NULL,
    "engineVer" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "matches" INTEGER NOT NULL,
    "seedOffset" INTEGER NOT NULL,
    "meanScoreDelta" DOUBLE PRECISION NOT NULL,
    "p95ScoreDelta" DOUBLE PRECISION NOT NULL,
    "maxScoreDelta" DOUBLE PRECISION NOT NULL,
    "meanTurnoverDelta" DOUBLE PRECISION NOT NULL,
    "meanTouchdownDelta" DOUBLE PRECISION NOT NULL,
    "meanCasualtyDelta" DOUBLE PRECISION NOT NULL,
    "outcomeFlippedCount" INTEGER NOT NULL,
    "divergedPct" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngineComparison_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EngineComparison_engineVer_createdAt_idx"
    ON "EngineComparison"("engineVer", "createdAt");
CREATE INDEX "EngineComparison_homeTeamId_awayTeamId_createdAt_idx"
    ON "EngineComparison"("homeTeamId", "awayTeamId", "createdAt");
