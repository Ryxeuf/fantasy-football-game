# 11 — Pipeline d'ingestion (Phases 2.A / 2.B)

> État des services d'ingestion NFL en `apps/server/src/services/`,
> validés end-to-end sur la vraie DB Postgres du dev stack
> (`nufflearena_db`) sur W10 2025.

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 2.A — nfl-ingest.ts (nflverse, post-match)                │
├─────────────────────────────────────────────────────────────────┤
│  seedNflTeams()                    32 NflTeam <- @bb/nfl-mapper │
│  seedNflSeason(seasonId)           1 NflSeason + 22 NflWeek     │
│  ingestNflverseWeek({seasonId,wk}) CSV nflverse -> NflPlayer +  │
│                                     NflGame + NflGameStat (+SPP) │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Phase 2.B — nfl-ingest-espn.ts (ESPN, gameday + rosters)        │
├─────────────────────────────────────────────────────────────────┤
│  ingestEspnGameday({dateYmd})      Scoreboard ET local ->       │
│                                     NflGame upsert (status+score)│
│  ingestEspnRosters({seasonId, ?})  /teams/{x}/roster ->         │
│                                     NflRosterSnapshot par team   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  NflIngestRun (audit Q.A.2)
```

Chaque appel ouvre un audit `NflIngestRun` (status `in_progress` →
`success` | `partial` | `failed`) avec `source`, `weekId?`, `result`
JSON détaillé.

## Phase 2.A — nflverse (post-match, validée 2026-05-19)

- **Source** : CSV unifié `stats_player_week_{YEAR}.csv` (115 cols, tag
  `stats_player` ≥ 2025).
- **Idempotence Q.D.1** : tout est `upsert`. Re-run met à jour, ne
  duplique pas.
- **Audit Q.A.2** : `NflIngestRun` ouvert avant le fetch, fermé en
  success / partial / failed selon les errors capturés en boucle.
- **Erreurs typées** : `NflIngestError` avec codes
  `FETCH_FAILED | PARSE_FAILED | SEASON_NOT_FOUND | WEEK_NOT_FOUND | INVALID_WEEK_NUMBER`.

### Résultats E2E W10 2025 (revalidé après fix `LA` → `LAR`)

| Métrique | Valeur |
|---|---|
| players updated | 962 |
| stats   updated | 962 |
| games   touched | 14 |
| errors          | 1 (row position_group vide — connu, logguée seulement) |

## Phase 2.B — ESPN (gameday + rosters, validée 2026-05-20)

### `ingestEspnGameday({ dateYmd })`

- **Source** : `GET /scoreboard?dates=YYYYMMDD` (ET local, cf.
  03-api-strategy.md).
- Pour chaque event :
  - `parseEspnEvent` extrait `(seasonId, weekNumber, home, away, scores, status, kickoffAt)`
  - mappe la numérotation post-season ESPN W1-5 → nflverse W19-22
    (skip W4 Pro Bowl → null, skip silencieux)
  - normalise `WSH` → `WAS` (et inversement pour l'URL roster)
  - vérifie que `NflWeek` existe ; sinon skip + warning dans `errors`
- **Upsert** `NflGame` (idempotent : re-run met à jour score/status).
- **NflGame.id** : recomposé au format nflverse-aligné
  `YYYY_WW_AWAY_HOME` pour rester compatible avec les rows nflverse
  déjà ingérées.

### `ingestEspnRosters({ seasonId, teamCodes? })`

- **Source** : `GET /teams/{abbr}/roster` (32 endpoints).
- Pour chaque team : `parseEspnRoster` aplatit offense + defense +
  specialTeam en `RosterAthlete[]` ({ espnId, fullName, jersey,
  position, active }).
- **Snapshot** : créé une ligne dans `NflRosterSnapshot` à chaque
  appel (history-friendly, pas idempotent par design).
- Si saison absente → `NflIngestError("SEASON_NOT_FOUND")`.
- Erreurs per-team isolées (one team fails ≠ all teams fail) ; le
  run termine en `partial`.

### Résultats E2E W10 2025

| Run | Résultat |
|---|---|
| `gameday 20251106` (Thu) | 1 game updated |
| `gameday 20251109` (Sun) | 12 games updated |
| `gameday 20251110` (Mon) | 1 game updated |
| `rosters 2025 KC,MIA`    | 2 snapshots, 91 joueurs/équipe |

**Total W10 final DB** : 14 games, **14/14 avec scores** ✅.

## Limites V1 documentées

### Mismatch ESPN athlete ID ↔ nflverse gsis_id

- ESPN athlete IDs : numériques (ex: `3139477`)
- nflverse player_id : `gsis_id` au format `00-0033873`
- **Pas de matching automatique en V1.** Les `NflRosterSnapshot`
  conservent les IDs ESPN bruts dans le JSON `roster` ; les
  `NflPlayer.jerseyNumber` ne sont pas backfillés depuis ESPN tant
  qu'on n'a pas un mapper (V2 — cf. SDX dans 03-api-strategy.md).

### Pro Bowl skip silencieux

ESPN post-season W4 = Pro Bowl, pas couvert par nflverse (W19-22 =
Wildcard / Div / Conf / SB). `mapEspnWeekToNflverseWeek` retourne -1
→ `parseEspnEvent` retourne null → event ignoré, comptabilisé en
`gamesSkipped` sans erreur.

### Bug pré-existant fixé : nflverse legacy `LA`

Découvert lors du premier run ESPN gameday : nflverse émet parfois
`game_id = "2025_10_LA_SF"` alors que le champ `team` vaut `"LAR"`.
ESPN émet `"LAR"` partout. Conséquence : doublon `LA_SF` (nflverse) +
`LAR_SF` (ESPN) en DB.

**Fix** : `normalizeNflverseGameId(rawId)` applique
`normalizeNflverseTeamCode` à chaque segment du `YYYY_WW_AWAY_HOME`.
Appliqué dans `parseRow` (storage) + `inferHomeAway` (matching).
3 tests régression ajoutés.

## CLI

`apps/server/src/scripts/nfl-ingest-cli.ts` expose toutes les
fonctions pour validation manuelle dans le container :

```bash
docker exec nufflearena_server sh -c "cd /app/apps/server && pnpm exec tsx src/scripts/nfl-ingest-cli.ts <cmd>"
```

| Commande | Description |
|---|---|
| `seed-teams` | 32 NflTeam depuis @bb/nfl-mapper |
| `seed-season <year>` | NflSeason + 22 NflWeek |
| `ingest-week <year> <week>` | nflverse CSV → NflGame/Player/Stat |
| `all <year> <week>` | enchaîne les 3 ci-dessus |
| `gameday <YYYYMMDD>` | ESPN scoreboard d'une date ET |
| `rosters <year> [code1,code2,...]` | Snapshot ESPN /teams/{x}/roster |

Phase 2.G branchera ces fonctions sur des routes admin Express
(`POST /admin/nfl/ingest/{week,gameday,rosters}`).

## Tests

| Fichier | Tests | Status |
|---|---|---|
| `nfl-ingest.test.ts` | 36 | ✅ (+3 régression `LA`→`LAR`) |
| `nfl-ingest-espn.test.ts` | 38 | ✅ |

Total Phase 2.A + 2.B : **74 tests verts**.

## Prochaines étapes

- **Phase 2.C** : `nfl-fantasy-league.ts` (CRUD league)
- **Phase 2.D** : `nfl-fantasy-lineup.ts` (set lineup + lock)
- **Phase 2.E** : `nfl-fantasy-scoring.ts` (settle hebdo via
  `NflGameStat.computedSpp` × multipliers C/VC)
- **Phase 2.F** : `nfl-fantasy-mercato.ts`
- **Phase 2.G** : routes Express admin (réutilise CLI)
- **Phase 2.H** : crons (nflverse daily 03:00, ESPN 5min gameday,
  settle Tue 12:00, lock Sun 17:00 ET)
