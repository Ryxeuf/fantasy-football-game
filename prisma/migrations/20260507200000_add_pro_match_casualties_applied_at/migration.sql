-- Sprint Pro League lot 1.E.4 — flag idempotence pour le post-process
-- casualties (sera set au moment où les casualties d'un match
-- completed ont été reportées sur les rosters).

ALTER TABLE "public"."ProLeagueMatch"
  ADD COLUMN "casualtiesAppliedAt" TIMESTAMP(3);
