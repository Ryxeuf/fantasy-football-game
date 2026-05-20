# 24 — Bulk actions saison + replay (Phase 3.F + 3.G)

> Trois actions admin qui exploitent l'historique 2023+2024 ingéré
> en Phase 3.E : recompute SPP en masse, re-derive BB en masse, et
> **replay** complet d'une saison passée.

## Motivation

Apres Phase 3.E (backfill 2023+2024) on a ~37k stat lines historiques
en DB. Trois besoins :

1. **Recompute SPP saison** : si la formule `@bb/nfl-mapper computeSpp`
   evolue (ex: nouveau bonus passing TD), on veut relancer le calcul
   sur toute la saison sans cliquer 1500 fois.
2. **Re-derive BB en masse** : si le mapping race-dependent change
   (ex: WR Skaven devient `Gutter Runner` au lieu de `Catcher`), idem
   bouton unique pour propager.
3. **Replay** : valider end-to-end le pipeline (draft → lineup →
   matchup → settle → standings) sur des stats reelles. Permet de
   prouver que le scoring fonctionne avant la mise en ligne, et
   d'avoir un historique demo pour les nouveaux utilisateurs.

## Backend Phase 3.F (bulk)

### Extension `nfl-fantasy-admin-explorer.ts`

```ts
recomputeSeasonSpp(seasonId)
  -> { seasonId, statsUpdated, previousTotalSpp, newTotalSpp, errors }

reDeriveAllPlayersBb()
  -> { playersUpdated, playersUnchanged, playersSkipped, errors }
```

- `recomputeSeasonSpp` charge tous les `NflGameStat` de la saison avec
  `player.bbPosition` joint, reconstruit la `NflPlayerStatLine` via
  `buildStatLineFromRow` (exporté Phase 3.C), applique `computeSpp` et
  persiste. Bloquant ~30-60s pour 19k stats. Collecte les erreurs par
  stat sans arreter la boucle.
- `reDeriveAllPlayersBb` charge tous les `NflPlayer` avec `teamCode`,
  pre-charge la Map `code → bbRace` en 1 query, puis re-derive
  `bbPosition = getBbPosition(nflPosition, teamRace)`. Update
  uniquement si different (idempotent). Skip si teamRace introuvable
  (cas equipe non seedée ou erreur DB).

### Routes ajoutees

| Method | Path | Service |
|---|---|---|
| POST | `/admin/nfl-fantasy/explore/seasons/:id/recompute-spp` | `recomputeSeasonSpp` |
| POST | `/admin/nfl-fantasy/explore/players/re-derive-bb-bulk` | `reDeriveAllPlayersBb` |

`SEASON_NOT_FOUND` ajouté au code union `NflFantasyAdminError`
(mappé 404).

## Backend Phase 3.G (replay)

### Nouveau service `nfl-fantasy-replay.ts`

```ts
replaySeason({
  seasonId,
  teamCount?: 8,            // 2-16
  playersPerEntry?: 15,     // 11-30
  fromWeek?: 1,
  toWeek?: 18,              // skip playoffs par defaut
  nameSuffix?,
  onProgress?,
}) -> { leagueId, weeksSettled, weeksFailed, errors }
```

Flow :

1. Verifie `NflSeason` existe (sinon `SEASON_NOT_FOUND`).
2. `createLeague` avec un owner synthetique
   `replay-{seasonId}-owner-{ts}` (private + snake).
