-- Sprint R lot R.E.1 — Migration miroir sqlite : game mode async backend.

ALTER TABLE "Match" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'realtime';
ALTER TABLE "Match" ADD COLUMN "currentTurnDeadline" DATETIME;
ALTER TABLE "Match" ADD COLUMN "turnDeadlineHours" INTEGER NOT NULL DEFAULT 24;

CREATE INDEX "Match_mode_currentTurnDeadline_idx"
    ON "Match"("mode", "currentTurnDeadline");
