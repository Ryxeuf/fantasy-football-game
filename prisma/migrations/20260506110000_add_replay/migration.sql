-- Replay binaire d'un ProLeagueMatch — sprint Pro League lot 1.A.2.
-- Stocke le payload compressé (CBOR + gzip) + highlights pré-extraits.
-- 1-1 avec ProLeagueMatch via matchId @id.

-- CreateTable: Replay
CREATE TABLE "public"."Replay" (
    "matchId" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "highlights" JSONB NOT NULL DEFAULT '[]',
    "durationMs" INTEGER NOT NULL,
    "rawJsonSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Replay_pkey" PRIMARY KEY ("matchId")
);
