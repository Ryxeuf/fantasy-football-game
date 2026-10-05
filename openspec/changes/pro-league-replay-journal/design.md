# Design — le journal rejouable

## Où vit chaque pièce

```
packages/game-engine
  mechanics/ball.ts            awardTouchdown efface pendingPushChoice /
                               pendingFollowUpChoice (TD par poussée)
  core/game-state.ts           calculateMatchResult copie matchStats au lieu
                               de le muter (fuite vers l'état de l'appelant)

packages/sim-engine (ENGINE_VER 0.28.0)
  replay/journal.ts            ReplayJournal, journalStepRng, extractDiceRecords,
                               replayJournal, journalMoves
  replay/match-sheet.ts        renderMatchSheet (feuille papier, pur)
  replay/compress.ts           wrapper v2 { v, events, journal } ; v1 lisible
  driver/full-driver.ts        flux par pas, journalSteps, result.journal

apps/server
  services/pro-league-sim-runner.ts   compressReplay({ events, journal })
  services/pro-league-replay.ts       fullReplay DÉRIVÉ du journal
  services/pro-league-narration.ts    getMatchSheetText
  routes/admin-sim.ts                 ?format=sheet

apps/web
  lib/replay-activations.ts    débuts d'activation (pur)
  lib/use-full-replay.ts       stepActivationForward / Backward
  pro-league/.../FullReplayField.tsx   boutons activation
```

## Décisions

### Un flux de dés PAR PAS, dérivé de la graine et de l'index

`makeRNG` accepte une chaîne : le pas `n` reçoit `${seed}:move:${n}`. Le
journal n'a donc pas besoin de stocker l'état du RNG, et un coup refusé puis
remplacé par son repli (`END_PLAYER_TURN` / `END_TURN`) est rejoué avec un
flux NEUF de la même clé — exactement ce que `replayJournal` refait. L'IA
(`pickAIMove`, lookahead) consomme son propre flux, qui n'entre pas dans le
journal.

Alternative écartée : stocker les dés et les REJOUER (RNG « enregistré »).
Plus lourd (chaque tirage), et il faudrait un RNG de rejeu distinct dans le
moteur. Les dés sont stockés quand même, mais pour l'audit et la feuille
papier : ils ne pilotent pas le rejeu.

### L'état initial est pris après le coup d'envoi d'ouverture, sans `gameLog`

Le `gameLog` est reconstruit par le moteur au rejeu depuis un log vide ; le
stocker dans l'état initial ferait diverger le rejeu (entrées en double). Les
remises en jeu (mi-temps, après un TD) sont des pas `{ drive: true }` qui
rejouent `executeHeadlessDrive` avec `drive:${n}` — la séquence est
déterministe, elle n'a pas besoin d'être décomposée en coups.

### Les dés sont les entrées `dice` AJOUTÉES par le coup

`extractNewLogEntries(prev, next)` compare par référence : le moteur copie le
tableau et conserve les objets. Robuste à la troncature du log en fin de tour.
Un `DiceRecord` ne garde que `message`, `playerId`, `team`, `details`.

### `fullReplay` est dérivé, le contrat de l'API ne bouge pas

`pro-league-replay.ts` lit `wrapper.journal` et produit `{ initialState,
moves, states }` comme avant : le hook web `useFullReplay`, `compact-replay`
et les annotations n'ont pas changé. Le dump expose en plus `journal`.

### Le piège trouvé : une mutation en place rendait le rejeu non reproductible

`calculateMatchResult` incrémentait `matchStats[...].mvp` EN PLACE. L'IA
(lookahead 2-ply sur `END_TURN`) l'appelait sur un clone partiel ⇒ l'état
réel de l'appelant était modifié, et le rejeu divergeait au pas 496. Copie
profonde + retour explicite de `matchStats`. Règle : toute fonction du moteur
appelée par l'IA en simulation doit être pure, le clone partagé ne protège pas
les sous-objets.

### Un TD par poussée efface le choix de suivi

Avec un flux par pas, la graine 13 (Gold Rush vs Iron Bears) a produit un
porteur repoussé dans l'en-but adverse : `checkTouchdowns` passait en
`post-td` en laissant `pendingFollowUpChoice`, et le `END_TURN` de la remise
en jeu trouvait un choix en attente. Le drive est fini : `awardTouchdown`
efface poussée et suivi.

### Activation = suite contiguë des coups d'un joueur

`activationStarts(moves)` : les coups de choix prolongent l'activation en
cours, `END_TURN` et les coups sans joueur ouvrent un segment à part. Le
« précédent » revient d'abord au début de l'activation courante (piste
précédente). Le module est pur et s'applique à la séquence brute ou compacte.
