# 28 — Rosters nflverse, backfill scores, page joueur ESPN-style (Phase 5.A + 5.B + 5.C)

> Trois fixes qui debouchent ensemble : avoir un jersey number sur
> chaque joueur, recuperer les scores des games W9/W11 manquants, et
> exposer toutes les stats NFL (bio + career + per-category) au-dela
> du seul SPP.

## Phase 5.A — Ingest rosters nflverse

### Probleme initial

`nfl-ingest.ts` (Phase 2.B) set `jerseyNumber = null` hardcoded car
le CSV `stats_player_week_{year}.csv` ne contient pas la colonne.
Promesse "on le remplira via ingestRosters" jamais tenue → 0/2702
joueurs avec un jersey + pseudo affiches "#0".

### Solution

Nouveau service `nfl-ingest-rosters.ts` qui pull
`https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_{year}.csv`.
Le CSV contient :

- `jersey_number` (cle essentielle)
- `height` (format "6-2"), `weight`, `college`, `birth_date`
- `headshot_url` (CDN GitHub stable, idem que ESPN)
- `draft_year`, `draft_round`, `draft_number` (overall pick),
  `draft_club`, `rookie_year`, `years_exp`
- `status` (ACT/INA/CUT/RES/PUP/SUS/RET) normalise sur notre
  vocabulaire (`active/ir/retired/suspended`)

### Schema

`NflPlayer` etendu (8 colonnes optionnelles) :

```prisma
heightInches Int?
weightLbs    Int?
birthDate    DateTime?
college      String?
headshotUrl  String?
draftYear    Int?
draftRound   Int?
draftPick    Int?
draftClub    String?
rookieYear   Int?
yearsExp     Int?
```

Migration via `prisma db push` (memo pattern container).

### Service

```ts
ingestNflverseRosters({ seasonId, fetchCsv?, onProgress? })
  -> { seasonId, rowsTotal, playersUpdated, playersCreated,
       playersSkipped, errors }
```

Pour chaque row valide :
- Upsert sur `NflPlayer.id = gsis_id`
- Update bio + jerseyNumber + status
- Regenerate `pseudonym` avec le VRAI jerseyNumber (remplace les "#0")
- Si player non existant : create avec `bbPosition` derive via
  `getBbPosition(nflPosition, teamRace)` + `bbStats:{}, bbSkills:[]`

Idempotent. Helpers purs exposes (et testes) : `parseHeightToInches`
(supporte "6-2", "6'2", "6 2"), `parseRosterRow`, `parseRostersCsv`.

### Route admin

```
POST /admin/nfl-fantasy/explore/seasons/:id/ingest-rosters
```

### Cron

Nouveau `nflverseRostersTick` qui tourne dans la meme fenetre que
`nflverseIngestTick` (03:00-03:59 UTC) et orchestre via
`nflFantasyOrchestratorTick`.

### Validation E2E

Sur la DB Postgres reelle (2025 saison en cours) :

```
{ rowsTotal: 3137, playersUpdated: 2304, playersCreated: 829,
  playersSkipped: 4, errors: 0, dt: 15.3s }
```

Apres ingest :
- 3133/3531 (89%) joueurs avec jersey number
- 2974/3531 (84%) avec height
- 3044/3531 (86%) avec headshot URL
- 2955/3531 (84%) avec college

## Phase 5.B — Backfill scores manquants

### Probleme initial

Les scores `homeScore`/`awayScore` viennent de l'ingest ESPN
gameday (`ingestEspnGameday(dateYmd)`). Le cron tourne uniquement
dans la fenetre courante → W9/W11 settle depuis plusieurs jours
sans avoir leur score remplis. Et l'ancien ingest nflverse fixe
`kickoffAt = week.startDate` pour les games crees → impossible de
group-by-date pour rattraper.

### Solution

1. **Fix URL ESPN** : `dates=YYYY-MM-DD` retournait 400. ESPN attend
   `dates=YYYYMMDD` (sans tirets). Normalisation dans
   `fetchEspnScoreboardLive`.

2. **Nouveau fetcher par week** : `fetchEspnScoreboardByWeekLive(
   seasonYear, weekNumber)` qui appelle `scoreboard?year=Y&
   seasontype=T&week=W`. Mapping nflverse-week (1-22) -> ESPN
   (regular 1-18 / postseason wildcard=1, div=2, conf=3, SB=5).

3. **Service backfill** `backfillMissingScores({ seasonId? })` :
   ```ts
   -> { weeksProcessed, gamesFound, gamesUpdated,
        gamesStillMissing, weeks: [{ weekId, gamesUpdated,
        gamesSkipped, errors }] }
   ```
   - Liste les `NflGame` sans score
   - Groupe par `weekId` (pas par date — plus robuste)
   - Pour chaque week : fetch ESPN by week + reuse logique
     `ingestEspnGameday` via override `fetchScoreboard`

