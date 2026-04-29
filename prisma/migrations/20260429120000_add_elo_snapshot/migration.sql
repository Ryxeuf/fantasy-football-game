-- S26.3l — Historique ELO par coach (snapshot par mise a jour ELO).

-- CreateTable
CREATE TABLE "public"."EloSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "matchId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EloSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EloSnapshot_userId_recordedAt_idx" ON "public"."EloSnapshot"("userId", "recordedAt");

-- AddForeignKey
ALTER TABLE "public"."EloSnapshot" ADD CONSTRAINT "EloSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
