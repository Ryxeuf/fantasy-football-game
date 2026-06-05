-- Lot A — Invitations de ligue.
--
-- Permet au commissaire (createur de la ligue) ou a un admin
-- d'inviter un coach a rejoindre une saison via :
--   - userId interne (autocomplete coach search)
--   - email (futur : envoi mail)
--   - lien public (`code`) shareable
--
-- Statuts : pending | accepted | declined | cancelled | expired.
-- Expiration : la column `expiresAt` permet un job de housekeeping
-- (futur) qui passe en "expired" les invitations pending periamees.

CREATE TABLE "LeagueInvitation" (
  "id" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "seasonId" TEXT,
  "inviterUserId" TEXT NOT NULL,
  "inviteeUserId" TEXT,
  "inviteeTeamId" TEXT,
  "inviteeEmail" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "code" TEXT NOT NULL,
  "message" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "acceptedParticipantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeagueInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeagueInvitation_code_key" ON "LeagueInvitation"("code");
CREATE INDEX "LeagueInvitation_leagueId_status_idx" ON "LeagueInvitation"("leagueId", "status");
CREATE INDEX "LeagueInvitation_inviteeUserId_status_idx" ON "LeagueInvitation"("inviteeUserId", "status");
CREATE INDEX "LeagueInvitation_code_idx" ON "LeagueInvitation"("code");
CREATE INDEX "LeagueInvitation_expiresAt_status_idx" ON "LeagueInvitation"("expiresAt", "status");

ALTER TABLE "LeagueInvitation" ADD CONSTRAINT "LeagueInvitation_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueInvitation" ADD CONSTRAINT "LeagueInvitation_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "LeagueSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeagueInvitation" ADD CONSTRAINT "LeagueInvitation_inviterUserId_fkey"
  FOREIGN KEY ("inviterUserId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "LeagueInvitation" ADD CONSTRAINT "LeagueInvitation_inviteeUserId_fkey"
  FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeagueInvitation" ADD CONSTRAINT "LeagueInvitation_inviteeTeamId_fkey"
  FOREIGN KEY ("inviteeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