### Route admin

```
POST /admin/nfl-fantasy/explore/seasons/:id/backfill-scores
```

### Validation E2E

Sur la DB Postgres (2025) :

```
Before: W1=0/16, W9=0/14, W10=14/14, W11=0/15, W22=0/1 (46 missing)

After backfill (1.6s) :
{ weeksProcessed: 4, gamesFound: 46, gamesUpdated: 46,
  gamesStillMissing: 0,
  weeks: [
    { weekId: "2025:W1",  gamesUpdated: 16 },
    { weekId: "2025:W9",  gamesUpdated: 14 },
    { weekId: "2025:W11", gamesUpdated: 15 },
    { weekId: "2025:W22", gamesUpdated: 1  }
  ] }
```

Tous les scores sont desormais visibles dans l'admin.

## Phase 5.C — Page joueur ESPN-style

### Probleme initial

La page detail admin montrait uniquement le mapping BB + le SPP
total. Mais on stocke deja TOUT le row nflverse dans
`NflGameStat.rawStats` (Json) — passing_yards, rushing_tds, targets,
def_sacks, etc. La donnee est la, juste non-affichee.

### Solution

1. **Helper pur `aggregateCategoryStats(rawStatsList)`** :
   ```ts
   -> { passing: PassingStats,
        rushing: RushingStats,
        receiving: ReceivingStats,
        defense: DefenseStats }
   ```
   Tolere null/undefined/strings JSON (sqlite mirror) + colonnes
   manquantes. 7 tests dedies.

2. **`AdminPlayerBio`** + `AdminPlayerSeasonAggregate` exposes dans
   `AdminPlayerDetail`. La page reçoit en un seul GET :
   - `bio` : height, weight, age, college, draft, rookie year,
     yearsExp + headshotUrl
   - `categoryStats` : agrege sur la plage filtree (seasonId ou
     career)
   - `seasons` : aggregat par saison (DESC) avec totaux par
     categorie. Permet l'affichage "Career" sans round-trip.

### Frontend

Page `/admin/nfl-fantasy/players/[id]` enrichie :

- **Header** avec headshot 96×96 + ligne resume (team, jersey,
  position, age, years NFL)
- **Card Bio** (4e card dans la grid) : taille, poids, naissance,
  college, draft, rookie year
- **Section "Statistiques NFL"** : 4 cards par categorie (Passing /
  Rushing / Receiving / Defense). Chaque card est masquee si le
  joueur n'a pas joue dans cette categorie (0 attempts/targets/etc).
  Cells : completions, attempts, yards, TDs, INTs, sacks, comp%,
  avg/carry, etc.
- **Section "Carrière par saison"** : tableau multi-colonnes
  (visible si > 1 saison) avec G/SPP/passing/rushing/receiving/
  defense aggregates par saison.
- Le bloc existant **"Game log"** (renomme depuis "Stats par game")
  reste avec son drill-down JSON.

## Tests

| Fichier | Tests ajoutes |
|---|---|
| `nfl-ingest-rosters.test.ts` | 20 (parsing pure + ingest mocke) |
| `nfl-ingest-espn.test.ts` | +4 (backfillMissingScores) = 43 total |
| `nfl-fantasy-admin-explorer.test.ts` | +7 (aggregateCategoryStats) = 49 total |

**128 tests verts au total** sur le module.

## Hors scope (futurs)

- **Backfill rosters 2023+2024** : Phase 5.A lance pour 2025
  seulement. Run unique d'admin recommande pour avoir la bio
  complete sur les replays historiques.
- **Auto-trigger backfill scores post-cron** : actuellement
  manuel. V2 : hook dans `espnGamedayTick` qui detecte les games
  final-sans-score et appelle `backfillMissingScores` en fin de
  tick.
- **Fix update branche nfl-ingest** : ligne 609 set juste
  `status:"final"`, n'ecrase pas `kickoffAt`. Si un game est cree
  via nflverse (sans schedule) puis re-ingere avec schedule, le
  kickoff reste W1 startDate. A corriger pour eviter de regenerer
  des bugs de date.
- **Onglets** : `/admin/nfl-fantasy/players/[id]` rend tout en une
  page. V2 : tabs "Bio" / "Stats NFL" / "Career" / "Game log" pour
  alleger le scroll.
- **Page user-facing player** : actuellement admin only. V2 :
  `/nfl-fantasy/players/[id]` publique avec pseudo + stats + bio
  pseudonymisee.
