-- Sprint Q lot Q.B.2 — Migration miroir sqlite : commentaires Gazette.

CREATE TABLE "ProGazetteComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" DATETIME,
    "flaggedAt" DATETIME,
    "flagReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProGazetteComment_articleId_fkey"
        FOREIGN KEY ("articleId") REFERENCES "ProGazetteArticle" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProGazetteComment_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProGazetteComment_articleId_createdAt_idx"
    ON "ProGazetteComment"("articleId", "createdAt");
CREATE INDEX "ProGazetteComment_userId_createdAt_idx"
    ON "ProGazetteComment"("userId", "createdAt");
CREATE INDEX "ProGazetteComment_flaggedAt_idx"
    ON "ProGazetteComment"("flaggedAt");
CREATE INDEX "ProGazetteComment_deletedAt_idx"
    ON "ProGazetteComment"("deletedAt");
