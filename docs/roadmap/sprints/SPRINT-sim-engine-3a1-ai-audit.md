# Lot 3.A.1 — Audit AI game-engine pour auto-play full driver

> Statut : **fait** (2026-05-07)
> Branche : `claude/lot-3a1-ai-audit`
> Référence : [SPRINT-sim-engine-observability.md](./SPRINT-sim-engine-observability.md)

## Question

> L'IA actuelle dans `packages/game-engine/src/ai/` est-elle suffisamment
> mature pour de l'auto-play déterministe IA-vs-IA destiné à produire des
> matchs Pro League roster-aware ?

## Findings

### Ce qui existe ✅

**Decision API** (`evaluator.ts` + `difficulty.ts`) :
- `pickBestMove(state, team) → Move | null` : choix glouton du coup au plus haut score d'évaluation
- `pickAIMove(state, team, { difficulty, rng }) → Move | null` : variante avec niveaux easy/medium/hard, taux de timidité (skip d'agressif), taux de blunder
- `evaluatePosition(state, team) → { total, breakdown }` : score scalaire pondéré sur 7 dimensions (score, possession, ball progress, player count, carrier safety, attrition, positioning)
- `scoreMove(state, move, team) → number` : score estimé d'un coup légal

**Pondérations actuelles** (`EVAL_WEIGHTS`) :
- `TOUCHDOWN: 1000`
- `POSSESSION: 300`
- `BALL_PROGRESS_PER_STEP: 15`
- `PLAYER_ACTIVE: 30`, `STUNNED_PENALTY: 15`, `KO_PENALTY: 40`
- `PLAYER_CASUALTY_PENALTY: 150`, `SENT_OFF_PENALTY: 120`
- `CARRIER_PROTECTION_ALLY: 20`, `CARRIER_TACKLEZONE_PENALTY: 35`
- `CARRIER_IN_ENDZONE_BONUS: 250`
- `POSITIONING_PER_STEP: 2`, `END_TURN_PENALTY: 1`

**Game machinery** (`actions/actions.ts`) :
- `getLegalMoves(state) → Move[]` : énumère les coups légaux pour le tour courant
- `applyMove(state, move, rng) → GameState` : applique un coup et retourne le nouveau state (immutable)
- 26 types de Move couvrent toute la mécanique BB (BLOCK, BLITZ, PASS, FOUL, MOVE, DODGE, GFI implicite via MOVE, kickoff results, dump-off, multi-block, leap, throw teammate, secret weapons, etc.)

**Auto-placement / kickoff** (`setup-placement.ts`, `kickoff-placement.ts`) :
- `autoSetupAITeam` : place les 11 joueurs IA pendant la phase setup
- `pickAIKickoffBallPosition` : choisit où la balle de kickoff atterrit côté IA

### Gaps identifiés ⚠️

**1. Pas de helper "lance un match complet IA-vs-IA"**

Aucune fonction `playFullMatch(teamA, teamB, seed) → MatchResult` n'existe. Le mode interactif joueur-vs-IA fonctionne, mais l'orchestration "deux IAs jouent l'une contre l'autre du kickoff à la fin du match 2" passe aujourd'hui par les sockets multiplayer + le serveur Express, pas par une fonction pure.

**Implication Lot 3.A.2** : il faut écrire un orchestrateur headless qui :
- Initialise un GameState complet (deux rosters, kickoff, etc.)
- Boucle `pickAIMove → applyMove` pour les deux équipes
- Gère les transitions de phase (kickoff → drive → halftime → drive → END)
- Termine sur un score final avec stats matchSummary

**2. Évaluation purement greedy 1-ply**

L'IA score chaque Move individuellement et joue le meilleur. Aucune simulation multi-coup, aucune planification de drive. C'est suffisant pour un adversaire IA contre un humain au niveau débutant, **insuffisant pour produire des stats FUMBBL-conformes** :

- Pas de planification de cage (le joueur cage 1 case mais pas la séquence)
- Pas de protection de drive sur 2-3 tours
- Pas de timing du score (stall → score au tour 8)

**Implication Lot 3.A.1.b** (à valider en mesurant) : l'auto-play actuel devrait produire des matchs faiblement scorés (TD/match potentiellement < 1.0) faute de drive coherence. À benchmarker une fois Lot 3.A.2 livré.

**3. Aucun benchmark IA-vs-IA existant**

Le bench sim-engine actuel (`packages/sim-engine/src/bench/`) tourne sur le **hybrid driver** (synthèse archétype). Il ne pilote PAS l'IA game-engine. Il n'existe pas de benchmark "lance N matchs full driver, agrège TDs/cas/winrate".

**Implication Lot 3.A.2** : le harness `runFullDriver` produira directement des `SimResult` consommables par le bench harness existant (drop-in remplaçable de `runHybridDriver`).

**4. Pas d'API "obtenir le profil tactique par équipe"**

Le hybrid driver utilise les `tactics: TacticalProfile` (bashIndex, pace, breakawayInstinct…) pour orienter ses rolls. L'IA game-engine ne consomme pas ce profil — elle utilise uniquement `EVAL_WEIGHTS` constants pour toutes les équipes.

**Implication Lot 3.A.2 / 3.A.3** : pour préserver la signature raciale (Halflings ≠ Wood Elves ≠ Orcs) en full driver, il faudra soit :
- a) Wrapper l'AI avec un mécanisme qui module `EVAL_WEIGHTS` selon le profil (Halflings perdent vite donc poids `PLAYER_CASUALTY_PENALTY` plus élevé, etc.)
- b) Composer plusieurs `AIDifficultyProfile` mappés sur les races (Halflings = "easy" forcé, élites = "hard")

