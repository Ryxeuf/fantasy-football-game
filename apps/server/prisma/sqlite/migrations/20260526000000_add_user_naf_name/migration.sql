-- Sprint R lot R.D.3 — Migration miroir sqlite : NAF opt-in.

ALTER TABLE "User" ADD COLUMN "nafName" TEXT;
