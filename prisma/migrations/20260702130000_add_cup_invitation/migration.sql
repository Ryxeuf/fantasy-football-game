-- Invitations de coupe (miroir de LeagueInvitation, sans saison).
-- Modes : ciblée (inviteeUserId/inviteeEmail) ou lien public (code seul).
-- Statuts : pending | accepted | declined | cancelled | expired.

CREATE TABLE "CupInvitation" (
  "id" TEXT NOT NULL,
  "cupId" TEXT NOT NULL,
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
  CONSTRAINT "CupInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CupInvitation_code_key" ON "CupInvitation"("code");
CREATE INDEX "CupInvitation_cupId_status_idx" ON "CupInvitation"("cupId", "status");
CREATE INDEX "CupInvitation_inviteeUserId_status_idx" ON "CupInvitation"("inviteeUserId", "status");
CREATE INDEX "CupInvitation_code_idx" ON "CupInvitation"("code");
CREATE INDEX "CupInvitation_expiresAt_status_idx" ON "CupInvitation"("expiresAt", "status");

ALTER TABLE "CupInvitation" ADD CONSTRAINT "CupInvitation_cupId_fkey"
  FOREIGN KEY ("cupId") REFERENCES "Cup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CupInvitation" ADD CONSTRAINT "CupInvitation_inviterUserId_fkey"
  FOREIGN KEY ("inviterUserId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "CupInvitation" ADD CONSTRAINT "CupInvitation_inviteeUserId_fkey"
  FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CupInvitation" ADD CONSTRAINT "CupInvitation_inviteeTeamId_fkey"
  FOREIGN KEY ("inviteeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
