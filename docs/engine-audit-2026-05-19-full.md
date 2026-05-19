# Audit complet game-engine — 2026-05-19

> Audit consolidé sur 5 dimensions (core / actions / mechanics+skills /
> tests / perf+smells) produit par une équipe de 5 agents Explore en
> parallèle. Donne la liste exhaustive des **bugs potentiels**, **risques**
> et **axes d'amélioration** du game-engine BB online.
>
> Document complémentaire à [ai-audit-2026-05-19.md](./ai-audit-2026-05-19.md)
> (audit IA + skill awareness, plus ciblé). Sert de base pour les sprints
> de remédiation qui suivent.

## Périmètre

- `packages/game-engine/` : core, actions, mechanics, skills, tests
- 5 agents en parallèle, chacun avec un angle dédié
- Citations `file:line` obligatoires

## TL;DR

- **3 bugs critiques** actionnables immédiatement (~2h total)
- **4 bugs hauts** (~3h total)
- **Dette structurelle majeure** : 108 fichiers `.js` shadow + 80% des
  BUG fixes non régressés
- **Risque principal** : shadowing `.js`/`.ts` rend les modifs TS
  invisibles aux tests — déjà rencontré en session précédente (skill
  awareness ignorée)

## 🚨 Bugs critiques

### B1. `handlePostTouchdown()` ne nettoie aucun `pendingX`

**Localisation** : `core/game-state.ts:888-957`

`advanceHalfIfNeeded()` (L619-675) nettoie explicitement 9 champs
`pendingApothecary`, `pendingBlock`, `pendingPushChoice`,
`pendingFollowUpChoice`, etc. `handlePostTouchdown()` n'en clear aucun.

**Scénario** : TD sur un push vers endzone → `pendingPushChoice`
persiste → re-setup pollué → modale UI fantôme.

**Fix** : extraire `clearAllPendingStates(state)` helper et l'appeler
dans les deux endroits + `handleEndTurn`. ~30 min.

### B2. `replay.ts` — `JSON.parse` non gardé

**Localisation** : `core/replay.ts:33-53`

`buildReplayFrames()` accepte string ou object. Si string corrompue →
throw non catché. Aucune validation de schéma post-parse.

**Fix** : wrapper try/catch + Zod schema sur `GameState` au parsing. ~1h.

### B3. Mutation directe d'array dans `handleBlockChoose`

**Localisation** : `actions/choice-handlers.ts:115-119`

```ts
newState.players[attackerIdx].pm = Math.max(0, newState.players[attackerIdx].pm - 1);
```

Mutation indexée d'un players array potentiellement aliasé avec le
state caller. Casse l'immutabilité sur la chaîne BLITZ → BLOCK_CHOOSE.

**Fix** : `newState.players.map(p => p.id === attackerId ? {...p, pm: ...} : p)`. ~10 min.

### B4. Pas d'invariant d'exclusivité mutuelle sur `pendingX`

**Localisation** : `core/types.ts:142-330`

9 champs `pending*` sont tous `?`. Théoriquement deux pending peuvent
coexister, casser le dispatcher.

**Fix** : refacto en discriminated union (`PendingState`). ~4h, mais
élimine une famille entière de bugs futurs.

## ⚠️ Bugs hauts

### H1. `kickoffBlitzTurn` n'interdit pas FOUL

**Localisation** : `actions/actions.ts:161`

Bloque PASS/HANDOFF pendant blitz kickoff mais oublie FOUL. Règle
BB : blitz kickoff = move + block uniquement.

**Fix** : ajouter `|| move.type === 'FOUL'` à la condition. ~5 min.

### H2. Coups silencieusement rejetés sans log

**Localisation** : `actions/blitz-handler.ts:74`, `block-action.ts:115`,
`choice-handlers.ts:168` (~10 sites)

Une validation échoue et retourne `state` inchangé sans
`createLogEntry('error', ...)`. UX confuse côté client.

**Fix** : helper `rejectMove(state, reason)` qui log avant return. ~1h.

### H3. Default case du dispatcher silencieux

**Localisation** : `actions/actions.ts:296`

`default: return checkTouchdowns(activeState)` masque les `move.type`
invalides (typo, nouvelle action oubliée).

**Fix** : throw en dev, warn + return state en prod. ~10 min.

### H4. Activation checks séquentiels lisent state pollué

**Localisation** : `actions/actions.ts:193-227`

6 checks de traits négatifs appliqués séquentiellement, chacun pouvant
set `pendingApothecary` ou `isTurnover`. Le check suivant lit cet état
modifié.

**Fix** : documenter l'ordre OU snapshotter et merger.

## ⚠️ Risques (edge cases sous-couverts)

