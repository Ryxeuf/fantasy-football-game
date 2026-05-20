# 17 — Crons NFL Fantasy (Phase 2.H)

> Orchestrateur unique qui pilote toute la mecanique recurrente du
> module : ingestion nflverse/ESPN + lockLineups Sunday + settle
> Tuesday.

## Architecture

Un seul `setInterval(NFL_FANTASY_CRON_TICK_MS)` (default **5 min**)
dans `apps/server/src/index.ts` appelle
`nflFantasyOrchestratorTick()`. L'orchestrateur invoque sequentiellement
les 4 ticks ; chacun verifie sa propre fenetre temporelle et se
court-circuite (`ran: false, reason: "out_of_window"`) si ce n'est
pas son moment.

```
setInterval(5min)
   └─ runOnceAtATime("nfl-fantasy-cron")
        └─ nflFantasyOrchestratorTick(now)
              ├─ nflverseIngestTick   (fenetre 03:00 UTC)
              ├─ espnGamedayTick      (Thu/Fri/Sat/Sun/Mon UTC)
              ├─ lockLineupsTick      (Sunday 17:00 UTC)
              └─ settleWeekTick       (Tuesday 12:00 UTC)
```

`runOnceAtATime` (cf. `utils/cron-overlap-guard.ts`) garantit qu'un
tick ne s'empile pas si le precedent depasse 5 min. Multi-pod : il
faudra un advisory lock Postgres en V2 (mentionne dans le guard).

## Helpers purs exportes

Tous testables sans Prisma :

| Helper | Description |
|---|---|
| `dateYmd(date)` | format `YYYYMMDD` UTC pour ESPN |
| `currentSeasonId(now)` | "2025" en oct-dec 2025 et jan-jui 2026 ; "2026" en jul 2026+ |
| `isNflGameday(now)` | true pour Thu/Fri/Sat/Sun/Mon UTC |
| `isLockLineupsWindow(now)` | true Sunday 17:00-17:59 UTC |
| `isSettleWindow(now)` | true Tuesday 12:00-12:59 UTC |
| `isNflverseDailyWindow(now)` | true 03:00-03:59 UTC (tous jours) |

Fenetre 1 heure (pas exactes 17:00:00) pour absorber le tick toutes
les 5 min sans rater le creneau.

## Helpers DB

- `findCurrentNflWeek(now)` : derniere `NflWeek` (saison courante)
  avec `startDate <= now`, tri `[startDate desc, weekNumber desc]`
  pour briser les ex-aequo du seed Phase 2.A.
- `findPreviousNflWeek(now)` : la 2e plus recente — utilisee par
  `settleWeekTick`.

## Ticks

Tous prennent `{ now?: Date, force?: boolean }`. `force` bypass la
fenetre (pratique pour tests + scripts admin).

| Tick | Quand | Service appele |
|---|---|---|
| `nflverseIngestTick` | 03:00 UTC daily | `ingestNflverseWeek` sur la week courante |
| `espnGamedayTick` | Thu/Fri/Sat/Sun/Mon | `ingestEspnGameday(dateYmd(now))` |
| `lockLineupsTick` | Sunday 17:00 UTC | `lockLineups(currentWeekId)` |
| `settleWeekTick` | Tuesday 12:00 UTC | pour chaque league `in_progress` : `generateMatchups` + `settleNflFantasyWeek` sur la previous week |

Chaque tick :
- est idempotent (heritage des services 2.A-2.E)
- catch + log les erreurs sans crasher l'orchestrateur
- retourne `{ ran, reason?, detail? }`

Le log est silencieux quand rien a faire (le tick 5min serait sinon
ultra-bavard, 99% du temps idle).

## Config env

- `NFL_FANTASY_CRON_TICK_MS=300000` (5 min) — defaut
- `NFL_FANTASY_CRON_TICK_MS=0` — desactive
- Test envs (`NODE_ENV=test`, `TEST_SQLITE=1`) desactivent automatiquement
  (eviter les side-effects en CI)

## Validation E2E

Script `apps/server/src/scripts/nfl-fantasy-cron-e2e.ts`, **7 etapes
OK** sur la DB Postgres reelle :

```
docker exec nufflearena_server sh -c "cd /app/apps/server && \
  pnpm exec tsx src/scripts/nfl-fantasy-cron-e2e.ts"
```

1. Sanity check des helpers purs sur dates connues
2. Orchestrator hors fenetre (mercredi 20h) : 0 tick fire
3. `nflverseIngestTick({ force })` : ingest la week courante
4. `espnGamedayTick({ force })` : pull scoreboard
5. `lockLineupsTick({ force })` : lock idempotent
6. `settleWeekTick({ force })` : 0 league `in_progress` -> tick passe
7. Orchestrator sur `mar 03:00 UTC` synthetique : seul `nflverse`
   fire, les 3 autres ticks renvoient `ran: false`

## Tests unitaires

`nfl-fantasy-cron.test.ts` : **28 tests verts** couvrant :
- Helpers purs (dateYmd, currentSeasonId, isNfl*, isLock*, etc.)
- findCurrent/Previous NflWeek (mock Prisma)
- Chaque tick : skip out_of_window, force=true, no_current_week,
  capture erreurs sans crash
- Orchestrator (mock pour chaque sous-tick)

## Gotchas / known limitations V1

- **Seed dates Phase 2.A** : tous les NflWeek partagent un startDate
  approximatif (5 sept de la saison). Tie-breaker `weekNumber desc`
  ajoute pour que `findCurrentNflWeek` retourne la derniere week
  disponible plutot que W1. Un seed precis via les schedules ESPN
  sera fait en Phase 2.B' (tracking ticket).
- **Multi-pod** : les ticks ne se synchronisent pas via DB. Sur N pods
  ils s'executeront tous en parallele. `runOnceAtATime` est in-process
  seulement. Ajouter `pg_try_advisory_lock` au boot du tick en
  Phase 2.H'.
- **`espnGamedayTick`** : tourne Thu/Fri/Sat/Sun/Mon, pas seulement
  pendant les heures de match. Couvre les TNF + Sao Paulo + samedis
  playoffs sans logique horaire compliquee. ESPN gere bien le cache
  cote eux.
- **`settleWeekTick`** : ne fait rien si aucune league `in_progress`.
  Tant que les premieres leagues V1 ne sont pas passees en
  `in_progress`, le tick consomme 0 row.
