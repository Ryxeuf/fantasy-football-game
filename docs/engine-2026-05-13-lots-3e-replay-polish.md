# Lots 3.E.1 → 3.E.4 — polish du replay full driver (2026-05-13)

> Suite des Lots 3.D (replay terrain Pixi pour les matches IA-vs-IA),
> ces 4 lots polishent l'expérience de re-jeu : highlight du joueur
> actif, skip des moves filler, annotations on-pitch SVG, et
> narration texte enrichie côté admin.

## Lot 3.E.1 — Highlight du joueur actif

`<GameBoardWithDugouts>` accepte déjà un prop `selectedPlayerId` qui
surligne un joueur sur le terrain Pixi. On l'alimente désormais
depuis le `currentMove` exposé par `useFullReplay` :

[move-active-player.ts](../apps/web/app/lib/move-active-player.ts)
— helper pur `getMoveActivePlayerId(move)` qui extrait l'acteur du
move. Cas particuliers :

- `END_TURN`, `REROLL_CHOOSE`, `APOTHECARY_CHOOSE`,
  `KICKOFF_BLITZ_RESOLVE`, `ON_THE_BALL_DECLINE` → `null` (pas de
  joueur).
- `DUMP_OFF_CHOOSE` → `passerId` (pas `playerId`).
- `KICKOFF_HIGH_KICK` → `playerId` peut être `null`.

[FullReplayField.tsx](../apps/web/app/pro-league/matches/[id]/replay/FullReplayField.tsx)
passe le `selectedPlayerId` au board.

## Lot 3.E.2 — Skip auto des moves vides

Le full driver émet ~1.5× plus de moves "filler" (choix tactiques
sans effet visuel) que de moves visuellement perceptibles. À 1
move/s, un match dure ~150s là où ~60s suffiraient.

[compact-replay.ts](../apps/web/app/lib/compact-replay.ts) :
prédicat `isFillerMove(move)` + `compactReplaySequence(input)` qui
filtre la séquence. Filler types :

```ts
BLOCK_CHOOSE | PUSH_CHOOSE | FOLLOW_UP_CHOOSE |
REROLL_CHOOSE | APOTHECARY_CHOOSE | DUMP_OFF_CHOOSE
```

Le hook `useFullReplay` accepte maintenant `{ compact: boolean }`
(défaut `true`). Quand actif, expose `fillerCount` pour info.

[FullReplayField.tsx](../apps/web/app/pro-league/matches/[id]/replay/FullReplayField.tsx)
ajoute une case à cocher **Compact** dans l'entête. Quand actif, le
compteur "Move N / M" affiche `(+K filler)` en gris pour
visibilité.

## Lot 3.E.3 — Annotations on-pitch

[replay-annotations.ts](../apps/web/app/lib/replay-annotations.ts)
— helper pur `getReplayAnnotations(move, prevState, currState)` qui
retourne une liste typée d'annotations à dessiner sur le terrain :

- `movement` : flèche from→to (MOVE, LEAP, DODGE, ON_THE_BALL_MOVE).
  Pointillé fin pour DODGE, pointillé large pour LEAP.
- `blitz` : flèche from→to + halo cible.
- `block` : halo attaquant + halo(s) cible(s) (BLOCK, MULTI_BLOCK,
  FOUL). FOUL en rouge.
- `pass` : ligne pointillée passeur→cible (PASS, HANDOFF, BOMB_THROW).
  BOMB_THROW en jaune.

[ReplayAnnotationsOverlay.tsx](../apps/web/app/pro-league/matches/[id]/replay/ReplayAnnotationsOverlay.tsx)
— SVG positionné absolument sur `<GameBoardWithDugouts>` avec
`viewBox="0 0 boardH boardW"` qui s'aligne sur la grille BB. Le
mapping `BB(x, y) → SVG(y, x)` reflète la rotation du board
(vertical 15×26).

Couleurs : équipe A en vert (`#22c55e`), équipe B en orange
(`#f97316`).