| # | Risque | Source | Impact |
|---|---|---|---|
| R1 | Frenzy chain + turnover → `pendingFrenzyBlock` non clear | `block-action.ts:45-87` | Bloc fantôme tour suivant |
| R2 | `canPlayerMove` vs `canPlayerContinueMoving` divergence sur GFI simplifié | `game-state.ts:1026-1078` | Joueur incohérent entre gardes |
| R3 | `shouldAutoEndTurn` ne fait rien si `state.players` corrompu | `game-state.ts:1236-1250` | Softlock attente END_TURN |
| R4 | Running Pass : `usedRunningPassThisTurn` mal clear | `game-state.ts:1048-1078` | Mouvement bonus accidentel |
| R5 | Negative traits multi : ordre non documenté | `negative-traits.ts` | Comportement non déterministe |
| R6 | `reroll-choose-handler` garde `structuredClone` "defense-in-depth" | `reroll-choose-handler.ts:88-95` | Perf + masque bugs futurs |

## 💡 Axes d'amélioration

### Perf — hot paths

1. **`structuredClone` (25+ sites)** — utilisé dans tous les handlers
   majeurs. Remplacer par copy-on-write sub-objet.
2. **`state.players.filter(...)` répété 139 fois** — patterns
   identiques scattered. Extraire memoized helper
   `getTeamActivePlayers(state, team)`.
3. **`evaluatePosition()` (698 lignes, hot path IA)** — appelée N×M
   fois par scoreMove. Cacher métriques cardinales (ball distance,
   player counts).

### Duplication — quick wins

4. **108 fichiers `.js` mirror de `.ts`** dans `src/` (gitignored mais
   présents localement). Vite résout `.js` avant `.ts` → modif TS n'est
   pas exécutée par Vitest. **Solution** : supprimer + hook bloquant.
5. **Helpers réimplémentés** : `isActive`, `isAdjacent`, `findPlayer`,
   `getAdjacentOpponents` (variantes locales). Canoniser.
6. **`makePlayer` / `baseState`** dupliqués dans ~29 fichiers de test
   → extraire `src/__tests__/helpers/`.

### Tests — gaps

7. **80% des "BUG fix" historiques (82 commentaires) non testés en
   régression** → créer `src/mechanics/regressions.test.ts`.
8. **0 test de match complet IA vs IA scoring** → j'en ai ajouté un
   (`ai-vs-ai-loop.test.ts`), besoin d'extension (turnover cascades,
   GFI chains, multi-block push chains).
9. **0 fuzz / property-based** → introduire fast-check sur invariants.
10. **5-6 tests `.test.js` "sentinelles"** (final-dugout-sync,
    simple-kickoff-test, validate-placement-button) → supprimer.

### Refacto structurant

11. **`game-state.ts` = 1846 lignes** (dispatcher monolithique avec
    50+ helpers inline). Extraire par domaine. Target : <800 lignes.
12. **`negative-traits.ts` = 1086 lignes** → un fichier par trait.
13. **Coverage thresholds** : `functions: 23%` est très bas. La raison
    invoquée "v8 source-map quirk sur actions.ts" est suspecte.

## 📊 Métriques globales

| Métrique | Valeur | Verdict |
|---|---|---|
| Skills BB2020/S3 implémentés | 137/137 (100%) | ✅ |
| Tests game-engine | 5099 tests, 195 fichiers | ✅ |
| Ratio tests/code | 1.47:1 | ✅ |
| `.test.js` non-TS | 19 fichiers | ⚠️ 5-6 du bruit |
| Fichiers `.js` shadow de `.ts` | 108 | 🐞 |
| Commentaires "BUG fix" | 82+ src, 18+ actions, 5 core | ⚠️ |
| BUG fixes testés en régression | 16/82 (19,5%) | 🚨 |
| `structuredClone` | 25+ sites | 🐌 |
| `state.players.filter(...)` patterns | 139 sites | 🔁 |
| `as Record<string, X>` casts | 30+ | 🧹 |
| `@ts-ignore` | 0 | ✅ |
| `.skip` / `.todo` / `xit` | 0 | ✅ |
| Fichiers > 1000 lignes (code, hors data) | 5 | ⚠️ |

## 🎯 Plan d'action priorisé (sprints)

### Sprint Quick Wins (< 1 jour) ✅ COMPLETE

1. ✅ Supprimer 108 `.js` mirror + pre-commit hook bloquant
   ([`scripts/check-no-js-shadow.sh`](../scripts/check-no-js-shadow.sh))
2. ✅ Extraire `clearAllPendingStates(state)` (fix B1)
3. ✅ Ajouter FOUL au filtre `kickoffBlitzTurn` (fix H1)
4. ✅ Fix mutation indexée dans `handleBlockChoose` (fix B3)
5. ✅ Extraire `__tests__/helpers/index.ts` (`makePlayer`, `baseState`)
6. ✅ Supprimer 6 tests sentinelles bruit (1210 lignes)

### Sprint Stabilité (2-3 jours) ✅ COMPLETE

7. ✅ Tolerant replay parsing avec shape guard (fix B2)
8. ✅ Catalog `__tests__/regressions.test.ts` + 5 tests sentinelles
9. ✅ Helper `rejectMove(state, reason)` + 3 sites pilotes en blitz-handler (fix H2)
10. ✅ Garde runtime `assertSinglePending` (fix B4 — refacto type-level
    union differe en session dediee, 574 call sites)

