-- Pro League Gazette articles (sprint 1.E.2).

CREATE TABLE "public"."ProGazetteArticle" (
    "id"               TEXT NOT NULL,
    "date"             TIMESTAMP(3) NOT NULL,
    "type"             TEXT NOT NULL,
    "persona"          TEXT,
    "title"            TEXT NOT NULL,
    "body"             TEXT NOT NULL,
    "relatedTeamIds"   JSONB,
    "relatedPlayerIds" JSONB,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProGazetteArticle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProGazetteArticle_date_idx" ON "public"."ProGazetteArticle"("date");
CREATE INDEX "ProGazetteArticle_type_date_idx"
  ON "public"."ProGazetteArticle"("type", "date");
