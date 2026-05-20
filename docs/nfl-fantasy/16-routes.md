# 16 — Routes Express (Phase 2.G)

> Couche HTTP qui expose tous les services Phase 2.A-2.F. Pas de
> nouvelle logique metier : les routes sont des wrappers Zod + auth
> + mapping erreur typee -> status HTTP.

## Structure

```
apps/server/src/
├── utils/
│   └── nfl-error-mapper.ts        ★ NEW (pur + 15 tests)
└── routes/
    ├── admin-nfl-ingest.ts        ★ NEW (5 endpoints)
    ├── admin-nfl-fantasy.ts       ★ NEW (4 endpoints)
    ├── nfl-fantasy-leagues.ts     ★ NEW (8 endpoints)
    └── nfl-fantasy-entries.ts     ★ NEW (10 endpoints sous /:entryId)
```

Wires dans `apps/server/src/index.ts` :

```ts
// Admin
app.use("/admin/nfl/ingest", adminNflIngestRoutes);
app.use("/admin/nfl-fantasy", adminNflFantasyRoutes);
// User-facing
app.use("/api/nfl-fantasy/leagues", nflFantasyLeaguesRoutes);
app.use("/api/nfl-fantasy/entries", nflFantasyEntriesRoutes);
```

## Conventions

| Aspect | Choix |
|---|---|
| Auth user | `authUser` middleware (JWT Bearer). Decode `req.user.id`. |
| Auth admin | `authUser` + `adminOnly` middleware (DB role check). |
| Validation body | `validate(schema)` middleware Zod (400 sur fail). |
| Validation query | `validateQuery(schema)` Zod. |
| Ownership entry | helper `loadOwnedEntry(req, res, entryId)` : 404 si entry absente, 403 si `entry.userId !== req.user.id`. |
| Erreur typee -> HTTP | `sendNflError(res, err)` via `nfl-error-mapper`. |
| Erreur non typee | `serverLog.error` + 500 generique. |

## Mapping `NflXxxError` -> status HTTP

| Status | Codes |
|---|---|
| **404** | `NOT_FOUND`, `*_NOT_FOUND` (Season/Week/Entry/Player/Reroll/League), `INVALID_INVITE` |
| **403** | `NOT_OWNER`, `REROLL_NOT_OWNED` |
| **409** | `ALREADY_JOINED`, `FULL`, `INVALID_STATUS`, `OWNER_CANNOT_LEAVE`, `TEAM_NAME_TAKEN`, `PLAYER_ALREADY_ON_ROSTER`, `PLAYER_NOT_ON_ROSTER`, `REROLL_ALREADY_USED`, `INDUCEMENT_LIMIT_REACHED`, `LINEUP_LOCKED` |
| **422** | `INVALID_NAME/TEAM_NAME/SIZE/TYPE/SLOT/WEEK_NUMBER/LINEUP_SIZE/STARTERS`, `DUPLICATE_PLAYER`, `CAPTAIN_NOT_IN_STARTERS`, `VICE_NOT_IN_STARTERS`, `CAPTAIN_EQUALS_VICE`, `ODD_ENTRIES` |
| **502** | `FETCH_FAILED`, `PARSE_FAILED` (dependances externes nflverse/ESPN) |
| **500** | code inconnu (fallback) |

Body retourne : `{ error: <message>, code: <code> }`.

## Catalogue endpoints

### Admin — `/admin/nfl/ingest` (Phase 2.A/2.B)

| Method | Path | Body | Service |
|---|---|---|---|
| POST | `/seed-teams` | — | `seedNflTeams()` |
| POST | `/seed-season` | `{ seasonId }` | `seedNflSeason` |
| POST | `/week` | `{ seasonId, weekNumber }` | `ingestNflverseWeek` |
| POST | `/gameday` | `{ dateYmd }` (YYYYMMDD) | `ingestEspnGameday` |
| POST | `/rosters` | `{ seasonId, teamCodes? }` | `ingestEspnRosters` |

### Admin — `/admin/nfl-fantasy` (Phase 2.D/2.E/2.F)

