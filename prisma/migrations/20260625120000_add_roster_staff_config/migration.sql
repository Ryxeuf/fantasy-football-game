-- CreateTable
CREATE TABLE "RosterStaffConfig" (
    "id" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "format" "Format" NOT NULL,
    "rerollCost" INTEGER NOT NULL,
    "maxRerolls" INTEGER NOT NULL,
    "apothecaryAllowed" BOOLEAN NOT NULL,
    "apothecaryCost" INTEGER NOT NULL,
    "maxCheerleaders" INTEGER NOT NULL,
    "cheerleaderCost" INTEGER NOT NULL,
    "maxAssistants" INTEGER NOT NULL,
    "assistantCost" INTEGER NOT NULL,
    "maxDedicatedFans" INTEGER NOT NULL,
    "dedicatedFanCost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterStaffConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RosterStaffConfig_rosterId_idx" ON "RosterStaffConfig"("rosterId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterStaffConfig_rosterId_format_key" ON "RosterStaffConfig"("rosterId", "format");

-- AddForeignKey
ALTER TABLE "RosterStaffConfig" ADD CONSTRAINT "RosterStaffConfig_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
