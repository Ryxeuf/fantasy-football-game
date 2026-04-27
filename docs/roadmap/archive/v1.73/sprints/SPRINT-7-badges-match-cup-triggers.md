# Sprint 7 — Badges Match & Cup Triggers (P2)

> Phase 2 du système Badges/Titres/Récompenses. Dépend de [SPRINT-6](./SPRINT-6-badges-foundation.md).
> À implémenter **dans la même PR** que SPRINT-6.

## Objectif

Brancher le système de badges sur les événements de match et de coupe :
- Hook dans `game-broadcast.ts::broadcastMatchEnd`
- Hook dans `forfeit-tracker.ts`
- Hook dans routes `cup.ts` (création + fin de coupe)
- Règles compétitives et coupes
- Titre dynamique `champion_cup` avec interpolation du nom/année

## Tickets

### 7.1 — Triggers & hooks backend

**Fichier :** `apps/server/src/services/achievements/triggers.ts`

Ajouter :

```ts
export enum Trigger {
  // ... P1
  MATCH_ENDED = "MATCH_ENDED",
  MATCH_FORFEITED = "MATCH_FORFEITED",
  CUP_CREATED = "CUP_CREATED",
  CUP_COMPLETED = "CUP_COMPLETED",
}
```

**Call-sites :**

#### `apps/server/src/services/game-broadcast.ts::broadcastMatchEnd`

Après broadcast, pour **chaque participant** (2 joueurs normalement) :

```ts
await dispatch(Trigger.MATCH_ENDED, {
  userId,
  matchId,
  won: boolean,          // victoire
  drawn: boolean,
  lost: boolean,
  touchdownsScored: number,
  touchdownsConceded: number,
  casualtiesInflicted: number,
  halfOfVictory: 1 | 2,  // pour quick_finish
  maxScoreGapBeforeComeback: number, // pour comeback_king
  finalElo: number,
});
```

#### `apps/server/src/services/forfeit-tracker.ts`

Quand un forfait est enregistré :

```ts
await dispatch(Trigger.MATCH_FORFEITED, { userId, matchId });
```

#### `apps/server/src/routes/cup.ts`

Après création d'une Cup :

```ts
await dispatch(Trigger.CUP_CREATED, { userId: creatorId, cupId });
```

Après transition statut `terminee` (endpoint qui gère la fin de coupe) — pour **tous les participants** :

```ts
await dispatch(Trigger.CUP_COMPLETED, {
  userId,
  cupId,
  cupName: cup.name,
  year: new Date().getFullYear(),
  finalRank: 1 | 2 | 3 | ..., // position finale
  totalParticipants: number,
});
```

**Tests :** `tests/integration/services/game-broadcast-achievements.test.ts` — vérifie que `dispatch` est appelé avec le bon contexte. Idem pour `forfeit-tracker` et `cup` routes.

---

### 7.2 — stats-updater : extensions match & cup

**Fichier :** `apps/server/src/services/achievements/stats-updater.ts`

Extensions requises :

- Sur `MATCH_ENDED` :
  - `matchesPlayed += 1`
  - Si `won` : `matchesWon += 1`, `currentWinStreak += 1`, `bestWinStreak = max(bestWinStreak, currentWinStreak)`
  - Si `lost` ou `drawn` : `currentWinStreak = 0`
  - `touchdownsScored += ctx.touchdownsScored`
  - `casualtiesInflicted += ctx.casualtiesInflicted`
- Sur `MATCH_FORFEITED` : `matchesForfeited += 1`, `currentWinStreak = 0`
- Sur `CUP_CREATED` : `cupsCreated += 1`
- Sur `CUP_COMPLETED` : `cupsCompleted += 1`, si `finalRank === 1` : `cupsWon += 1`

**Tests :** `tests/unit/services/achievements/stats-updater-match-cup.test.ts`.

---

### 7.3 — Règles compétitives (matches.rules.ts)

**Fichier :** `apps/server/src/services/achievements/rules/matches.rules.ts`

**Règles :**

