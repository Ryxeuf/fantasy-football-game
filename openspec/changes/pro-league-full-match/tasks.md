# Tasks — un match complet

Un commit atomique par tâche, tests avec chaque point.

## 1. Moteur : se relever
- [ ] 1.1 `Player.prone?` + lecture tolérante des états anciens ; transition
      Stunned → Prone dans `handleEndTurn` ; tests.
- [ ] 1.2 Move `STAND_UP` (3 PM, allocation entière si MA < 3, Jump Up
      gratuit) + handler immutable + coups légaux ; tests.
- [ ] 1.3 Rendu `PixiBoard` : Prone et Stunned distincts (pion couché /
      sonné) ; test de snapshot léger.

## 2. Moteur : choix obligatoires
- [ ] 2.1 `getLegalMoves` : si un `pending*` est posé, seuls les coups de
      résolution (`BLOCK_CHOOSE`, `PUSH_CHOOSE`, `FOLLOW_UP_CHOOSE`,
      `DUMP_OFF_CHOOSE`, `REROLL_CHOOSE`, `APOTHECARY_CHOOSE`) ; tests par
      type de choix.
- [ ] 2.2 `scoreMove` des six choix selon le tableau du design ; tests
      (attaquant vs défenseur choisisseur, poussée vers la foule, relance).
- [ ] 2.3 `END_TURN` : nettoyage de secours journalisé en `warn` ; test
      « aucun pending après END_TURN » dans `ai-vs-ai-loop.test.ts`.

## 3. Moteur : structure du match
- [ ] 3.1 `kickingTeam` posé par `setup()`, `buildGameStateFromRosters` et
      recalculé à la mi-temps ; test 16 `TURN_START` par équipe.
- [ ] 3.2 Activation contiguë : filtre de `getLegalMoves` sur le joueur
      sélectionné, `END_PLAYER_TURN` émis par l'IA ; test « un joueur au plus
      une fois par tour, séquence contiguë ».
- [ ] 3.3 `ai/kickoff-events-ai.ts` : placements pour Défense solide, Coup
      haut, Vif comme l'éclair, Blitz, résolus via `kickoff-resolution` ;
      tests.

## 4. Sim-engine : orchestration headless
- [ ] 4.1 `executeHeadlessDrive` (ex-halftime) appelé après chaque TD ;
      évènements `KICKOFF` + `TURN_START` ; test « terrain jamais vide en
      phase playing ».
- [ ] 4.2 `full-driver-kickoff.ts` applique les évènements interactifs.
- [ ] 4.3 `full-match.invariants.test.ts` : 100 graines, rosters de 13
      joueurs tirés de `TEAM_ROSTERS`, invariants §3 de l'exploration.
- [ ] 4.4 Perf et comparaison sur rosters réels (`perf-baseline.smoke.test`,
      `sim:perf`, `sim:compare`, `engine-comparison.ts` côté serveur) ;
      budget p95 < 5 s.
- [ ] 4.5 Bump `ENGINE_VER`, re-snapshot `bench/bench-baseline.json`,
      CHANGELOG du sim-engine (reprendre l'historique 0.14 → 0.26 en une
      entrée de rattrapage).

## 5. Garde-fous jeu en ligne
- [ ] 5.1 Suites d'immutabilité et `ai-vs-ai-loop` vertes ; spec e2e-ui du
      match d'entraînement contre l'IA vérifiant un blocage à deux dés
      résolu et un joueur relevé.
- [ ] 5.2 Récit de session `docs/roadmap/sessions/` + entrée CLAUDE.md.