3. Insere directement `teamCount - 1` entries (skip `joinLeague` qui
   dependrait d'`inviteCode` — pas pertinent en admin).
4. `autoFillRosters` (seed = leagueId, deterministe).
5. `finalizeLeague` (status → in_progress + seed 8 rerolls / entry).
6. Pour chaque week `fromWeek..toWeek` :
   - Pour chaque entry : `setLineup` avec les 11 premiers joueurs du
     roster, `captain = starters[0]`, `vice = starters[1]`.
   - `generateMatchups` (idempotent — skip si exist).
   - `lockLineups` (requis pour `settleNflFantasyWeek`).
   - `settleNflFantasyWeek` (lit `NflGameStat.computedSpp`, applique
     captain ×1.5 / vice ×1.2, persiste scores + winnerId + settledAt
     + finalSpp).
7. Erreurs par week collectees, la boucle continue.

### Erreur typee

```ts
class NflFantasyReplayError extends Error {
  code: "SEASON_NOT_FOUND" | "INVALID_TEAM_COUNT" | "INVALID_WEEK_RANGE"
}
```

Mappee dans `nfl-error-mapper` :
- `SEASON_NOT_FOUND` → 404 (deja present)
- `INVALID_TEAM_COUNT`, `INVALID_WEEK_RANGE` → 422

### Route

```
POST /admin/nfl-fantasy/explore/seasons/:id/replay
Body Zod: { teamCount?, playersPerEntry?, fromWeek?, toWeek?, nameSuffix? }
```

## Frontend

### Composant `SeasonActions.tsx` (sur `/admin/nfl-fantasy/weeks`)

Section orange "🎬 Actions saison X" en haut du calendrier, avec 2
cards :

- **Recompute SPP** : bouton avec `window.confirm` (operation longue),
  feedback `SPP previous → new` + nb errors.
- **Replay** : 3 inputs (teamCount default 8, fromWeek 1, toWeek 18),
  bouton qui POST et affiche success message + **link cliquable vers
  `/admin/nfl-fantasy/leagues/{newLeagueId}`** pour voir le résultat
  immédiatement.

### Composant inline `ReDeriveBbBulkAction` (sur `/admin/nfl-fantasy/players`)

Bouton avec confirm pour relancer `getBbPosition()` sur tous les
joueurs avec `teamCode`. Resultat inline `updated/unchanged/skipped`.

## Tests

- `nfl-fantasy-admin-explorer.test.ts` : **+6 tests** (36 total) pour
  `recomputeSeasonSpp` (3) et `reDeriveAllPlayersBb` (3).
- `nfl-fantasy-replay.test.ts` : **+10 tests** :
  - Validation des inputs (INVALID_TEAM_COUNT, INVALID_WEEK_RANGE,
    SEASON_NOT_FOUND)
  - Happy path : orchestration verifiee (createLeague + N-1 entries
    + autoFill + finalize + N settles)
  - Roster < 11 joueurs throw
  - Collecte erreurs par week
  - onProgress callback

## Validation E2E

Sur DB Postgres reelle (saisons 2023+2024 backfilles) :

**Replay 8 teams × W1-W18 de 2024 — 4 secondes** :
```
W1/W2/.../W18/ done
{ leagueId, weeksSettled: 18, weeksFailed: 0, dt: 4091ms }

Standings :
  Replay Team 5 : 15-2-1 · PF=226 PA=80 diff=146
  Replay Team 2 : 15-3-0 · PF=211 PA=85 diff=126
  Replay Team 6 : 10-8-0 · PF=121 PA=102 diff=19
  Replay Team 7 : 8-8-2 · PF=61 PA=86 diff=-25
  Replay Team 1 : 7-10-1 · PF=62 PA=98 diff=-36
```

L'ecart 226-61 reflete bien le hasard du draft (top team a tire des
QB superstars du 2024 dans son auto-fill). Le ratio captain ×1.5 /
vice ×1.2 + 11 starters statiques sur 18 weeks reproduit un
comportement fantasy realiste.

## Hors scope (futurs)

- **Background job pour bulk** : un `recomputeSeasonSpp` bloquant
  30-60s n'est pas ideal. V2 : worker async + progress polling via
  `NflIngestRun` ou modele dedie.
- **Replay avec lineup optimization** : actuellement on prend les 11
  premiers du roster. V2 : pick top 11 SPP earners du roster pour la
  week (hindsight cheating mais utile pour upper-bound).
- **Replay snake draft interactif** : actuellement auto-fill random.
  V2 : reuse l'UI draft pour piloter le replay turn-by-turn.
- **Cleanup automatique des leagues de replay** : actuellement elles
  restent en DB. Endpoint admin `/admin/nfl-fantasy/explore/leagues/replay-cleanup`
  qui DELETE WHERE ownerId LIKE 'replay-%' pourrait aider.