| Règle | Badge | Trigger | Condition |
|---|---|---|---|
| `firstMatchRule` | `first_match` | MATCH_ENDED | `stats.matchesPlayed === 1` |
| `firstWinRule` | `first_win` | MATCH_ENDED | `won && stats.matchesWon === 1` |
| `matchesPlayedMilestoneRule` | `matches_played_10/50/100/500` | MATCH_ENDED | seuils |
| `winningStreakRule` | `winning_streak_3/5/10` | MATCH_ENDED | `stats.currentWinStreak >= N` |
| `flawlessVictoryRule` | `flawless_victory` | MATCH_ENDED | `won && ctx.touchdownsConceded === 0` |
| `comebackKingRule` | `comeback_king` | MATCH_ENDED | `won && ctx.maxScoreGapBeforeComeback >= 2` |
| `shutoutMasterRule` | `shutout_master` | MATCH_ENDED | compter 5 matchs gagnés sans encaisser (requête Prisma sur Match history) |
| `quickFinishRule` | `quick_finish` | MATCH_ENDED | `won && ctx.halfOfVictory === 1 && ctx.touchdownsScored === 4` |
| `eloMilestoneRule` | `elo_1500/1800/2000` | MATCH_ENDED | `ctx.finalElo >= N` |
| `forfeitZeroRule` | `forfeit_zero_50matches` | MATCH_ENDED | `stats.matchesPlayed >= 50 && stats.matchesForfeited === 0` |
| `goldsmithRule` | `goldsmith` | MATCH_ENDED | cumul trésoreries distribuées >= 1_000_000 (requête sur Team history) |

**Tests :** `tests/unit/services/achievements/rules/matches.rules.test.ts` — un test par règle + idempotence.

---

### 7.4 — Règles coupes (cups.rules.ts)

**Fichier :** `apps/server/src/services/achievements/rules/cups.rules.ts`

**Règles :**

| Règle | Badge/Titre | Trigger | Condition |
|---|---|---|---|
| `firstCupCreatedRule` | badge `first_cup_created` | CUP_CREATED | `stats.cupsCreated === 1` |
| `communityOrganizerRule` | badge `community_organizer` | CUP_CREATED | `stats.cupsCreated >= 5` |
| `cupFinisherRule` | badge `cup_finisher` | CUP_COMPLETED | toujours |
| `cupChampionRule` | badge `cup_champion` + titre dynamique `champion_cup` | CUP_COMPLETED | `ctx.finalRank === 1` |
| `cupChampionX5Rule` | badge `cup_champion_x5` | CUP_COMPLETED | `stats.cupsWon >= 5` |
| `cupChampionX10Rule` | badge `cup_champion_x10` | CUP_COMPLETED | `stats.cupsWon >= 10` |
| `cupRunnerUpRule` | badge `cup_runner_up` + titre dynamique `vice_champion_cup` | CUP_COMPLETED | `ctx.finalRank === 2` |

**Titre dynamique (champion) — construction du label :**

```ts
const title = await prisma.title.findUnique({ where: { slug: "champion_cup" } });
const label = title.nameFr
  .replace("{cupName}", ctx.cupName)
  .replace("{year}", String(ctx.year));
// ex: "Champion de la Coupe d'Hiver 2026"

await grantTitle(userId, "champion_cup", label, {
  context: { cupId: ctx.cupId, cupName: ctx.cupName, year: ctx.year },
  autoActivate: false, // l'utilisateur choisira via PUT /api/me/title
});
```

**Tests :** `tests/unit/services/achievements/rules/cups.rules.test.ts`.

---

### 7.5 — Règles "faits du jeu" (game-facts.rules.ts)

**Fichier :** `apps/server/src/services/achievements/rules/game-facts.rules.ts`

Règles dépendant d'événements intra-match (à collecter dans `ctx`) :

| Règle | Badge | Trigger | Condition |
|---|---|---|---|
| `kaboomRule` | `kaboom` | MATCH_ENDED | `ctx.casualtiesInflictedThisMatch >= 5` |
| `passmasterRule` | `passmaster` | MATCH_ENDED | cumul passes longues réussies >= 10 (requête) |
| `interceptorRule` | `interceptor_extraordinaire` | MATCH_ENDED | cumul interceptions >= 5 |
| `mvpCollectorRule` | `mvp_collector` | MATCH_ENDED | cumul `totalMvpAwards` sur TeamPlayer du user >= 25 |
| `apothecaryHeroRule` | `apothecary_hero` | MATCH_ENDED | cumul apothécaire-saves >= 10 (nécessite tracking dédié) |
| `legendaryPlayerRule` | `legendary_player` | MATCH_ENDED | existe un `TeamPlayer` du user avec `spp >= 51` |
| `nuffleLovedRule` | `nuffle_loved` (hidden) | MATCH_ENDED | ctx détection 6 double-skull évités |
| `nuffleCursedRule` | `nuffle_cursed` (hidden) | MATCH_ENDED | ctx détection 3 "1" sur dés cruciaux dans le match |

**Collecte de contexte** : nécessitera une extension dans `game-engine` pour remonter un résumé d'événements par match. Dans `broadcastMatchEnd`, passer à `dispatch` :

