-- Surcharge du pool de PSP par roster précis (prime sur le PSP du tier).
-- Additif et nullable : rétro-compatible.
ALTER TABLE "Cup" ADD COLUMN "rosterStartingPspOverrides" JSONB;
