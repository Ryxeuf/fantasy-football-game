-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "kofiLinkCode" TEXT,
ADD COLUMN     "supporterActiveUntil" TIMESTAMP(3),
ADD COLUMN     "supporterTier" TEXT,
ADD COLUMN     "totalDonatedCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."KofiTransaction" (
    "id" TEXT NOT NULL,
    "kofiTransactionId" TEXT NOT NULL,
    "messageId" TEXT,
    "type" TEXT NOT NULL,
    "isSubscriptionPayment" BOOLEAN NOT NULL DEFAULT false,
    "isFirstSubscriptionPayment" BOOLEAN NOT NULL DEFAULT false,
    "tierName" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "fromName" TEXT,
    "email" TEXT,
    "message" TEXT,
    "userId" TEXT,
    "matchedVia" TEXT,
    "rawPayload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KofiTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KofiTransaction_kofiTransactionId_key" ON "public"."KofiTransaction"("kofiTransactionId");

-- CreateIndex
CREATE INDEX "KofiTransaction_userId_idx" ON "public"."KofiTransaction"("userId");

-- CreateIndex
CREATE INDEX "KofiTransaction_email_idx" ON "public"."KofiTransaction"("email");

-- CreateIndex
CREATE INDEX "KofiTransaction_receivedAt_idx" ON "public"."KofiTransaction"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_kofiLinkCode_key" ON "public"."User"("kofiLinkCode");

-- AddForeignKey
ALTER TABLE "public"."KofiTransaction" ADD CONSTRAINT "KofiTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

