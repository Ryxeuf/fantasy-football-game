# Replay & Setup Bug Fixes — 2026-05-18

Cinq bugs identifiés sur la page replay Pro League et la séquence pré-match,
diagnostiqués par une équipe d'agents Explore puis corrigés en suivant les
règles **Blood Bowl 2025 (Saison 3)**.

## 1. Mi-temps : pas de repositionnement (`game-state.ts`)

**Symptôme** : à la 2e mi-temps, les joueurs ne sont pas remis en réserves
pour rejouer la phase de setup, et `legalSetupPositions` est vide → les
coachs ne peuvent rien placer.

**Cause** : `advanceHalfIfNeeded` reconstruit `preMatch` mais code en dur
`legalSetupPositions: []` au lieu d'appeler `computeLegalSetupPositions`,
contrairement à `enterSetupPhase` (pré-match initial) et `handlePostTouchdown`.

**Fix** :
[`packages/game-engine/src/core/game-state.ts`](../packages/game-engine/src/core/game-state.ts) ligne 648 — remplace `legalSetupPositions: []` par
`legalSetupPositions: computeLegalSetupPositions(receivingTeam, newState.height)`.

## 2. Setup non conforme aux règles BB 2025

**Règles BB 2025 (Saison 3)** sur un terrain 26×15 :
- **Line of Scrimmage (LoS)** : 3 joueurs minimum sur la rangée centrale
  (x=12 pour A, x=13 pour B), comptés uniquement sur la zone centrale
  (y∈[4..10]). Un joueur placé en wide zone ne compte PAS pour le minimum LoS.
- **Wide zones** : 4 rangées de chaque côté (y∈[0..3] et [11..14]),
  max 2 joueurs par wide zone.
- **Centre** : 7 rangées (y∈[4..10]).
- Max 11 joueurs sur le terrain.

**Bugs corrigés** :

### 2.a Wide zones tronquées à 3 rangées
[`packages/game-engine/src/core/game-state.ts`](../packages/game-engine/src/core/game-state.ts) lignes 1355-1356 :
`y <= 2` / `y >= 12` → `y <= 3` / `y >= 11`.

### 2.b LoS ne discrimine pas les wide-zoners
La fonction `isOnLos` ne testait que `x`. Un joueur à `(x=12, y=2)` était
compté sur la LoS alors qu'il est en wide zone. Désormais `isOnLos(pos)`
exige aussi `!isInWideZone(pos.y)`.

### 2.c LoS minimum ne supporte pas les équipes réduites
La validation utilisait `minLosRequired = 3` en dur. Quand une équipe a
moins de 3 joueurs disponibles (post-TD avec KO/casualty), c'était
impossible à satisfaire. Désormais `minLosRequired = min(3, targetTotal)`
("autant que possible" selon BB 2025).

### 2.d AI placement (`setup-placement.ts`)
- `LEFT_WIDE_ZONE_ROWS` et `RIGHT_WIDE_ZONE_ROWS` étendus à 4 rangées
  (priorisés depuis la rangée la plus proche du centre).
- `LOS_CENTER_ROWS` et `MIDFIELD_ROWS` restreints au centre (y∈[4..10]),
  retrait des entrées 3 et 11 qui débordaient sur les wide zones et
  contournaient le minimum LoS.

## 3. Terrain visuel coupé en largeur (`PixiBoard.tsx`)

**Symptôme** : sur la page replay, le terrain n'affiche qu'une portion étroite
et les joueurs sont serrés à gauche.

**Cause** : le container du Stage Pixi était capé à `max-w-[480px]` et la
prop `cellSize` par défaut à 28 (→ largeur max 15×28 = 420px), trop
serré pour une lecture confortable du terrain.

**Fix** :
[`packages/ui/src/board/PixiBoard.tsx`](../packages/ui/src/board/PixiBoard.tsx) :
- `cellSize` par défaut 28 → 36.
- `max-w-[480px]` → `max-w-[600px]` (laisse la place pour cs=40 si l'écran le permet).

Le calcul responsive existant (`maxCellSize = floor(containerWidth / 15)`)
était correct ; c'est le cap supérieur (`min(maxCellSize, cellSize)`) qui
plafonnait trop bas.

## 4. Désynchronisation log textuel ↔ terrain visuel

**Symptôme** : sur la page replay, avancer d'un move décalait soit le texte
soit le visuel mais pas les deux ensemble. Conséquence visible : un joueur
semble "tenter une passe sans avoir le ballon" car le visuel et le texte
montrent des moves différents.

**Cause** : deux instances **indépendantes** de `useReplayClock` :
- `MatchReplayPlayer` créait son propre clock pour piloter `visibleEvents`
  (filtrés par `displayAtMs <= currentMs`).
- `useFullReplay` (consommé par `FullReplayField`) en créait un autre pour
  piloter `currentMoveIndex = floor(currentMs / 1000) - 1`.

Aggravation par le mode **compact** : il retirait les moves "filler"
(`BLOCK_CHOOSE`, `PUSH_CHOOSE`, etc.) de la séquence visuelle sans réaligner
les `displayAtMs` des events textuels — désync garantie.

**Fix** :
- [`apps/web/app/lib/use-full-replay.ts`](../apps/web/app/lib/use-full-replay.ts) :
  nouvelle option `externalClock` qui remplace le clock interne quand fournie.
  Si `externalClock` est défini, `compact` est forcé à `false` pour préserver
  l'alignement 1 move = 1000ms = 1 event group.
- [`apps/web/app/pro-league/matches/[id]/replay/FullReplayField.tsx`](../apps/web/app/pro-league/matches/[id]/replay/FullReplayField.tsx) :
  nouvelle prop `externalClock` propagée à `useFullReplay`. Les contrôles
  internes (scrub bar, play/pause, restart, step, speed, compact toggle)
  sont masqués quand un clock externe est fourni — le parent fournit déjà
  ces contrôles.
- [`apps/web/app/pro-league/matches/[id]/replay/MatchReplayPlayer.tsx`](../apps/web/app/pro-league/matches/[id]/replay/MatchReplayPlayer.tsx) :
  passe son `clock` à `FullReplayField` via la prop `externalClock`.

## 5. "PASS sans ballon" (Bug 3 initial) — résolu indirectement

**Verdict** : pas de bug moteur. Les checks `hasBall` sont en place :
- [`packages/game-engine/src/actions/legal-moves.ts`](../packages/game-engine/src/actions/legal-moves.ts) ligne 216 : `if (p.hasBall && ...)` avant de proposer PASS.
- [`packages/game-engine/src/actions/pass-actions.ts`](../packages/game-engine/src/actions/pass-actions.ts) ligne 66 : `if (!passer.hasBall) return state`.

L'evaluator IA a aussi été audité — les signes (sign=1 pour allié, sign=-1
pour adversaire) sont cohérents pour les trois branches (allié du porteur,
défenseur, course au pickup).

Le scénario observé "YJ recule dans son endzone puis tente une passe sans
le ballon" est un **artefact d'affichage** du bug 4 (désync) : le terrain
affichait la position de YJ après son `MOVE` (repli défensif) tandis que
le log textuel montrait `XW.PASS` (le vrai porteur) ou un move décalé.
Avec le clock partagé (fix 4), les deux vues affichent désormais le même move.

À reverifier en UI après déploiement.

## Notes BB 2025

Les règles BB 2025 / Saison 3 sur le setup et la LoS sont identiques à
BB 2020 sur ces points (la Saison 3 modifie principalement les Star Players,
certains niveaux d'expérience et les compétences disponibles, pas la
géométrie du terrain).
