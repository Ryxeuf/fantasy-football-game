# Lots 3.D.1 → 3.D.5 — replay terrain BB IA-vs-IA (2026-05-13)

> Le full driver produisait des `MatchEvent[]` (BLOCK, PASS, KO, etc.)
> qui alimentent un ticker textuel et un `<ProLeagueField>` abstrait
> (point jaune = balle, score). L'utilisateur voulait voir le replay
> comme un match `/play` réel : terrain BB Pixi, joueurs visibles sur
> le pitch, animations.
>
> Ces 5 lots livrent l'**Option A** : persister `(initialState, moves,
> states)` à la simulation, et rejouer pas-à-pas côté browser dans
> `<GameBoardWithDugouts>` — le même composant que `/play`.

## Lot 3.D.1 — persistance du re-jeu visuel

[types.ts](../packages/sim-engine/src/types.ts) — `SimResult` gagne un
champ optionnel `fullReplay` :

```ts
fullReplay?: {
  readonly initialState: GameState;
  readonly moves: readonly Move[];
  readonly states: readonly GameState[];
};
```

[full-driver.ts](../packages/sim-engine/src/driver/full-driver.ts)
capture `initialState` (post-kickoff, avant la boucle) puis pousse
`states[i] = applyMove(prev, moves[i], rng)` à chaque itération.

**Choix : on stocke `states[]` plutôt que de rejouer `applyMove` côté
client.** Raison : `applyMove` consomme du RNG pour les dés (block,
dodge, pass, armor) et le RNG sim-engine est déjà entamé par
`selectMoveForActiveTeam` (IA) — pas resynchronisable proprement.
Stocker les states évite tout boilerplate de mock RNG. Tradeoff :
payload plus lourd (~50-150 KB compressé), acceptable.

[compress.ts](../packages/sim-engine/src/replay/compress.ts) — nouveau
wrapper de payload :

- Format **legacy** (array `MatchEvent[]`) : émis quand `fullReplay`
  est absent (hybrid driver / pré-3.D.1). Lecture rétro-compatible.
- Format **wrapper** (`{ v, events, fullReplay }`) : émis quand
  `fullReplay` présent. `compressReplay` choisit auto.
- `decompressEvents` accepte les deux formats (extrait `events`).
- `decompressReplay` retourne `{ events, fullReplay? }`.

[pro-league-sim-runner.ts](../apps/server/src/services/pro-league-sim-runner.ts)
appelle `compressReplay({ events, fullReplay })` au lieu de
`compressEvents(events)`.

## Lot 3.D.2 — endpoint full-replay

[pro-league-replay.ts](../apps/server/src/services/pro-league-replay.ts)
expose `getMatchFullReplayDump(matchId)` qui retourne :

```ts
{
  matchId, status, durationMs,
  initialState: GameState,
  moves: Move[],
  states: GameState[],
  teams: {
    home: { id, slug, name, city, race, primaryColor, secondaryColor } | null,
    away: ...
  }
}
```

Erreurs typées :

- `MATCH_NOT_FOUND` (404) — match inconnu
- `MATCH_NOT_REPLAYABLE` (409) — status ≠ completed
- `REPLAY_NOT_FOUND` (404) — replay absent
- `FULL_REPLAY_NOT_AVAILABLE` (404) — hybrid driver / pré-3.D.1

Route exposée :
[pro-league.ts:1494](../apps/server/src/routes/pro-league.ts) — `GET
/pro-league/matches/:id/full-replay`.

## Lot 3.D.3 — hook `useFullReplay`

[use-full-replay.ts](../apps/web/app/lib/use-full-replay.ts) — state
machine browser qui :

1. Charge `/pro-league/matches/:id/full-replay`
2. Réutilise `useReplayClock` pour le temps (play/pause/speed/seek)
3. Traduit `currentMs` en `currentMoveIndex` via division entière
   (`MS_PER_MOVE = 1000` = aligné sur `MS_PER_ACTION` du sim-engine)
4. Expose `currentState = states[currentMoveIndex]` (ou `initialState`
   si index = -1)
5. Ajoute `stepForward` / `stepBackward` pour navigation manuelle
6. Remonte `errorCode = 'FULL_REPLAY_NOT_AVAILABLE'` pour fallback UI

## Lot 3.D.4 — vue terrain + toggle

[FullReplayField.tsx](../apps/web/app/pro-league/matches/[id]/replay/FullReplayField.tsx)
— composant qui rend `<GameBoardWithDugouts state={currentState} />`
avec contrôles : play/pause, ⟲ restart, ← prev / next →, ⤓
skip-to-end, vitesse 0.5/1/2/4/8×, scrub bar, header score + clock +
move counter.

[MatchReplayPlayer.tsx](../apps/web/app/pro-league/matches/[id]/replay/MatchReplayPlayer.tsx)
ajoute un toggle **Classique / Terrain** (`role="tablist"`). La vue
"Terrain" charge `<FullReplayField>` (dynamic, no-SSR pour Pixi). Si
le serveur retourne 404 (`FULL_REPLAY_NOT_AVAILABLE`), le toggle
affiche un message d'indispo et propose de revenir en vue classique.

## Lot 3.D.5 — branding ProTeam (couleurs + race)

Le `getTeamColors` du game-engine attend un `rosterSlug` (`skaven`,
`dwarf`, …) qui ne matche pas le slug ProTeam (`sf-gold-rush`,
`chi-iron-bears`).

[FullReplayField.tsx](../apps/web/app/pro-league/matches/[id]/replay/FullReplayField.tsx)
résout via 2 mécanismes :

1. **Priorité** : `teamColorOverrides` rempli depuis
   `ProTeam.primaryColor` + `secondaryColor` (hex string converti en
   `0xRRGGBB`). Respecte le branding NFL-inspired de chaque équipe.
2. **Fallback** : `teamRosters` rempli depuis `raceToRosterSlug(team.race)`
   (`"Wood Elf" → "wood_elf"`). Garantit qu'on a toujours une couleur
   de race par défaut si `primaryColor` est null.

Les deux props sont passés à `<GameBoardWithDugouts>` ;
`team-color-resolver.ts` côté `@bb/ui` choisit override > rosterSlug
> default.

## Bump engineVer

`0.20.0 → 0.21.0`. Les replays produits par le full driver portent
désormais le wrapper `{ v: 1, events, fullReplay }` au lieu de
l'array `MatchEvent[]` direct. Les replays legacy restent décodables
via `decompressEvents` (auto-détection de format).

Saison locale en DB bumpée à `0.21.0` pour permettre la
re-simulation.

## Tests

| Suite | Avant | Après | Δ |
|---|---|---|---|
| shared-types | 13 | 13 | 0 |
| sim-engine | 385 | 403 | +18 (compress + driver + simulate-match) |
| apps/server | 2785 | 2790 | +5 (full-replay endpoint) |
| apps/web | 1145 | 1150 | +5 (useFullReplay) |

**Total : 4356 / 4356 verts.** Aucune régression.

## Utilisation

Pour voir un test match full driver en mode terrain :

1. Sur [/admin/sim/test-match](https://web.nuffle-arena.orb.local/admin/sim/test-match),
   créer ou re-simuler un match avec `driverKind: "full"`.
2. Aller sur `/pro-league/matches/:id/replay` (auto-redirige depuis le
   `/live` ou la page hub car les test matches passent direct à
   `status='completed'`).
3. Cliquer sur l'onglet **Terrain** en haut à droite.
4. Le terrain Pixi se charge avec les vrais joueurs, leurs positions,
   et le ball carrier mis en évidence. Contrôles play/pause/scrub
   identiques à `/play`.

## Reste à faire (suite naturelle)

- **Highlight du joueur actif** : l'event `PLAYER_ACTIVATION` est
  émis (Lot 3.A.3) mais pas encore consommé visuellement. Avec
  `currentMove` exposé par `useFullReplay`, on peut surligner le
  joueur du move en cours sur le terrain.
- **Annotations on-pitch** : flèches de mouvement, halo block/dodge,
  popup "PASS x → y range short" sur l'animation.
- **Speed/quality tuning** : 1 move/s peut être lent pour un match
  complet (~100s). Skip auto des moves "vides" (PLAYER_ACTIVATION
  sans changement de pos) pour densifier.
- **AI tuning vs FUMBBL** : maintenant que le replay est observable
  visuellement, on peut juger qualitativement la qualité tactique de
  l'IA et tuner les `EVAL_WEIGHTS` / opening book.
- **Endpoint narration admin** (déjà mentionné dans Lots 3.A.3/4) :
  vue texte enrichie avec noms réels.