### Sprint Perf (3-5 jours) ✅ COMPLETE

11. ✅ `cloneGameState` drop-in plus rapide que `structuredClone` (ratio
    9-11x sur state initial). 25 sites prod migres. Equivalence
    semantique verifiee par `clone-state.test.ts` (4 assertions).
12. ✅ Hoist des filtres constants dans `getLegalMoves` (`DIRS`,
    `allOpponentsStanding`, `activeTeammates`, `groundedOpponents`).
    22 scans -> 4 scans par appel (cas pire). Cache WeakMap
    `state-cache.ts` pour le hot path IA :
    `getPlayerMap` / `getActiveTeamPlayers` / `getBallCarrier`.
13. ✅ Cache `evaluatePosition(state, team)` par WeakMap pour le path
    sans `weightsOverride`. N coups candidats → 1 calcul du `before`
    au lieu de N. Path avec override conserve la slow path
    (decouplage volontaire, cf. roadmap).

### Sprint Structure (1-2 semaines) — TODO

14. 🏗️ Split `game-state.ts` 1846 → 4 fichiers <500 lignes
15. 🏗️ Split `negative-traits.ts` 1086 → un fichier par trait
16. 🏗️ Refacto injury/apothecary/regen en `processInjuryWithMitigations()`
17. 🧪 Property-based tests (fast-check) sur invariants
18. 🔁 Migrer les 42 autres fichiers test vers `__tests__/helpers/`
19. 🪵 Migrer les ~7 autres silent rejects vers `rejectMove`
20. ⚖️ Refacto `pendingX` → discriminated union `PendingState`

## 📋 Bilan execution sprints (2026-05-19)

Sprints QW + ST executes en autonomie, 10 commits granulaires semantic
sur main avec rebase sur origin/main apres chaque commit. Tests :
5108 verts (etait 5099 au depart, +1210 lignes de bruit supprimees,
+13 tests reels ajoutes net).

Sprint Perf execute en autonomie 2026-05-19, 3 commits sur
`claude/perf-sprint-audit-YWcRU` :
- `perf(game-engine): cache evaluatePosition and team-active scans`
- `perf(game-engine): replace structuredClone with tailored cloneGameState`
- `perf(game-engine): hoist constant filters and DIRS in getLegalMoves`

Tests : 5130 verts (+22 nouveaux pour state-cache + clone-state +
bench). Ratio cloneGameState/structuredClone mesure : 9-11x sur state
initial via `clone-state.bench.test.ts`. AI loop test (200 coups × 3
seeds × 3 niveaux) : ~2.8s (etait ~3.1s baseline).

Commits :
- `docs: add game-engine + AI audit 2026-05-19`
- `test(ai): add IA vs IA decision loop integration test`
- `feat(ai): skill awareness on block knockdown estimation`
- `chore(game-engine): block .js shadow files via check script`
- `fix(game-engine): clear all pendingX on drive transitions`
- `fix(game-engine): forbid FOUL during kickoffBlitzTurn`
- `fix(game-engine): immutable PM update in handleBlockChoose`
- `test(game-engine): extract shared makePlayer/baseState helpers`
- `test(game-engine): remove 6 sentinel .test.js noise files`
- `fix(game-engine): tolerant replay parsing with shape guard`
- `test(game-engine): regression catalog scaffold`
- `feat(game-engine): rejectMove helper for silent move rejections`
- `feat(game-engine): runtime guard for pendingX mutual exclusivity`

Sprint Structure reste a planifier (scope 5-10 jours, hors session
autonomie).

## ✅ Synthèse

Le moteur est en **bonne santé fonctionnelle** (100% skills, 5099 tests
verts) mais accumule de la **dette technique sédimentaire** :

- **3 bugs critiques actionnables immédiatement** (~2h)
- **4 bugs hauts** (~3h)
- **Dette structurelle majeure** (108 `.js` shadow + 80% BUG fixes non
  régressés)

**Risque principal** : le shadowing `.js`/`.ts` est insidieux — il a
déjà causé un bug silencieux (skill awareness ignorée par les tests).
Tant qu'il n'est pas résolu, toute modification TS dans le game-engine
est potentiellement invisible aux tests.

## Méthodologie

5 agents Explore lancés en parallèle, chacun avec un prompt ciblé :

1. **Core state & immutability** — game-state.ts, types.ts,
   pre-match-sequence.ts, replay.ts, inducement-handler.ts, weather
2. **Actions handlers** — actions.ts, legal-moves.ts, blitz, block,
   pass, foul, choice-handlers
3. **Mechanics & skills** — 41 mécaniques BB + skill registry, couverture
   BB2020/S3
4. **Tests quality** — anti-patterns, gaps de couverture, tests
   sentinelles bruit
5. **Perf & code smells** — hot paths, duplication, file size,
   maintenabilité

Chaque agent a produit un rapport ≤ 500 lignes avec citations
`file:line` et sévérité priorisée. Cf. session 2026-05-19.
