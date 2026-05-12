-- Sprint R lot R.E.3 — Migration miroir sqlite : ligues async.

ALTER TABLE "League" ADD COLUMN "matchMode" TEXT NOT NULL DEFAULT 'realtime';
ALTER TABLE "League" ADD COLUMN "turnDeadlineHours" INTEGER NOT NULL DEFAULT 24;
