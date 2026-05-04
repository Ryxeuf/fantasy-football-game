-- L2.A.1 — Sprint Ligues v2 : pairing pre-genere du calendrier round-robin.
-- Materialise une rencontre planifiee (home vs away) avant qu'un match
-- concret ne soit cree. Le statut suit le cycle :
--   scheduled  -> aucun match cree
--   in_progress -> match cree (matchId renseigne) et en cours
--   played      -> match termine et resultat reporte au classement
--   forfeit_home / forfeit_away -> forfait cron-applique
--   cancelled   -> annule par admin
--
-- Ajoute aussi `Match.leaguePairingId` (unique, nullable) pour relier un
-- match a son pairing. Permet la mise a jour du statut au moment ou
-- `recordLeagueMatchResult` comptabilise le score (cf. L2.A.5).

-- CreateTable
CREATE TABLE "public"."LeaguePairing" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "homeParticipantId" TEXT NOT NULL,
    "awayParticipantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaguePairing_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "public"."Match" ADD COLUMN "leaguePairingId" TEXT;

-- CreateIndex
CREATE INDEX "LeaguePairing_roundId_idx" ON "public"."LeaguePairing"("roundId");
CREATE INDEX "LeaguePairing_status_idx" ON "public"."LeaguePairing"("status");
CREATE INDEX "LeaguePairing_deadlineAt_status_idx" ON "public"."LeaguePairing"("deadlineAt", "status");
CREATE INDEX "LeaguePairing_homeParticipantId_idx" ON "public"."LeaguePairing"("homeParticipantId");
CREATE INDEX "LeaguePairing_awayParticipantId_idx" ON "public"."LeaguePairing"("awayParticipantId");

-- CreateIndex (unique)
CREATE UNIQUE INDEX "Match_leaguePairingId_key" ON "public"."Match"("leaguePairingId");

-- AddForeignKey
ALTER TABLE "public"."LeaguePairing" ADD CONSTRAINT "LeaguePairing_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "public"."LeagueRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."LeaguePairing" ADD CONSTRAINT "LeaguePairing_homeParticipantId_fkey" FOREIGN KEY ("homeParticipantId") REFERENCES "public"."LeagueParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."LeaguePairing" ADD CONSTRAINT "LeaguePairing_awayParticipantId_fkey" FOREIGN KEY ("awayParticipantId") REFERENCES "public"."LeagueParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_leaguePairingId_fkey" FOREIGN KEY ("leaguePairingId") REFERENCES "public"."LeaguePairing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
