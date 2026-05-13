# Fix full driver — 3 bugs bloquants (2026-05-13)

> Le full driver (auto-play IA-vs-IA avec actions individuelles, livré
> via Lots 3.A.0 → 3.C.3) terminait systématiquement les matchs à
> Half 1 Turn 3 avec score 0-0. Inutilisable en pratique → aucune
> saison Pro League ne pouvait tourner en `driverKind='full'`.
>
> Investigation déclenchée par un test match sandbox
> (`cmp44mb260003ll60wjnv7sbu`) qui exposait le bug sur la page `/live`.

## Diagnostic

Sur le seed=42 instrumenté avec `DEBUG_FULL_DRIVER=1` :

```
step=3  move=END_TURN A→B (turn=1→1)    stale=1
step=7  move=END_TURN B→A (turn=1→2)    stale=2  ← faux positif
step=9  move=END_TURN A→B (turn=2→2)    stale=3
step=13 move=END_TURN B→A (turn=2→3)    stale=4
... → break: stale END_TURN (5) at action=17 half=1 turn=3
```

La stale-detection comparait `state.turn === lastTurn` **avant** l'appel
à `applyMove`. En BB, `state.turn` n'avance qu'**un END_TURN sur deux**
(cycle A turn N → B turn N → A turn N+1). Donc même en jeu normal, le
compteur montait à chaque END_TURN qui changeait juste `currentPlayer`
sans changer `turn`. Avec `MAX_STALE_END_TURNS = 4`, on breakait au
3ème tour.

Deux bugs annexes visibles dans le stream d'events :

1. `TURN_START.drivingTeam` était **toujours** `"home"`. La condition
   d'émission dans `full-driver-events.ts` était `next.turn > prev.turn
   || next.half > prev.half` — manquait `currentPlayer` change.
2. `summary.durationMs` hardcodé à `0` dans `full-driver.ts:360`.

## Fix

### 1. Stale-detection basée sur l'effet réel du move

Avant :
```ts
if (state.turn === lastTurn && state.half === lastHalf) {
  staleEndTurns += 1;
}
```

Après — comparer `prev` (avant `applyMove`) à `next` (après) :
```ts
const advanced =
  next.turn !== prev.turn ||
  next.half !== prev.half ||
  next.currentPlayer !== prev.currentPlayer;
if (advanced) {
  staleEndTurns = 0;
} else {
  staleEndTurns += 1;
  if (staleEndTurns > MAX_STALE_END_TURNS) break;
}
```

Un END_TURN qui change vraiment quelque chose (au moins le joueur
actif) reset le compteur. Seuls les END_TURN qui ne font rien
(typiquement un état post-turnover où l'IA boucle) comptent.

### 2. TURN_START à chaque alternance home/away

Dans `full-driver-events.ts:271` :

```ts
const turnAdvanced = next.turn > prev.turn || next.half > prev.half;
const playerSwitched = next.currentPlayer !== prev.currentPlayer;
if (
  next.gamePhase !== 'ended' &&
  next.gamePhase !== 'halftime' &&
  (turnAdvanced || playerSwitched)
) {
  events.push({ type: 'TURN_START', ... });
}
```

Le guard `gamePhase !== 'halftime'` évite un TURN_START parasite juste
avant le HALFTIME event.

### 3. durationMs depuis le dernier event

```ts
const lastEvent = events[events.length - 1];
const durationMs = lastEvent ? lastEvent.displayAtMs : 0;
```

## Résultat

| Métrique | Avant | Après |
|---|---|---|
| TURN_START / match (seed=42) | 3 | 16 |
| HALFTIME / match | 0 | 1 |
| Score (5 seeds Gold Rush vs Iron Bears) | 0-0 × 5 | 0-0 / 1-0 × 4 |
| `summary.durationMs` | 0 | 64-94s |
| `drivingTeam` distincts dans TURN_START | `{home}` | `{home, away}` |

## Bump engineVer

`0.18.0 → 0.19.0` ([types.ts:18](../packages/sim-engine/src/types.ts)).
Le comportement du full driver change ; les replays existants en 0.18.0
restent lisibles (broadcaster) mais ne sont pas reproductibles à
l'identique avec le nouveau code. Aucune saison Pro League prod ne
tournait en full → impact production nul.

## Tests

3 régressions ajoutées dans
[`full-driver.test.ts`](../packages/sim-engine/src/driver/full-driver.test.ts) :

- `joue les 2 mi-temps complètes (HALFTIME + ≥10 TURN_START)`
- `alterne drivingTeam home/away dans les TURN_START`
- `summary.durationMs > 0 et match le displayAtMs du dernier event`

Suite complète : 385/385 sim-engine + 2785/2785 server — aucune régression.

## Reste à faire

- **Tuning AI** : avec le full driver fonctionnel, mesurer la drift
  vs FUMBBL (cf. [SPRINT-sim-engine-3a1-ai-audit.md](./roadmap/sprints/SPRINT-sim-engine-3a1-ai-audit.md))
  et ajuster les poids `EVAL_WEIGHTS` ou bumper la sophistication (3-ply,
  meilleur opening book).
- **Lot 3.A.3** : enrichir le mapping action → MatchEvent
  (PLAYER_ACTIVATION, KNOCKDOWN, BLITZ_DECLARED).
- **Lot 3.A.4** : narrator roster-aware ("Bob plaque Carla" au lieu de
  "A1 plaque B1").
