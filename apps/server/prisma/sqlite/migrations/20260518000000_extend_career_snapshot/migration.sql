-- Sprint Q lot Q.A.2 — Migration miroir sqlite : extension snapshot.

ALTER TABLE "ProPlayerCareerSnapshot" ADD COLUMN "topMatchesJson" JSONB;
ALTER TABLE "ProPlayerCareerSnapshot" ADD COLUMN "topNemesisIdsJson" JSONB;
ALTER TABLE "ProPlayerCareerSnapshot" ADD COLUMN "topVictoryIdsJson" JSONB;
ALTER TABLE "ProPlayerCareerSnapshot" ADD COLUMN "casualtiesReceived" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProPlayerCareerSnapshot" ADD COLUMN "casualtiesDealt" INTEGER NOT NULL DEFAULT 0;
