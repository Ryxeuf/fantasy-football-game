-- Règles avancées de composition des coupes (mode coupe).
-- Tous les ajouts sont additifs / nullable ou à défaut neutre :
-- rétro-compatibles, aucune réécriture des données existantes.

-- Cup : config commissaire (résurrection, budgets par tier + overrides, PSP).
ALTER TABLE "Cup" ADD COLUMN "resurrectionMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Cup" ADD COLUMN "tierBudgets" JSONB;
ALTER TABLE "Cup" ADD COLUMN "rosterBudgetOverrides" JSONB;
ALTER TABLE "Cup" ADD COLUMN "tierStartingPsp" JSONB;

-- CupParticipant : snapshot du roster inscrit + pool de PSP accordé.
ALTER TABLE "CupParticipant" ADD COLUMN "rosterSnapshot" JSONB;
ALTER TABLE "CupParticipant" ADD COLUMN "pspPoolGranted" INTEGER NOT NULL DEFAULT 0;

-- Team : pool de PSP alloué au build (mode « édition avancée » / coupe).
ALTER TABLE "Team" ADD COLUMN "startingPspPool" INTEGER NOT NULL DEFAULT 0;
