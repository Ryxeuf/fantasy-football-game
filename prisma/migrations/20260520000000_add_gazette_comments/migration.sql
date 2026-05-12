-- Sprint Q lot Q.B.2 — Commentaires Gazette + moderation.
--
-- Soft delete via deletedAt + flag via flaggedAt/flagReason.
-- Body max 500 chars verifie cote service.

CREATE TABLE "ProGazetteComment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "flaggedAt" TIMESTAMP(3),
    "flagReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProGazetteComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProGazetteComment_articleId_createdAt_idx"
    ON "ProGazetteComment"("articleId", "createdAt");
CREATE INDEX "ProGazetteComment_userId_createdAt_idx"
    ON "ProGazetteComment"("userId", "createdAt");
CREATE INDEX "ProGazetteComment_flaggedAt_idx"
    ON "ProGazetteComment"("flaggedAt");
CREATE INDEX "ProGazetteComment_deletedAt_idx"
    ON "ProGazetteComment"("deletedAt");

ALTER TABLE "ProGazetteComment" ADD CONSTRAINT "ProGazetteComment_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "ProGazetteArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProGazetteComment" ADD CONSTRAINT "ProGazetteComment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
