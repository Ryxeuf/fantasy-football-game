# 21 — Admin data explorer (Phase 3.C)

> Vues read-only sur le referentiel NFL (seasons, teams, players,
> stats) + actions de resync par joueur, agremenant la console admin
> qui jusque-la n'avait que des actions write (ingest, settle, etc.).

## Motivation

Avant Phase 3.C : `/admin/nfl-fantasy` exposait uniquement des
formulaires d'actions (Phase 3.B). Pour debugger ou auditer les
donnees ingerees (32 NflTeam, ~1500 NflPlayer, NflGameStat), un admin
devait passer par `psql` ou Prisma Studio. Phase 3.C comble ce trou.

## Backend

### Service `nfl-fantasy-admin-explorer.ts`

```ts
// Lecture
listNflSeasonsForAdmin() -> AdminSeasonRow[]
listNflTeamsForAdmin({ seasonId? }) -> AdminTeamRow[]
getNflTeamDetail({ code, seasonId? }) -> AdminTeamDetail | null
listNflPlayersForAdmin(opts) -> { players, total, page, pageSize }
getNflPlayerDetail({ id, seasonId? }) -> AdminPlayerDetail | null

// Mutations idempotentes (per-player)
recomputePlayerSpp(playerId) -> RecomputeSppResult
reDerivePlayerBb(playerId)  -> ReDeriveBbResult
```

- **Lecture** : 100% read-only, aucune mutation collaterale.
- **Filtres `listNflPlayersForAdmin`** : `teamCode`, `bbPosition`,
  `nflPosition`, `status`, `search` (pseudo/realName/gsis_id), `seasonId`,
  `page` (>=1), `pageSize` (1..200, default 50). Tri stable
  (`teamCode asc`, `bbPosition asc`, `pseudonym asc`).
- **`seasonId` agrege SPP** : si filtre, ajoute `totalSpp` + `gamesPlayed`
  par row (via N+1 evite par 1 seul `findMany` sur les playerIds visibles).
- **Pseudonymisation Q8** : `realName` exposé uniquement dans les pages
  admin (`adminOnly`), avec badge "privé" en UI quand
  `realNameDisplay = false`.
- **`recomputePlayerSpp`** : relance `computeSpp()` sur tous les
  `NflGameStat` du joueur a partir des `rawStats` stockes. Idempotent
  (meme rawStats → meme SPP). Util quand la formule SPP @bb/nfl-mapper
  evolue. Retourne `previousTotalSpp` vs `newTotalSpp` pour visibilite.
- **`reDerivePlayerBb`** : relance
  `getBbPosition(nflPosition, team.bbRace)`. Idempotent. Echec
  `PLAYER_NO_TEAM` si pas de teamCode (FA ou retired) — la race est
  determinee par l'equipe.

### Helper exporte

`buildStatLineFromRow(row, bbPosition)` deplace de `nfl-ingest.ts`
prive vers export public pour reutilisation par `recomputePlayerSpp`.

### Erreur typee

```ts
class NflFantasyAdminError extends Error {
  code: "PLAYER_NOT_FOUND" | "TEAM_NOT_FOUND" |
        "PLAYER_NO_TEAM" | "INVALID_BB_RACE"
}
```

Mappee via `nfl-error-mapper` :
- `PLAYER_NOT_FOUND`, `TEAM_NOT_FOUND` → 404
- `PLAYER_NO_TEAM`, `INVALID_BB_RACE` → 422

### Routes ajoutees

Toutes sous `/admin/nfl-fantasy/explore/*`, `authUser + adminOnly`.

| Method | Path | Service |
|---|---|---|
| GET | `/explore/seasons` | `listNflSeasonsForAdmin` |
| GET | `/explore/teams?seasonId=` | `listNflTeamsForAdmin` |
| GET | `/explore/teams/:code?seasonId=` | `getNflTeamDetail` |
| GET | `/explore/players?...` | `listNflPlayersForAdmin` |
| GET | `/explore/players/:id?seasonId=` | `getNflPlayerDetail` |
| POST | `/explore/players/:id/recompute-spp` | `recomputePlayerSpp` |
| POST | `/explore/players/:id/re-derive-bb` | `reDerivePlayerBb` |

## Frontend

### Layout `app/admin/nfl-fantasy/layout.tsx`

Wrappe toutes les pages `/admin/nfl-fantasy/*` avec :

- **SeasonContext** : charge `GET /explore/seasons` une fois, expose
  `selectedSeasonId` persiste en URL `?season=YYYY` (default = saison
  `in_progress` ou la plus recente).
- **SubNav** : tabs horizontaux Actions / Équipes / Joueurs.
- **SeasonPicker** : dropdown affiche en permanence, accompagne d'un
  resume `{games} games · {players} joueurs · {weeks} weeks`.

Le picker propage automatiquement le filtre saison a toutes les pages
qui consomment `useNflFantasySeason()`.

