# 22 — Backfill saisons passees (Phase 3.E)

> Pre-charge des saisons 2023 et 2024 dans la DB pour valider le
> scoring sur des donnees reelles + offrir un historique aux nouveaux
> utilisateurs avant la mise en ligne.

## Motivation

Avant Phase 3.E : la DB ne contenait que la saison 2025 (in_progress),
ingee semaine par semaine. Trois problemes :

1. **Tests insuffisants** : impossible de valider la formule SPP
   `@bb/nfl-mapper` sur une saison entiere ou les playoffs.
2. **Donnees pauvres pour le user-facing** : un nouvel utilisateur qui
   ouvre l'explorer admin (Phase 3.C) voit ~14 games W10 et c'est
   tout. Pas de "top earners 2024" possible.
3. **Pas de replay possible** : impossible de simuler une league sur
   2024 pour valider matchups + standings + storytelling.

## Decision : 2023 + 2024

Recommandation tranchee (cf. echange utilisateur 2026-05-20) : seed
2023 + 2024 = 2 saisons reelles. Volumes attendus par saison :

- ~272 games REG (16×17, soit 32 teams × 17 weeks / 2) + 13 playoffs
  (Wildcard 6 + Div 4 + Conf 2 + SB 1) = ~285 games
- ~10-12k NflGameStat (env. ~40 stat lines/game)
- ~2-3k NflPlayer (overlap inter-saisons, gsis_id stable)

Total cumulatif pour 2023+2024 : ~30k NflGameStat, ~4k NflPlayer
distincts. Aucun probleme pour Postgres.

## Implementation

### Service `backfillNflSeason`

```ts
backfillNflSeason({
  seasonId: "2024",
  fromWeek?: 1,     // default 1
  toWeek?: 22,      // default 22 (inclut playoffs W19-22)
  skipExisting?: true,  // skip si NflIngestRun success exist
  onProgress?: (w, status, result?, error?) => void,
  fetchCsv?: (year) => Promise<string>,  // override tests
})
```

Steps :

1. `seedNflSeason(seasonId)` — cree NflSeason + 22 NflWeek (idempotent).
2. **Fetch CSV une seule fois** (~3MB nflverse) puis injecte via
   `fetchCsv` override dans chaque `ingestNflverseWeek`. Sans cette
   optimisation, 22 weeks × 3MB = 66MB de download redondant par
   saison.
3. Boucle `fromWeek..toWeek` :
   - Check `NflIngestRun{source=nflverse, weekId, status=success}` →
     skip si trouve (idempotent au niveau run).
   - Sinon `ingestNflverseWeek` qui upsert game + player + stat +
     computedSpp via `computeSpp()`.
4. Collecte les erreurs par week, ne stoppe pas la boucle (resilient).

Retourne `BackfillSeasonResult` : `weeksProcessed`, `weeksSkipped`,
`weeksFailed`, `totalPlayers/Stats/Games`, `errors[]`.

### Script CLI `backfill-past-seasons.ts`

```bash
docker exec nufflearena_server sh -c "cd /app/apps/server && \
  pnpm exec tsx src/scripts/backfill-past-seasons.ts"

# Options :
#   --season 2023 --season 2024   (default = both)
#   --from 1                       (default 1)
#   --to 22                        (default 22 = inclut playoffs)
#   --no-skip                      (force re-ingest)
```

Progress logger :
```
[backfill] === Saison 2024 ===
  W01  16 games · 350 players · 950 stats
  W02  16 games · 380 players · 920 stats
  ...
[backfill] Saison 2024 OK in 8m12s : 22 ingested, 0 skipped, 0 failed · 285 games · 3200 players · 10800 stats
```

Idempotent : un re-run skip toutes les weeks deja success. Util pour
relancer si un crash ou une erreur reseau a interrompu.

## Tests

`nfl-ingest.test.ts` : **6 tests ajoutes** sur `backfillNflSeason` (42
total) :
- `INVALID_WEEK_NUMBER` pour ranges invalides (5→2, 0, >22)
- Skip si `NflIngestRun success` exist (skipExisting=true par default)
- Re-ingest si `skipExisting=false` (`findFirst` jamais appele)
- CSV cache : 1 seul fetch pour N weeks
- Collecte d'erreurs par week sans arreter la boucle
- `onProgress` appele avec status `ingested | skipped | failed`

## Resultats reels (run 2026-05-20)

> Mise a jour au prochain commit avec les totaux observes.

```
[backfill] saisons=[2023,2024] weeks=1-22 skipExisting=true
[backfill] === Saison 2023 === ...
[backfill] === Saison 2024 === ...
[backfill] TOTAL ... : X games · Y players · Z stats · 0 weeks failed
```

## Verifications post-backfill

Apres le run, depuis l'explorer admin Phase 3.C :

- `/admin/nfl-fantasy/teams?season=2024` → chaque equipe doit avoir
  `gamesInSeason >= 17` (saison reg + eventuels playoffs).
- `/admin/nfl-fantasy/players?season=2024` → top earners visibles avec
  `totalSpp` agrege sur la saison.
- Detail d'un joueur (`/players/[id]?season=2024`) → 17+ stat lines
  avec SPP par game.

## Hors scope (Phase 3.F+)

- **Re-derive BB en bulk** sur les joueurs historiques quand la table
  de mapping evolue → Phase 3.F.
- **Recompute SPP en bulk** quand la formule `computeSpp()` change →
  Phase 3.F (parallele du bouton per-player Phase 3.C.2).
- **Re-play d'une saison passee** : creer une demo league sur 2024,
  auto-fill + finalize + bulk-settle weeks 1-18 → Phase 3.G.
- **Backfill ESPN scores** : nflverse a deja les scores via game_id,
  mais ESPN affine (kickoff exact, status real-time). Pour le passe,
  pas critique.
