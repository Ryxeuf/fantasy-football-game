# Design — un match complet

## Où vit chaque correction

```
packages/game-engine (règles, partagées avec le jeu en ligne)
  core/types.ts              Player.prone?  — Prone distinct de Stunned
  core/game-state.ts         stunned → prone en fin de tour de l'équipe ;
                             kickingTeam dans setup / builder
  actions/legal-moves.ts     pending* ⇒ seuls les coups de résolution ;
                             STAND_UP ; filtre d'activation contiguë
  actions/stand-up-handler.ts   nouveau Move STAND_UP (3 PM, Jump Up)
  ai/evaluator.ts            scoreMove des choix (BLOCK_CHOOSE, PUSH_CHOOSE,
                             FOLLOW_UP_CHOOSE, REROLL_CHOOSE,
                             APOTHECARY_CHOOSE, DUMP_OFF_CHOOSE)
  ai/kickoff-events-ai.ts    placements IA pour les évènements interactifs

packages/sim-engine (orchestration headless)
  driver/full-driver.ts      post-TD ⇒ executeHeadlessDrive (= mi-temps)
  driver/full-driver-halftime.ts  renommé full-driver-drive.ts : une seule
                             séquence « placement + kickoff » réutilisée
  driver/full-driver-kickoff.ts   applique les évènements interactifs
  driver/full-driver-roster.ts    kickingTeam posé
  driver/full-match.invariants.test.ts   100 graines, rosters 13 joueurs
  perf/, scripts/compare-drivers.ts, scripts/perf-baseline.ts  rosters réels
```

## Décisions

### Les règles vont dans le moteur, pas dans le driver

Se relever, résoudre un blocage, poser `kickingTeam` sont des règles BB : elles
sont corrigées dans `@bb/game-engine`, dont l'entraînement contre l'IA en ligne
profite aussitôt (`apps/server/src/services/ai-turn.ts` passe par les mêmes
`getLegalMoves` / `pickAIMove`). Le driver ne porte que l'orchestration
headless (remise en jeu, kickoff) que le serveur en ligne fait, lui, dans ses
handlers HTTP.

### Prone est un champ additif, l'ancien `stunned` reste lisible

`Player.stunned` reste le booléen « à terre » (lu par 139 sites et par les
états stockés dans `Turn.payload` et `Replay.payload`). Un champ `prone?:
boolean` est ajouté : `stunned && !prone` = sonné (ne peut rien faire),
`stunned && prone` = à terre mais peut se relever. Un état ancien sans `prone`
est lu comme sonné au premier tour puis bascule Prone en fin de tour : aucune
migration, aucun backfill (`prisma/migrations/` est gitignoré). Au tour de
l'équipe, `canPlayerMove` accepte un joueur Prone dont l'activation commence
par `STAND_UP`.

Alternative écartée : un `PlayerState = 'prone' | 'stunned'` dans l'enum
existante (`active | stunned | knocked_out | casualty | sent_off`). L'enum sert
aux zones de dugout et aux compteurs d'effectif ; y ajouter un état « sur le
terrain » aurait touché tous ces lecteurs.

### Un `pending*` ferme la liste des coups légaux

`getLegalMoves` commence par tester les champs `pending*` (dans l'ordre
`assertSinglePending`) et, s'il en trouve un, renvoie uniquement les coups qui
le résolvent. Conséquences : l'IA ne peut plus « contourner » un choix, le jeu
en ligne reçoit la même liste (son UI la filtre déjà par type), et l'invariant
« aucun `pending*` ne survit à un `END_TURN` » devient testable. `END_TURN`
garde son nettoyage de secours, journalisé en `warn`.

Scoring des choix dans `scoreMove`, volontairement simple (le lot 3 les
raffinera avec le plan de drive) :

| Choix | Règle |
|---|---|
| `BLOCK_CHOOSE` (attaquant) | POW > Stumble > Push > Both Down > Skull ; Both Down préféré à Push si l'attaquant a Blocage et pas le défenseur |
| `BLOCK_CHOOSE` (défenseur choisit) | ordre inverse |
| `PUSH_CHOOSE` | vers une case hors terrain si possible, sinon loin du ballon, sinon loin de ses coéquipiers |
| `FOLLOW_UP_CHOOSE` | suivre si le défenseur est à terre ou si l'attaquant quitte une zone de tacle sans entrer dans une nouvelle ; ne pas suivre quand on quitte le porteur |
| `REROLL_CHOOSE` | relancer si une relance reste et si l'action est un blocage, une esquive du porteur ou un ramassage ; jamais pour un GFI de positionnement |
| `APOTHECARY_CHOOSE` | soigner sur mort et blessure durable ; sur Sérieusement blessé seulement si le joueur vaut plus que la médiane de l'équipe |
| `DUMP_OFF_CHOOSE` | remettre au receveur le plus loin des zones de tacle, sinon décliner |

### Une seule séquence « placement + coup d'envoi »

`executeHeadlessHalftime` devient `executeHeadlessDrive(state, rng)` et sert
aux trois entrées : ouverture, mi-temps, après un TD. La différence est l'état
d'entrée (`gamePhase`, `preMatch.phase`), pas la séquence. Les évènements
interactifs de la table 2D6 reçoivent un placement IA minimal (Défense
solide : recentrer 3 joueurs ; Coup haut : rapprocher un receveur ; Vif comme
l'éclair : avancer d'une case ; Blitz : une activation de blocage) via
`ai/kickoff-events-ai.ts`, résolus avec `mechanics/kickoff-resolution.ts` qui
existe déjà.

### Activation contiguë par filtre, pas par nouvelle machine à états

`getLegalMoves` restreint les coups au joueur sélectionné tant que son
activation n'est pas close (déplacement restant ou action en cours). Changer
de joueur passe par `END_PLAYER_TURN` (déjà dans l'union `Move`), que l'IA
émet quand aucun coup du joueur courant n'est positif. Les `playerActions`
existants interdisent déjà une seconde activation.

### Déterminisme et versions

Le full driver garde son RNG unique ; le fork par coup est le lot 2. `ENGINE_VER`
bumpé en mineur, baseline re-snapshotée, saisons de test à recréer (règle
existante du pin par saison).

## Risques

- **Régression du jeu en ligne** : `legal-moves.ts` et `stunned` sont
  partagés. Les suites d'immutabilité et `ai-vs-ai-loop.test.ts` tournent
  avant toute livraison ; un test e2e-ui du match d'entraînement passe en
  garde.
- **Perf** : la remise en jeu post-TD et les activations contiguës allongent
  les matchs (plus d'actions réelles). Budget : p95 < 5 s par match avec
  rosters de 13 joueurs, mesuré par le smoke de perf corrigé.
- **Variance** : plus de TD peut réduire l'écart-type ; le bench le mesure,
  le lot 3 l'ajuste.