### Page `/admin/nfl-fantasy/teams`

- Headline : count `{filtered}/{total} équipes · saison {id}`.
- Filtres locaux : recherche text + dropdown race BB.
- Tableau : Code · Ville · Race BB · Label · Actifs · Total · Games.
- Click ligne → detail.

### Page `/admin/nfl-fantasy/teams/[code]`

- Header : code + ville + race badge + back link.
- 3 cards : Actifs / Total roster / Games (saison).
- Roster table avec status badges colorees (active/ir/retired/suspended)
  + summary par status.
- Calendrier games (week, opponent, lieu, kickoff, score, status).

### Page `/admin/nfl-fantasy/players`

- Filtres : recherche (pseudo/realName/gsis_id) + team + bbPosition
  + status + (implicite) saison via picker.
- Tableau : Pseudonym · Real name (avec badge "privé") · Team · # · NFL
  pos · BB pos · Status · (si saison) Games + SPP.
- Pagination 50/page avec compteur `X-Y / total`.
- Search debounce 250ms.

### Page `/admin/nfl-fantasy/players/[id]`

- Header : pseudonym + status + realName (badge "privé") + gsis_id.
- 3 cards : NFL / Mapping BB / Carriere saison (totalSpp, gamesPlayed,
  moyenne).
- **Actions de resync** :
  - `🔄 Recompute SPP` → POST `/explore/players/:id/recompute-spp`,
    feedback `SPP X → Y (±Δ)`.
  - `🧬 Re-derive BB` → POST `/explore/players/:id/re-derive-bb`,
    feedback `prev → new` ou "aucune modification" (idempotent).
  - Bouton "Re-derive BB" disabled + tooltip si `team == null`.
- Tableau stats par game (week, opponent, score, computedSpp, source)
  + drill-down JSON sppBreakdown + rawStats.

## Tests

`nfl-fantasy-admin-explorer.test.ts` : **18 tests** sur 8 functions :
- `listNflSeasonsForAdmin` : empty + agregation
- `listNflTeamsForAdmin` : compteurs + sans seasonId
- `getNflTeamDetail` : null + detail complet
- `listNflPlayersForAdmin` : clamp page/pageSize + SPP agrege + pas
  de SPP sans seasonId
- `getNflPlayerDetail` : null + stats tries DESC
- `recomputePlayerSpp` : PLAYER_NOT_FOUND + update + null rawStats
- `reDerivePlayerBb` : PLAYER_NOT_FOUND + PLAYER_NO_TEAM + update si
  different + idempotent si identique

## Validation E2E

`scripts/nfl-fantasy-admin-explorer-e2e.ts`, **9 etapes OK** sur
Postgres reel :

```
docker exec nufflearena_server sh -c "cd /app/apps/server && \
  pnpm exec tsx src/scripts/nfl-fantasy-admin-explorer-e2e.ts"
```

1. `listNflSeasonsForAdmin` renvoie un tableau
2. `listNflTeamsForAdmin` renvoie 32 teams (KC = Skaven verifie)
3. `getNflTeamDetail(KC)` renvoie city + race + roster + games
4. `getNflTeamDetail(XXX)` renvoie null
5. `listNflPlayersForAdmin` paginee a 50/page
6. `getNflPlayerDetail(:id)` renvoie detail complet
7. `reDerivePlayerBb` idempotent (changed=false en 2eme call)
8. `recomputePlayerSpp` idempotent (newTotalSpp identique en N+1)
9. `reDerivePlayerBb(ghost)` throw `PLAYER_NOT_FOUND`

Smoke frontend : `/admin/nfl-fantasy/teams` et `/players` compilent
sans warning, gating auth en 307 → /admin/sync comme attendu.

## Hors scope V1 (futurs)

- **Resync ESPN par joueur** : ESPN ne fournit pas de mapping stable
  `gsis_id ↔ ESPN id`. Solution viable : passer par `ingestEspnRosters`
  filtre sur le `teamCode` du joueur (3.C.bis si besoin).
- **Vue calendrier global** : `/admin/nfl-fantasy/weeks` qui liste les
  22 weeks de la saison + games par week → Phase 3.D.
- **Audit log ingest** : `/admin/nfl-fantasy/ingest-runs` avec
  `NflIngestRun` (trie DESC, drill-down errors) → Phase 3.D.
- **Leagues globales admin** : `/admin/nfl-fantasy/leagues` (toutes
  les leagues, pas seulement les miennes) → Phase 3.D.
- **Backfill 2023 + 2024** : script
  `scripts/backfill-past-seasons.ts` qui boucle `seed-season` +
  ingest weeks 1..18 par saison → Phase 3.E (apres avoir valide
  l'explorer).
- **Recompute SPP en bulk** par saison ou par equipe : pour
  ré-appliquer une nouvelle formule de scoring sans toucher chaque
  joueur a la main → Phase 3.E.