| Method | Path | Body | Service |
|---|---|---|---|
| POST | `/lock-lineups` | `{ weekId }` | `lockLineups` |
| POST | `/generate-matchups` | `{ leagueId, weekId }` | `generateMatchups` |
| POST | `/settle-week` | `{ leagueId, weekId }` | `settleNflFantasyWeek` |
| POST | `/seed-rerolls` | `{ entryId, count? }` | `seedStartingRerolls` |

### User — `/api/nfl-fantasy/leagues` (Phase 2.C)

| Method | Path | Body | Service |
|---|---|---|---|
| POST | `/` | `{ name, teamName, seasonId, size?, type?, draftMode? }` | `createLeague` |
| GET | `/` | — | `listLeaguesForUser(req.user.id)` |
| GET | `/:id` | — | `getLeague` |
| PATCH | `/:id` | `{ name?, type?, size? }` | `updateLeague` |
| DELETE | `/:id` | — | `deleteLeague` |
| POST | `/:id/join` | `{ teamName }` | `joinLeague(leagueId)` |
| POST | `/join-by-code` | `{ inviteCode, teamName }` | `joinLeague(inviteCode)` |
| POST | `/:id/leave` | — | `leaveLeague` |

### User — `/api/nfl-fantasy/entries/:entryId` (Phase 2.D/2.F)

Ownership check applique a chaque endpoint (`loadOwnedEntry`).

| Method | Path | Body / Query | Service |
|---|---|---|---|
| GET | `/roster` | — | `getRoster` |
| POST | `/roster` | `{ playerId, tvCost?, acquiredVia? }` | `addPlayerToRoster` |
| DELETE | `/roster/:playerId` | — | `removePlayerFromRoster` |
| GET | `/lineup` | `?weekId=` | `getLineup` |
| PUT | `/lineup` | `{ weekId, starters, captainId, viceCaptainId? }` | `setLineup` |
| GET | `/rerolls` | `?used=true|false` | `listRerolls` + `countAvailableRerolls` |
| POST | `/rerolls/consume` | `{ rerollId, weekId, matchupId, appliedTo? }` | `consumeReroll` |
| GET | `/inducements` | `?weekId=&matchupId=` | `listInducements` + `countRemainingInducementSlots` |
| POST | `/inducements/consume` | `{ weekId, matchupId, type, slot?, source?, targetId?, meta? }` | `consumeInducement` |

## Validation

Toutes les routes utilisent des schemas Zod stricts (defaults service
appliques cote service apres validation, donc pas de duplication). 400
sur invalid input avec `{ error: "<champ>: <issue>" }`.

## Tests

- **`utils/nfl-error-mapper.test.ts`** : 15 tests verts. Couvre chaque
  code documente + erreurs non typees -> null.
- **E2E `scripts/nfl-fantasy-routes-e2e.ts`** : 12 etapes sur le
  serveur live (`localhost:8201` depuis le container) :

```
docker exec nufflearena_server sh -c "cd /app/apps/server && \
  pnpm exec tsx src/scripts/nfl-fantasy-routes-e2e.ts"
```

1. 401 sans token sur /api/nfl-fantasy/leagues
2. 401 sans token sur /admin/nfl/ingest/seed-teams
3. 403 user normal sur route admin
4. POST /leagues -> 201 + body avec entries (owner)
5. GET /:id -> 200
6. GET missing -> 404 + code NOT_FOUND
7. PATCH rename -> 200
8. PATCH name trop court -> 400 (Zod)
9. POST seed-teams admin -> 200 + 32 teams
10. POST lock-lineups sans weekId -> 400
11. POST settle-week sur league fantome -> 200 + 0 matchups
12. DELETE /:id -> 204

Cleanup automatique des users e2e + ligues creees.

## Hors scope (futurs)

- **Routes UI publiques de read-only** sur les standings, classements,
  history → Phase 2.G' quand le front sera cable.
- **Rate limiting specifique** par endpoint (le rate limiter global
  s'applique).
- **OpenAPI / Swagger** : generation depuis les schemas Zod ;
  reserve a une iteration polish.
