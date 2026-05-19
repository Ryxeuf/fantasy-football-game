-- Audit round 10 (MEDIUM/perf) — ProMatchPrediction indexes.
--
-- settlePredictions filtre `{ matchId, score: null }` pour les pending.
-- getSeerLeaderboard filtre `{ score: { not: null }, scoredAt: { gte: ... } }`.
-- Sans index dedies, Postgres faisait du seek-then-filter sur de gros volumes.

CREATE INDEX IF NOT EXISTS "ProMatchPrediction_matchId_score_idx"
  ON "ProMatchPrediction"("matchId", "score");

CREATE INDEX IF NOT EXISTS "ProMatchPrediction_score_scoredAt_idx"
  ON "ProMatchPrediction"("score", "scoredAt");
