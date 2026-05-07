-- Pro League Hall of Fame light (sprint 1.E.5).

CREATE TABLE "public"."ProHallOfFame" (
    "id"          TEXT NOT NULL,
    "rosterId"    TEXT NOT NULL,
    "teamSlug"    TEXT NOT NULL,
    "teamName"    TEXT NOT NULL,
    "playerName"  TEXT NOT NULL,
    "race"        TEXT NOT NULL,
    "position"    TEXT NOT NULL,
    "ma"          INTEGER NOT NULL,
    "st"          INTEGER NOT NULL,
    "ag"          INTEGER NOT NULL,
    "pa"          INTEGER,
    "av"          INTEGER NOT NULL,
    "skills"      JSONB NOT NULL,
    "careerStats" JSONB NOT NULL,
    "reason"      TEXT NOT NULL,
    "citation"    TEXT,
    "inductedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProHallOfFame_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProHallOfFame_rosterId_reason_key"
  ON "public"."ProHallOfFame"("rosterId", "reason");

CREATE INDEX "ProHallOfFame_teamSlug_idx"
  ON "public"."ProHallOfFame"("teamSlug");
CREATE INDEX "ProHallOfFame_reason_idx"
  ON "public"."ProHallOfFame"("reason");
CREATE INDEX "ProHallOfFame_inductedAt_idx"
  ON "public"."ProHallOfFame"("inductedAt");
