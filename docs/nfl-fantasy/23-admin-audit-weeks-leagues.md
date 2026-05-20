# 23 — Admin audit + weeks + leagues (Phase 3.D)

> Extension de l'explorer admin Phase 3.C avec 3 nouveaux modules :
> audit log des ingestions, calendrier de saison, et vue globale des
> leagues (admin only, pas restreint a la membership).

## Motivation

Apres Phase 3.C (teams + players + resync), il manquait 3 vues
critiques pour l'ops :

1. **Audit ingest** : quand un cron rate, on n'avait pas d'UI pour
   voir l'historique `NflIngestRun` Q.A.2 et drill-down sur les
   erreurs.
2. **Calendrier** : pas moyen de voir l'etat des 22 weeks d'une
   saison ou de savoir lesquelles ont un retard d'ingestion.
3. **Leagues globales** : la page user-facing `/nfl-fantasy` ne
   montre que les miennes. Pour debugger une league signalee, il
   fallait `psql`.

## Backend (extension `nfl-fantasy-admin-explorer.ts`)

```ts
// Audit
listNflIngestRunsForAdmin({ source?, status?, weekId?, limit? })
  -> AdminIngestRunRow[]
getNflIngestRunForAdmin(id) -> AdminIngestRunRow | null

// Calendrier
listWeeksForSeason(seasonId) -> AdminWeekRow[]
getWeekDetail(weekId)        -> AdminWeekDetail | null

// Leagues admin
listAllLeaguesForAdmin({ status?, type?, seasonId?, search?, page?,
                         pageSize? })
  -> { leagues, total, page, pageSize }
getLeagueDetailForAdmin(id)  -> AdminLeagueDetail | null
```

Toutes lecture seule. Patterns reutilises de 3.C :
- `groupBy` au lieu de N+1 pour les compteurs entries/matchups par
  league
- Clamp `pageSize` (200 max), `page` (>= 1)
- Tri stable et deterministe pour les listes (`startedAt desc`,
  `weekNumber asc`, `createdAt desc`)
- `findFirst` + `orderBy startedAt desc` pour recuperer la
  derniere ingestion par week

Le helper `listWeeksForSeason` agrege en 3 `Promise.all` :
- groupBy NflGame par weekId (total games)
- groupBy NflGame par weekId where status=final
- findMany NflIngestRun (puis dedup par weekId en gardant le plus
  recent)

## Routes ajoutees

6 nouvelles routes sous `/admin/nfl-fantasy/explore/*` (authUser +
adminOnly) :

| Method | Path | Service |
|---|---|---|
| GET | `/explore/ingest-runs?source=&status=&weekId=&limit=` | `listNflIngestRunsForAdmin` |
| GET | `/explore/ingest-runs/:id` | `getNflIngestRunForAdmin` |
| GET | `/explore/weeks?seasonId=` | `listWeeksForSeason` |
| GET | `/explore/weeks/:weekId` | `getWeekDetail` |
| GET | `/explore/leagues?...` | `listAllLeaguesForAdmin` |
| GET | `/explore/leagues/:id` | `getLeagueDetailForAdmin` |

Zod validateQuery sur tous les filtres. 404 → code `NOT_FOUND`,
`WEEK_NOT_FOUND` ou `LEAGUE_NOT_FOUND`.

## Frontend

### Sub-nav etendue

`SubNav.tsx` accueille 3 nouveaux tabs : Calendrier 📅, Leagues 🏆,
Ingest 📥. Le layout existant (SeasonContext + SeasonPicker) propage
automatiquement la saison aux nouvelles pages.

### `/admin/nfl-fantasy/ingest-runs`

- Filtres : source (nflverse/espn) + status + limit (50/100/200/500)
- Compteurs visuels par status en header
- Tableau startedAt DESC : Date · Source · Week · Status · Durée ·
  Résumé · JSON
- Résumé deduit du `result` JSON : `{N games · M players · K stats
  · X errs}` ou `err: ...`
- Drill-down JSON `result` complet (pre scrollable max-h-80) via
  toggle expand

### `/admin/nfl-fantasy/weeks`

- 22 lignes par saison selectionnee (filtree via SeasonPicker)
- Type (regular/playoffs) badge orange pour W19-22
- Games/final + ingestStatus avec badge colore
- Click W{n} → detail

### `/admin/nfl-fantasy/weeks/[weekId]`

- Header avec id + type + periode
- 3 cards : Games / Final / Derniere ingest
- Tableau games : Kickoff · Game (links team) · Score · Status ·
  Stats count

### `/admin/nfl-fantasy/leagues`

- Filtres search debounce 250ms (nom/id/owner/inviteCode) + status
  + type + saison (via SeasonPicker)
- Tableau 8 colonnes (Nom · Saison · Status · Type · Draft ·
  Members · Matchups · Créée)
- Pagination 50/p

### `/admin/nfl-fantasy/leagues/[id]`

- Header + 4 cards (Status / Type+Draft / Members / Matchups)
- Tableau entries avec badge "owner" + race + TV
- Tableau matchups avec teamName resolu via Map (entry id → team
  name), winner explicite, "Égalité" pour matchups settle avec
  winnerId=null

## Tests

`nfl-fantasy-admin-explorer.test.ts` : **12 tests ajoutes** (30
total) :
- listNflIngestRunsForAdmin : clamp limit, durationMs, vide
- getNflIngestRunForAdmin : null + duration
- listWeeksForSeason : agreg games/ingest, saison vide
- getWeekDetail : null + statsCount groupBy
- listAllLeaguesForAdmin : pagination + agreg + clamp page/pageSize
- getLeagueDetailForAdmin : null + entries + matchups

## Verifications

Apres deploiement sur DB Postgres reelle (post Phase 3.E avec 2023
+ 2024 backfilles) :

- `/admin/nfl-fantasy/ingest-runs` → liste les ~70 runs (~22 par
  saison × 3 saisons) avec status principalement `partial` (1 row
  vide par CSV).
- `/admin/nfl-fantasy/weeks?season=2024` → 22 lignes,
  `ingestStatus=partial` partout, gamesCount=16 pour W1-W17.
- `/admin/nfl-fantasy/leagues` → toutes les leagues incluant les
  draft tests E2E (a nettoyer).

## Hors scope (Phase 3.F+)

- **Replay d'une saison passee** : creer demo league sur 2024,
  auto-fill + finalize + bulk-settle W1-W18 → Phase 3.F.
- **Bulk recompute SPP par saison** : equivalent du bouton
  per-player Phase 3.C.2 mais sur toute une saison → Phase 3.F.
- **Bulk re-ingest depuis l'UI** : Bouton "Re-ingest cette week"
  sur la page weeks/[weekId] qui appellerait
  `ingestNflverseWeek({ seasonId, weekNumber })` → Phase 3.F.
- **Detail d'une NflIngestRun** : page dedie
  `/admin/nfl-fantasy/ingest-runs/[id]` avec analyse fine des
  errors (groupes par context). Pour V1 le drill-down JSON est
  suffisant.