Option (b) est plus simple à implémenter en MVP.

**5. Pas de gestion des scenarios bizarres**

Cas qu'aucun test ne couvre actuellement :
- Match où une équipe perd 4+ joueurs au tour 1 (impossibilité physique de continuer ?)
- Boucles potentielles si `pickAIMove` retourne toujours la même séquence END_TURN → END_TURN
- Stack overflow sur scénarios pathologiques

**Implication Lot 3.A.2** : ajouter un `MAX_TURNS_PER_HALF`, un `MAX_ACTIONS_PER_TURN`, et une détection de "no-progress" qui force un `END_TURN` si l'IA n'avance plus depuis N tours.

## Recommandations

### Decision : feu vert conditionnel pour Phase 3

L'IA actuelle est **suffisante pour un MVP full driver** sous trois conditions :

1. **Lot 3.A.2 doit ajouter un orchestrateur** qui boucle `pickAIMove + applyMove` jusqu'à fin de match, avec garde-fous (timeout, no-progress detection)
2. **Lot 3.A.3 doit benchmarker** le full driver vs FUMBBL avant de promouvoir une saison en `driverKind='full'`. Si la drift dépasse 15%, tuner les `EVAL_WEIGHTS` ou bumper la sophistication de l'AI (search 2-ply, opening book, etc.)
3. **Lot 3.A.4 doit câbler le profil tactique** dans le scoring, sinon toutes les races vont produire des stats indiscernables

### Estimation effort total Phase 3

| Lot | Estimation pré-audit | Estimation post-audit | Δ |
|---|---|---|---|
| 3.A.2 (runFullDriver) | XL (~1 sem) | **XL (~1.5 sem)** | + setup/kickoff full implementation |
| 3.A.3 (mapping events) | L (~3-4 j) | **L (~3-4 j)** | unchanged |
| 3.A.4 (roster-aware) | M (~2 j) | **L (~3-4 j)** | + tactical profile binding |

Effort total Lot 3.A : **~3 semaines** au lieu des **~3 sem** initialement estimées (la complexité de 3.A.4 monte mais 3.A.2 reste le bottleneck identifié).

### Sous-projet IA possible (si benchmark Lot 3.A.3 montre une drift > 15%)

Backlog optionnel à activer post-MVP :
- 2-ply search (Minimax depth=2 sur les 5 meilleurs coups)
- Opening book par race (ex: Wood Elves passent toujours T2-T3, Orcs cage T1-T2)
- Drive planner (séquence de 3-4 actions verrouillée jusqu'à bouton stop)
- Tactical profile dynamic weights (au lieu de constants)

## Verdict

**🟢 Feu vert pour Lot 3.A.2** avec les garde-fous documentés. La drift sera mesurée en Lot 3.A.3 et déclenchera (ou pas) le sous-projet IA optionnel ci-dessus.

Pas de blocker dur. L'AI existante peut produire des matchs jouables ; reste à valider la qualité statistique vs FUMBBL.
