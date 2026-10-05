# Tasks — un match complet

Un commit atomique par tâche, tests avec chaque point.

## 1. Moteur : se relever
- [x] 1.1 `Player.prone?` + lecture tolérante des états anciens ; transition
      Stunned → Prone dans `handleEndTurn` ; tests.
- [x] 1.2 Move `STAND_UP` (3 PM, allocation entière si MA < 3, Jump Up
      gratuit) + handler immutable + coups légaux ; tests.
- [ ] 1.3 Rendu `PixiBoard` : Prone et Stunned distincts (pion couché /
      sonné). Non fait dans ce lot : les deux états s'affichent « à terre »
      comme avant (le moteur les distingue déjà par `state === 'stunned'`).

## 2. Moteur : choix obligatoires
- [x] 2.1 `getLegalMoves` : si un `pending*` est posé, seuls les coups de
      résolution (`BLOCK_CHOOSE`, `PUSH_CHOOSE`, `FOLLOW_UP_CHOOSE`,
      `DUMP_OFF_CHOOSE`, `REROLL_CHOOSE`, `APOTHECARY_CHOOSE`) ; tests par
      type de choix.
- [x] 2.2 `scoreMove` des six choix selon le tableau du design ; tests
      (attaquant vs défenseur choisisseur, poussée vers la foule, relance).
- [x] 2.3 `END_TURN` : nettoyage de secours journalisé en `warn` ; test
      « aucun pending après END_TURN » dans `ai-vs-ai-loop.test.ts`.

## 3. Moteur : structure du match
- [x] 3.1 `kickingTeam` posé par `setup()`, `buildGameStateFromRosters` et
      recalculé à la mi-temps ; test 16 `TURN_START` par équipe.
- [x] 3.2 Activation contiguë : filtre de `getLegalMoves` sur le joueur
      sélectionné, `END_PLAYER_TURN` émis par l'IA ; test « un joueur au plus
      une fois par tour, séquence contiguë ».
- [x] 3.3 `ai/kickoff-events-ai.ts` : placements pour Défense solide, Coup
      haut, Vif comme l'éclair, Blitz, résolus via `kickoff-resolution` ;
      tests.

## 4. Sim-engine : orchestration headless
- [x] 4.1 `executeHeadlessDrive` (ex-halftime) appelé après chaque TD ;
      évènements `KICKOFF` + `TURN_START` ; test « terrain jamais vide en
      phase playing ».
- [x] 4.2 `full-driver-kickoff.ts` applique les évènements interactifs.
- [x] 4.3 `full-match.invariants.test.ts` : 100 graines, rosters de 13
      joueurs tirés de `TEAM_ROSTERS`, invariants §3 de l'exploration.
- [x] 4.4 Perf et comparaison sur rosters réels (`perf-baseline.smoke.test`,
      `sim:perf`, `sim:compare`, `engine-comparison.ts` côté serveur) ;
      budget p95 < 5 s.
- [x] 4.5 Bump `ENGINE_VER` (0.27.0), re-snapshot `bench/bench-baseline.json`
      (bench hybride, valeurs inchangées), entrée CHANGELOG 0.27.0 avec un
      rattrapage 0.14 → 0.26 renvoyant aux docs `engine-*.md`.

## 5. Garde-fous jeu en ligne
- [x] 5.1 Suites d'immutabilité et `ai-vs-ai-loop` vertes (5 856 tests
      moteur, 436 sim-engine) ; les garde-fous « blocage à deux dés résolu »
      et « joueur relevé » sont portés par `full-match-lot1.test.ts` (moteur)
      et `full-match.invariants.test.ts` (sim-engine) plutôt que par une
      spec e2e-ui.
- [x] 5.2 Récit de session `docs/roadmap/sessions/` + entrée CLAUDE.md.
