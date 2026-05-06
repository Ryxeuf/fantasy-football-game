-- Pro League wallet + transaction ledger (sprint 1.D.1).

-- CreateTable: ProWallet (1 par user)
CREATE TABLE "public"."ProWallet" (
    "userId"    TEXT NOT NULL,
    "crowns"    INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProWallet_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "public"."ProWallet"
  ADD CONSTRAINT "ProWallet_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ProTransaction (ledger immuable)
CREATE TABLE "public"."ProTransaction" (
    "id"        TEXT NOT NULL,
    "walletId"  TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "amount"    INTEGER NOT NULL,
    "ref"       TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProTransaction_walletId_createdAt_idx"
  ON "public"."ProTransaction"("walletId", "createdAt");

CREATE INDEX "ProTransaction_type_idx"
  ON "public"."ProTransaction"("type");

ALTER TABLE "public"."ProTransaction"
  ADD CONSTRAINT "ProTransaction_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "public"."ProWallet"("userId")
  ON DELETE CASCADE ON UPDATE CASCADE;
