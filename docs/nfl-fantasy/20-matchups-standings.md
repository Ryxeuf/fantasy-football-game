# 20 — Matchups + Standings UI (Phase A.3)

> Page user-facing qui affiche les paires home/away par semaine
> (scores + winner si settle) et le tableau standings agregé
> (W-L-T-PF-PA) derive de tous les matchups settles d'une league.

## Backend

### Helper pur `computeStandings`

```ts
computeStandings({ entries, matchups }) -> StandingsRow[]
```

- Pur, testable sans Prisma.
- Ignore les matchups `settledAt = null` ou avec scores null.
- Comptabilise W/L/T + PF/PA par entry.
- Tri : `wins desc` → `differential desc` → `pointsFor desc`.
- Une entry sans aucun matchup reste dans la liste (`games: 0`).

### `getLeagueStandings(leagueId)`

Wrapper Prisma : `findMany` entries + `findMany` matchups settles +
`computeStandings`. Read-only, recalcule a chaque appel (V1 suffisant ;
V2 introduira une vue persistee + invalidation au settle).

### Routes ajoutees

| Method | Path | Service |
|---|---|---|
| GET | `/api/nfl-fantasy/leagues/:id/matchups?weekId=` | `listMatchupsForWeek` |
| GET | `/api/nfl-fantasy/leagues/:id/standings` | `getLeagueStandings` |

Les deux sont sous `authUser` (membre ou pas, on autorise la
visualisation — pas de regle "public only" en V1).

## Frontend

### Page `/nfl-fantasy/leagues/[id]/matchups`

Layout 2 sections :

**Standings** (toujours affiche) :
- Tableau `#` / `Équipe` / `W-L-T` / `PF` / `PA` / `Diff`
- Surlignage orange sur la ligne de l'utilisateur courant ("Toi" badge)
- Couleur differentielle : vert si positif, rouge si negatif
- Etat vide explicite "Aucun matchup réglé pour l'instant"

**Matchups** :
- Selecteur `weekId` (defaut `2025:W10`, format `YYYY:W{n}`)
- Liste cards `homeName vs awayName` avec scores et winner highlight
- Badge "Ton match" / "Victoire 🎉" / "Match nul" / "Défaite" si
  l'utilisateur est dans le matchup
- Etat vide explicite si pas de matchup pour la week

### Liens depuis la page detail

- Membre + status `in_progress` : CTA "📊 Matchups & standings" à
  côté du CTA lineup
- Non-membre + status `in_progress` : lien discret "Voir matchups &
  standings"
- Pas affiche en status `draft` (aucun matchup possible avant
  finalize)

## Validation E2E

`scripts/nfl-fantasy-matchups-e2e.ts`, **4 etapes OK** sur Postgres :

```
docker exec nufflearena_server sh -c "cd /app/apps/server && \
  pnpm exec tsx src/scripts/nfl-fantasy-matchups-e2e.ts"
```

1. Setup : league 2 entries + autoFill + finalize + setLineup + settle
   W10
2. `listMatchupsForWeek(W10)` → 1 matchup settle avec scores reels
3. `listMatchupsForWeek(W11)` → vide (autre week, pas settle)
4. `getLeagueStandings` → 2 rows, top sorted by wins+diff, total games = 2
5. `computeStandings` pur sur 0 matchup → tous rows à 0

Smoke frontend : `https://web.nuffle-arena.orb.local/nfl-fantasy/leagues/test/matchups`
retourne HTTP 200 (Next.js compile en 350ms, aucun warning).

## Tests unitaires

`nfl-fantasy-scoring.test.ts` : **6 tests ajoutes** (33 total) :
- `computeStandings` : 0 matchup, ignore non-settles, W/L/T+PF/PA,
  tri, entry sans matchup
- `getLeagueStandings` : fetch + compute + tri OK

## Hors scope V1 (futurs)

- **Detail d'un matchup** (`/matchups/:matchupId`) : voir starters
  de chaque side avec leur `finalSpp` individuel. Endpoint backend a
  ajouter (`GET /api/nfl-fantasy/matchups/:matchupId/detail`).
- **Standings persistee** : table dediee invalidee au settle plutot
  que recompute a chaque GET. Reservee a V2 quand le scale justifiera.
- **Playoffs bracket** : aujourd'hui les matchups suivent le
  round-robin "circle method" Phase 2.E. Un bracket playoffs
  configurable post regular-season arrivera en Phase 2.E'.
- **Storytelling Gazette** par matchup : narratif post-settle (LLM
  reuse du pro-gazette-llm existant) — Phase 3.D'.