```ts
{
  ...
  casualtiesInflictedThisMatch: number,
  longPassesCompleted: number,
  interceptionsThisMatch: number,
  apothecarySaves: number,
  doubleSkullsAvoided: number,
  criticalOnesRolled: number,
}
```

**Si la collecte de certains sous-événements n'est pas triviale** (`apothecarySaves`, `doubleSkullsAvoided`), les marquer comme **TODO** dans le sprint : implémenter les règles avec fallback `0` et créer un ticket follow-up pour enrichir le résumé d'événements.

**Tests :** `tests/unit/services/achievements/rules/game-facts.rules.test.ts`.

---

### 7.6 — Titre "coach_elite" sur ELO

**Fichier :** `apps/server/src/services/achievements/rules/matches.rules.ts`

Règle supplémentaire :

```ts
coachEliteTitleRule:
  on MATCH_ENDED,
  if ctx.finalElo >= 1800:
    grantTitle(userId, "coach_elite", "Coach Élite", { autoActivate: false });
```

Et `legende_vivante` titre :

```ts
legendeVivanteTitleRule:
  on MATCH_ENDED,
  if stats.matchesPlayed >= 500:
    grantTitle(userId, "legende_vivante", "Légende vivante", { autoActivate: false });
```

Et `taulier_du_terrain` titre :

```ts
taulierRule:
  on MATCH_ENDED,
  if stats.matchesWon >= 100:
    grantTitle(userId, "taulier_du_terrain", "Taulier du terrain", { autoActivate: false });
```

Et `veteran` titre :

```ts
veteranRule:
  on MATCH_ENDED,
  if stats.matchesPlayed >= 100:
    grantTitle(userId, "veteran", "Vétéran", { autoActivate: false });
```

**Tests :** couvrir dans `matches.rules.test.ts`.

---

### 7.7 — Route enrichie : GET /api/me/badges avec progression

**Fichier :** `apps/server/src/routes/me-badges.ts`

Étendre la réponse pour inclure la progression sur badges non-débloqués (pour affichage UI "83% → matches_played_100") :

```ts
progress: [
  { slug: "matches_played_100", current: 83, target: 100, percent: 83 },
  { slug: "winning_streak_10", current: 4, target: 10, percent: 40 },
  ...
]
```

Calculs basés sur `UserStats`.

**Tests :** `tests/integration/routes/me-badges-progress.test.ts`.

---

## Checklist de complétion P2

- [ ] 7.1 Enum `Trigger` étendu, hooks dans `game-broadcast.ts`, `forfeit-tracker.ts`, `routes/cup.ts`
- [ ] 7.2 `stats-updater.ts` étendu (match + cup) + tests
- [ ] 7.3 `matches.rules.ts` (11 règles) + tests
- [ ] 7.4 `cups.rules.ts` (7 règles) + tests + titre dynamique `champion_cup` fonctionnel
- [ ] 7.5 `game-facts.rules.ts` (8 règles) + tests (fallback `0` si contexte absent, avec TODO)
- [ ] 7.6 Titres `coach_elite`, `legende_vivante`, `taulier_du_terrain`, `veteran` branchés
- [ ] 7.7 Endpoint `/api/me/badges` retourne la progression
- [ ] Coverage >= 80% sur `services/achievements/**`
- [ ] `pnpm turbo build` vert
- [ ] `pnpm turbo test` vert
- [ ] Test E2E minimal : jouer un match → badge `first_match` débloqué (via Playwright ou test integration bout-en-bout)

## Dépendances & ordre

1. **SPRINT-6 doit être complété** (service `dispatch`, `grantBadge`, `grantTitle`, `UserStats`, seed catalogue).
2. Les règles 7.5 game-facts nécessitent parfois des sous-données non triviales — implémenter avec fallback et marquer TODO.
3. **Toutes les règles P2 doivent être idempotentes** : un match re-broadcasté 2x ne doit pas créer de doublons.

## Points d'attention

- **Transactions** : la mise à jour `UserStats` et le grant de badges doivent être dans la même transaction Prisma quand le stat `UserStats.N` est la condition d'un badge, sinon race condition possible.
- **Cup finalRank** : la logique de classement existe déjà dans `apps/server/src/services/cup-ranking.ts` (à confirmer lors de l'implémentation). Réutiliser, ne pas dupliquer.
- **Shutout / Goldsmith** : nécessitent des requêtes d'historique — limiter à la fenêtre des 5 derniers matchs / total cumulé du user, avec index approprié.
