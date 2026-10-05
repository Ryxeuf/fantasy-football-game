# Tasks — le cerveau du coach

Un commit atomique par groupe, tests avec chaque point.

## 1. Moteur (bugs trouvés par le bench)
- [x] 1.1 Ballon : plus de ramassage par le porteur à chaque case ; Les Deux
      Plaqués et la sortie du terrain lâchent le ballon ; `settleLooseBall`
      après chaque coup ; rebond sur un joueur au sol ; réception par tout
      joueur debout ; remise en jeu par le public. Tests.
- [x] 1.2 Soutiens de blocage sans condition de PM ; dernier joueur activé non
      coupé (`shouldAutoEndTurn`). Tests.
- [x] 1.3 Compteur de rounds après un TD, `halfKickingTeam`, engagement de la
      2e mi-temps. Tests.
- [x] 1.4 Exports du moteur pour le coach (modificateurs de passe et de
      réception).

## 2. Coach
- [x] 2.1 `probability.ts` + tests (jets, relances, dés et soutiens du moteur).
- [x] 2.2 `roles.ts`, `personality.ts` + tests.
- [x] 2.3 `drive-plan.ts` : contexte, stratégies (dont `two-turn-score`,
      `safe-hold`, `mark-receivers`, `stall` conditionné), plan collant + tests.
- [x] 2.4 `evaluate.ts` : contexte précalculé, contribution par joueur, cage
      ancrée sur la case visée, mobilité, ligne de touche + tests.
- [x] 2.5 `activation-planner.ts` : cases atteignables, candidats, coût du
      turnover, relance, paris à un dé, libération du porteur + tests.
- [x] 2.6 `coach.ts` : orchestrateur, choix, file d'activation, ordre
      canonique, softmax, momentum, trace + tests.

## 3. Driver et bench
- [x] 3.1 `full-driver.ts` délègue au coach ; `FullDriverOptions.trace` ;
      `MAX_ACTIONS_PER_MATCH` 3000 ; invariants ajustés (kickoffs ≤ 2 + TD).
- [x] 3.2 `runBench({ driverKind })`, baseline `driverKind: 'full'`, 20 matchs
      par duel, tolérance 0,3 ; `ENGINE_VER` 0.29.0 ; CHANGELOG.
- [ ] 3.3 Panel humain (3 à 5 coachs sur 20 replays Terrain) : à tenir par le
      coach, hors de ce lot.

## 4. Suites (calibrage, hors de ce lot)
- [ ] 4.1 Coût de marquage côté défense, tempo loin de l'en-but, course
      après ramassage (porteur : 2-3 cases par tour aujourd'hui).
- [ ] 4.2 Passes et remises (0,1 à 0,5 par match).
- [ ] 4.3 Turnovers des duels agiles (11-12 par match ; référence 6-10).
- [ ] 4.4 Bench nocturne complet (matrice 16 équipes × 200 runs) — lot 5.
