# 25 — Detail matchup, cleanup replays, optimal lineup (Phase 3.I + 3.J + 3.K)

> Trois ajouts a l'admin construits sur les fondations replay/bulk
> de la Phase 3.F+3.G. Chacun ferme un "futur" liste dans
> `24-bulk-actions-replay.md` (sauf le snake interactif).

## Phase 3.I — Cleanup leagues replay

Apres plusieurs runs de replay (debug formula scoring, tests E2E,
demo), la DB accumule des leagues `replay-{seasonId}-owner-{ts}` qui
polluent les vues `/admin/nfl-fantasy/leagues`. Endpoint + bouton
dedie pour les supprimer en masse.

### Service `cleanupReplayLeagues`

```ts
cleanupReplayLeagues()
  -> { deletedCount, leagueIds }
```

- `prisma.nflFantasyLeague.deleteMany({ where: { ownerId: { startsWith: "replay-" } } })`.
- Cascade ON DELETE de Prisma supprime entries / rosters / lineups /
  starters / matchups / rerolls / inducements.
- Idempotent : 0 deletion si pas de replay leagues.

### Route

```
POST /admin/nfl-fantasy/explore/leagues/replay-cleanup
```

### UI (sur `/admin/nfl-fantasy/weeks`)

Troisieme card dans `SeasonActions.tsx` (a cote de Recompute SPP et
Replay), bouton rouge avec `window.confirm`. Resultat inline :
`"✓ N leagues replay supprimees."`.

## Phase 3.J — Detail matchup individuel

Au lieu de devoir cliquer matchup par matchup dans la console (ou
debugguer via psql), une page admin dediee montre exactement qui a
marque quoi dans un match donne. Particulierement utile pour
verifier le multiplier captain ×1.5 / vice ×1.2 et inspecter le
sppBreakdown JSON.

### Service `getMatchupDetailForAdmin`

```ts
getMatchupDetailForAdmin(matchupId)
  -> AdminMatchupDetail | null
```

`AdminMatchupDetail` :

- Metadata matchup (id, leagueId, leagueName, seasonId, weekId)
- `home` + `away` : `AdminMatchupSideRow` avec
  - entryId, userId, teamName, bbRace, score
  - lineup courant (lineupId, captainId, viceCaptainId, lockedAt,
    totalSpp)
  - starters tries par finalSpp DESC, chacun avec rawSpp / finalSpp
    / sppBreakdown / isCaptain / isViceCaptain / playerPseudonym /
    teamCode / nflPosition / bbPosition
- `winnerSide`: `"home" | "away" | "tie" | null`
- `settledAt`, `createdAt`

Le service charge en 5 queries (matchup + league + entries + lineups
+ starters + players). Pas de N+1.

### Erreur typee

Pas de classe d'erreur dedie — retourne `null` si introuvable, mappe
404 dans le route handler.

### Route

```
GET /admin/nfl-fantasy/explore/matchups/:id
```

### Page `/admin/nfl-fantasy/matchups/[id]`

Layout 2 cards cote-a-cote (home / away). Card gagnante a une
bordure emerald. Chaque starter cliquable :

- Lien vers `/admin/nfl-fantasy/players/{id}` (deja existant 3.C)
- Click sur la row (en dehors du lien) toggle l'affichage du
  `sppBreakdown` JSON inline en dessous

Le tableau matchups de `/admin/nfl-fantasy/leagues/[id]` recoit une
colonne supplementaire avec un lien "Detail" vers la nouvelle page.

## Phase 3.K — Optimal lineup pour replay

Le replay par defaut prend les 11 premiers du roster (ordre
acquisition). C'est realiste mais bruite par le hasard du draft. Le
mode `optimal` choisit pour chaque week les 11 joueurs du roster
ayant le plus haut `computedSpp` cette semaine — du **hindsight
cheating** mais utile pour donner un upper-bound de ce que la
team aurait pu marquer.

### Extension `replaySeason`

```ts
type ReplayLineupMode = "first11" | "optimal";

replaySeason({
  seasonId,
  teamCount?,
  fromWeek?, toWeek?,
  lineupMode?: ReplayLineupMode,  // default 'first11'
  ...
}) -> ReplaySeasonResult & { lineupMode: ReplayLineupMode }
```

Helper interne `pickOptimalStarters(roster, weekId)` :

1. Recupere les `playerId` du roster
2. `prisma.nflGameStat.findMany({ where: { playerId: { in: ids }, game: { weekId } }, select: { playerId, computedSpp } })`
3. Aggrege par player (somme si plusieurs games), 0 si absent
4. Tri stable DESC par SPP, tie-break sur l'ordre roster
5. Retourne les 11 premiers

Captain = top 1, vice = top 2 (comme en `first11`).

### Route

Body Zod accepte maintenant `lineupMode: z.enum(["first11", "optimal"]).optional()`.

### UI

Le card Replay de `SeasonActions.tsx` ajoute un `<select>` avec :

- `first11 — ordre roster (realiste)`
- `optimal — top 11 SPP/week (hindsight, upper-bound)`

Le feedback success affiche le `lineupMode` utilise dans le message :
`"✓ Replay OK (optimal) : 18 weeks settled, ..."`.

## Tests

| Fichier | Nouveaux tests |
|---|---|
| `nfl-fantasy-admin-explorer.test.ts` | +2 cleanup + +4 matchup detail = 42 total |
| `nfl-fantasy-replay.test.ts` | +3 (optimal mode + default = first11 + lineupMode dans result) = 13 total |

Tous au vert. Pas de modification du schema Prisma.

## Hors scope (futurs)

- **Predicted lineup** (vs hindsight optimal) : pick top 11 par
  moyenne SPP des N dernieres weeks. Suppose un historique 2023+2024
  charge mais utilise la moyenne, pas le "vrai" score de la week. Moins
  utile pour validation, plus realiste pour produit.
- **Comparaison side-by-side first11 vs optimal** : creer 2 leagues
  jumelles dans le meme call, retourner les 2 ids. Permet de
  visualiser la marge perdue par un coach passif.
- **Detail matchup avec waiver / mercato breakdown** : actuellement
  on montre starters + sppBreakdown. V2 : aussi les rerolls/
  inducements consommes (cf. models `NflFantasyReroll`/
  `NflFantasyInducement` deja en schema).
