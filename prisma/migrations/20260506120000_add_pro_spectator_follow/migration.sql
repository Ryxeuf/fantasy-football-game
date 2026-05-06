-- Pro League fan follow (sprint 1.C.4).

-- CreateTable: ProSpectatorFollow
CREATE TABLE "public"."ProSpectatorFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proTeamId" TEXT NOT NULL,
    "since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProSpectatorFollow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProSpectatorFollow_userId_proTeamId_key"
  ON "public"."ProSpectatorFollow"("userId", "proTeamId");

CREATE INDEX "ProSpectatorFollow_userId_idx"
  ON "public"."ProSpectatorFollow"("userId");

CREATE INDEX "ProSpectatorFollow_proTeamId_idx"
  ON "public"."ProSpectatorFollow"("proTeamId");

ALTER TABLE "public"."ProSpectatorFollow"
  ADD CONSTRAINT "ProSpectatorFollow_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ProSpectatorFollow"
  ADD CONSTRAINT "ProSpectatorFollow_proTeamId_fkey"
  FOREIGN KEY ("proTeamId") REFERENCES "public"."ProTeam"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
