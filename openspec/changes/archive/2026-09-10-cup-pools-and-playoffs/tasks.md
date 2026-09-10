# Tasks — Poules et play-offs de coupe

## 1. Schéma
- [x] 1.1 `CupPool` (`cupId`, `name`, `order`, `color`, `qualifiesForPlayoffs`,
      unique `(cupId, name)`) + `CupParticipant.poolId` nullable (`SetNull`).
- [x] 1.2 `CupRound.kind` (défaut `regular`) + `bracketSlot` nullable.
- [x] 1.3 `Cup.playoffSize` (défaut 0) + `Cup.playoffsPublished` nullable
      (trois états — aucun backfill possible). Miroir SQLite + client généré.

## 2. Poules
- [x] 2.1 `services/cup-pool` : CRUD, `ensurePoolsEditable`, affectation,
      `computeSnakeAssignment` (pur), `groupCupStandingsByPool` (pur). Tests.
- [x] 2.2 `schemas/cup-pool.schemas` + `routes/cup-pools` (monté avant
      `cupRoutes`). Tests de route.
- [x] 2.3 `cup-rounds` : `poolGroups` / `mergeGroupRounds` / `toCupRoundPlan`
      (purs), `byes` en LISTE. Tests.
- [x] 2.4 `GET /cup/:id` sert `pools`, `poolStandings`, `participantId`,
      `poolId`.
- [x] 2.5 Web : `CupPoolsManagerPanel` + classement par poule. Tests.

## 3. Play-offs
- [x] 3.1 `services/bracket-seeding` extrait de `league-playoffs`, qui le
      ré-exporte (aucun appelant modifié). Suite de la ligue inchangée.
- [x] 3.2 `services/cup-playoffs` : `startCupPlayoffs`, `advanceCupPlayoffs`,
      `overrideCupPlayoffSeeds`, `setCupPlayoffsPublished`, `getCupBracket`,
      `visibleCupRounds` (pur). Tests.
- [x] 3.3 `settleCupPairingForLocalMatch` fait avancer le bracket en effet
      secondaire non bloquant.
- [x] 3.4 `schemas/cup-playoff.schemas` + `routes/cup-playoffs`. Tests de route.
- [x] 3.5 `PATCH /cup/:id` refuse `playoffSize` une fois le bracket généré.
- [x] 3.6 Gating de la publication sur les DEUX lectures (bracket + calendrier).
      `CupRoundView` porte `kind` et `bracketSlot`.
- [x] 3.7 Web : `playoff-bracket` (pur) + `CupPlayoffBracketView`, badge
      `bracket` au calendrier. Tests.

## 4. Bout en bout et documentation
- [x] 4.1 e2e-api `cup-pools-and-playoffs` : composition, fenêtre d'édition,
      appariement par groupe, seeding par quotas, gating, avancement.
- [x] 4.2 i18n fr/en des deux écrans.
- [x] 4.3 `docs/cup-pools-and-playoffs.md`, CLAUDE.md, backlog des suites.
- [x] 4.4 `typecheck` gate désormais la CI (le `|| echo` avalait 8 erreurs).
