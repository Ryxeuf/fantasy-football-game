# 14 — Matchups + Scoring/Settle (Phase 2.E)

> Service `nfl-fantasy-scoring.ts` qui transforme les SPP NFL en
> resultats fantasy hebdomadaires : pairing des entries, settlement
> idempotent des matchups.

## Modele Prisma ajoute

```prisma
model NflFantasyMatchup {
  id          String   @id @default(cuid())
  leagueId    String
  weekId      String   // "{year}:W{n}"
  homeEntryId String
  awayEntryId String
  homeScore   Int?     // set par settleNflFantasyWeek
  awayScore   Int?
  winnerId    String?  // null = tie ou non settle
  settledAt   DateTime?
  createdAt   DateTime @default(now())

  league NflFantasyLeague @relation(... onDelete: Cascade)

  @@unique([leagueId, weekId, homeEntryId, awayEntryId])
  @@index([leagueId, weekId])
  @@index([weekId, settledAt])
}
```

## API service

| Fonction | Comportement |
|---|---|
| `generateMatchups({ leagueId, weekId })` | Cree N/2 matchups via round-robin "circle method". Idempotent : retourne 0 cree + count existing si deja la. Throws `LEAGUE_NOT_FOUND` / `WEEK_NOT_FOUND`. |
| `settleNflFantasyWeek({ leagueId, weekId })` | Calcule SPP de chaque starter (via `NflGameStat.computedSpp` ingere Phase 2.A), applique captain/vice multipliers Q3, persiste `rawSpp` + `finalSpp` + `sppBreakdown` sur les starters, `totalSpp` sur les lineups, `homeScore`/`awayScore`/`winnerId`/`settledAt` sur les matchups. Idempotent (skip si `settledAt` non null). |
| `listMatchupsForWeek({ leagueId, weekId })` | helper read-only |

### Helpers purs exportes

- `pairEntriesForWeek(entryIds, weekNumber)` — round-robin
  deterministe ; fixe entries[0] et rotate les autres d'une position
  par semaine. Sur N pairs : N-1 weeks distinctes avant repetition.
- `applyCaptainMultiplier({ rawSpp, isCaptain, isViceCaptain })` —
  `1.5×` captain ou `1.2×` vice (Q3), trunc vers 0 pour reproducibilite.
- `determineWinner({ home, away, homeScore, awayScore })` — null si
  tie ou scores null.

### Pipeline `settleNflFantasyWeek`

1. Fetch matchups non-settles `(leagueId, weekId, settledAt=null)`
2. Batch query `NflGame` de la semaine -> gameIds
3. Batch query `NflFantasyLineup + starters` pour les entries
   impliquees
4. Batch query `NflGameStat` (gameId IN ..., playerId IN ...) ->
   `Map<playerId, { computedSpp, sppBreakdown }>`
5. Pour chaque matchup, une seule `$transaction` qui contient :
   - N updates `NflFantasyLineupStarter` (raw + final + breakdown)
   - 2 updates `NflFantasyLineup` (`totalSpp`)
   - 1 update `NflFantasyMatchup` (scores + winner + settledAt)

3 round-trips DB pour le bulk fetch + 1 transaction par matchup.

### Starters sans stat (bye / non-NFL / injury)

`rawSpp = 0` (et donc `finalSpp = 0`). Pas d'erreur, pas de skip — la
case est documentee pour que les coachs sachent pourquoi un slot ne
score pas.

## Validation E2E

Script `apps/server/src/scripts/nfl-fantasy-scoring-e2e.ts`,
**6 etapes OK** sur DB Postgres reelle (2026-05-20) :

```
docker exec nufflearena_server sh -c "cd /app/apps/server && \
  pnpm exec tsx src/scripts/nfl-fantasy-scoring-e2e.ts"
```

1. Setup : league 2 entries + 11 + 11 starters (top scorers W10 ingerees)
2. setLineup owner + member avec captain (top SPP) + vice
3. generateMatchups(W10) -> 1 matchup
4. generateMatchups re-run -> idempotent (0 cree, 1 existing)
5. settleNflFantasyWeek -> 22 starters scored, scores reels :
   **home=131, away=99, winner=ownerEntry** (top scorers > rest)
6. settleNflFantasyWeek re-run -> 0 settle, 1 skip (idempotent)

Captain ×1.5 verifie : `finalSpp = trunc(rawSpp × 1.5)`.

## Tests unitaires

`nfl-fantasy-scoring.test.ts` : **27 tests verts** couvrant :
- `pairEntriesForWeek` (4, 10, weeks distinctes, odd throws, determinism)
- `applyCaptainMultiplier` (×1.5, ×1.2, trunc, captain prime sur vice)
- `determineWinner` (>, <, tie, null)
- `generateMatchups` (creation + idempotence + erreurs)
- `settleNflFantasyWeek` (sum scores, tie null, starter bye = 0 SPP)
- Erreur typee `NflFantasyScoringError`

## Hors scope V1

- **Bonus rerolls / inducements / prayers** : Phase 2.F applique des
  ajustements additionnels sur `finalSpp` apres ce settlement de base.
- **Standings aggregees** (W-L-T record, points-for/against,
  tiebreak) : a deriver des matchups en V1, table dediee en V2.
- **Playoffs schedule** : pour Phase 2.E' une fois la regular season
  bouclee.