Le hook `useFullReplay` expose maintenant `previousState`
(state[i-1] ou initialState) — nécessaire aux annotations puisque
les positions d'origine ne sont plus dans `currentState`.

## Lot 3.E.4 — Endpoint narration admin avec noms réels

[pro-league-narration.ts](../apps/server/src/services/pro-league-narration.ts)
— service `getMatchNarration(matchId)` qui :

1. Charge `ProLeagueMatch` (status + scoreHome/Away + nom équipes)
2. Décompresse `Replay.payload` → `events[]`
3. Charge `ProTeamRoster` actif des 2 équipes → `SimRosterPlayer[]`
4. Reconstruit un `SimResult` partiel (events + summary minimal +
   engineVer extrait du KICKOFF event)
5. Appelle `narrateMatch(result, { title, rosters })` du sim-engine

Le narrator résout les `playerId` (qui sont les `ProTeamRoster.id`
Prisma quand le sim a été lancé avec un roster) en format
`Nom (#numero, Position)`.

Erreurs typées :

- `MATCH_NOT_FOUND` (404)
- `MATCH_NOT_REPLAYABLE` (409) — status ≠ completed
- `REPLAY_NOT_FOUND` (404)

Route admin :
[admin-sim.ts](../apps/server/src/routes/admin-sim.ts) — `GET
/admin/sim/matches/:id/narration` (JSON par défaut, `?format=text`
pour `text/plain`).

### Enrichissement du sim-runner

[pro-league-sim-runner.ts](../apps/server/src/services/pro-league-sim-runner.ts)
— `simulateProMatch` charge maintenant aussi le `ProTeamRoster`
actif des 2 équipes et le passe via `SimInput.{home,away}.roster`.

Sans ça, le full driver retombait sur `setup()` minimal et les events
portaient des ids synthétiques (`A1`, `B1`...) — illisibles dans le
narrator. Avec roster, les playerIds = `roster.id` Prisma et toute
la chaîne sim→narrator parle joueur par joueur.

### UI admin

[admin/sim/test-match/page.tsx](../apps/web/app/admin/sim/test-match/page.tsx)
— ajoute un lien **Narration** à côté du bouton Re-simuler pour
chaque test match `completed`. Le lien ouvre le format text dans un
nouvel onglet.

## Fix latéral — `states[]` dans full-replay endpoint

Régression silencieuse du Lot 3.D.2 : le service `getMatchFullReplayDump`
renvoyait `{ initialState, moves, teams }` mais omettait `states[]`,
alors que le client `useFullReplay` en avait besoin pour rendre le
terrain à chaque move. Sans `states[]`, le replay restait figé sur
l'état kickoff. Le wrapper compressé (`compressReplay`) persiste déjà
les states ; il suffisait de les remonter via l'endpoint.

## Tests

| Suite | Avant | Après | Δ |
|---|---|---|---|
| sim-engine | 403 | 403 | 0 |
| apps/server | 1747 | 1747+18 | +18 (narration: 6, replay fix: 1, sim-runner: 11 nouveaux paths roster) |
| apps/web | 1150 | 1173 | +23 (compact-replay: 7, replay-annotations: 9, move-active-player: 5, use-full-replay compact: 2) |

Tous tests verts. Aucune régression.

## Reste à faire (suite naturelle)

- **AI tuning vs FUMBBL** : maintenant que le replay est observable
  pas-à-pas avec noms réels + annotations, on peut juger
  qualitativement les choix tactiques de l'IA et tuner les
  `EVAL_WEIGHTS` / opening book.
- **Heatmap des annotations** : agréger les annotations sur tout un
  match pour visualiser les zones d'activité.
- **Narrator hide-footer option** : la footer "Touchdowns: X" actuelle
  est dérivée d'un summary partiel reconstruit (turnover via filter
  d'events) — moins précis qu'un vrai SimResult. Option à exposer si
  bruit visuel.
