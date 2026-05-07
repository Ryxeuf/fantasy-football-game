-- Pro League badges (sprint 1.D.9). Catalogue est en code, table
-- stocke uniquement les badges effectivement débloqués par les users.

CREATE TABLE "public"."ProUserBadge" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "badgeCode" TEXT NOT NULL,
    "earnedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta"      JSONB,

    CONSTRAINT "ProUserBadge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProUserBadge_userId_badgeCode_key"
  ON "public"."ProUserBadge"("userId", "badgeCode");

CREATE INDEX "ProUserBadge_badgeCode_idx"
  ON "public"."ProUserBadge"("badgeCode");

CREATE INDEX "ProUserBadge_userId_idx"
  ON "public"."ProUserBadge"("userId");

ALTER TABLE "public"."ProUserBadge"
  ADD CONSTRAINT "ProUserBadge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
