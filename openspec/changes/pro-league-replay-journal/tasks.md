# Tasks — le journal rejouable

Un commit atomique par tâche, tests avec chaque point.

## 1. Moteur
- [x] 1.1 `calculateMatchResult` sans mutation de `matchStats` (rejeu bit à bit).
- [x] 1.2 `awardTouchdown` efface `pendingPushChoice` / `pendingFollowUpChoice` ;
      test « TD par poussée ».

## 2. Sim-engine
- [x] 2.1 `replay/journal.ts` : types, `journalStepRng`, `extractDiceRecords`,
      `replayJournal`, `journalMoves` ; `ENGINE_VER` 0.28.0.
- [x] 2.2 Full driver : flux par pas (`move:n`, `drive:n`, `toss`, `kickoff`),
      `journalSteps`, `result.journal`.
- [x] 2.3 `compress.ts` v2 `{ v, events, journal }`, v1 décodable ; test
      « < 20 Ko et se décode ».
- [x] 2.4 `journal.test.ts` : rejeu bit à bit (5 graines), dés journalisés.
- [x] 2.5 `match-sheet.ts` + test ; export `renderMatchSheet`.
- [x] 2.6 Baseline de bench re-snapshotée, CHANGELOG 0.28.0.

## 3. Serveur
- [x] 3.1 `sim-runner` stocke le journal ; `pro-league-replay` dérive
      `fullReplay` d'un journal (test).
- [x] 3.2 `getMatchSheetText` + `?format=sheet` sur la narration admin.

## 4. Web
- [x] 4.1 `replay-activations.ts` (pur) + tests.
- [x] 4.2 `useFullReplay.controls.stepActivationForward/Backward` + test.
- [x] 4.3 Boutons « activation précédente / suivante » dans `FullReplayField`.
- [ ] 4.4 Dés rendus par `BlockDieIcon` / `D6Icon`, e2e Playwright du viewer :
      non faits dans ce lot (hors périmètre, cf. proposal).
