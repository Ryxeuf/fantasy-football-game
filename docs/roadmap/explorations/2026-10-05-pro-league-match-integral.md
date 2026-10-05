# Exploration — Pro League : un match intégral, un coach qui évolue, un replay rejouable sur plateau

> **2026-10-05** — `/opsx:explore`, aucun code applicatif écrit. Suite de la
> session « Pro League » gelée le 2026-06-01
> ([`docs/pro-league-freeze-2026-06-01.md`](../../pro-league-freeze-2026-06-01.md)).
>
> Question de départ (coach) : *« Chaque match de Pro League doit être comme un
> vrai match simulé entre 2 équipes. Comment faire pour que chaque équipe ou
> chaque joueur ait son propre arbre de décision qui évolue en fonction du style
> de jeu de l'équipe et du coach ? Chaque match doit être simulé dans son
> intégralité avec toutes les actions de chaque joueur. On doit pouvoir
> reproduire sur un plateau, et voir sur un terrain dans l'appli, chaque
> mouvement et chaque action de chaque joueur. »*
>
> Méthode : lecture des trois étages (moteur, `@bb/sim-engine`, serveur + web)
> et **mesures** sur `ENGINE_VER = 0.26.0`, full driver, rosters de 13 joueurs
> tirés du catalogue du moteur (scripts jetables, non commités). Les chiffres
> ci-dessous sont donc reproductibles, pas des estimations.

## 1. En deux minutes

Trois quarts de la tuyauterie existent déjà : un **full driver** qui joue sur
le vrai moteur BB (`getLegalMoves` → `pickBestMove2Ply` → `applyMove`), un
**replay « Terrain »** Pixi qui rend le même `<GameBoardWithDugouts>` que
`/play`, un pipeline serveur (cron, `Replay.payload`, SSE) et **15 paramètres
tactiques** par équipe. Mais, mesuré sur de vrais rosters :

| Ce que la demande exige | Ce qu'on a aujourd'hui (0.26.0, full driver) |
|---|---|
| Un match **intégral** | 0,5 TD/match ; **85 % des blocages ne sont jamais résolus** (l'IA ne choisit pas son dé) ; **aucun joueur à terre ne se relève** pendant un drive ; après un TD, le reste de la mi-temps est vide (pas de remise en jeu) ; 25 tours d'équipe joués sur 32 |
| Toutes les actions de **chaque joueur** | 3,9 joueurs activés par tour en moyenne (11 attendus), coups d'une case entremêlés entre joueurs, pas de notion d'activation ni de plan |
| Un arbre de décision par équipe/joueur **qui évolue** | profil tactique figé **dans le code**, rien n'est persisté, rien n'apprend ; 6 des 15 paramètres seulement sont lus par le full driver ; aucun coach, aucune personnalité joueur |
| Rejouable sur **plateau** et sur **terrain** | replay = 400 snapshots complets (1,3 à 1,8 Mo compressé **par match**, 400 fois trop) ; pas de dés dans les évènements, pas de chemin, pas de mise en place ; viewer sans pas-à-pas |

La bonne nouvelle : **ce n'est pas un nouveau moteur**, c'est un moteur à
compléter (règles manquantes côté IA), une IA à restructurer (plan → activation
→ choix) et un replay à passer en *journal d'actions*. Proposition en 5 lots
(§6), dans cet ordre : **match complet → journal rejouable → cerveau du coach →
évolution persistée → exploitation**. Cinq décisions à prendre (§8).

## 2. État des lieux mesuré

### 2.1 Les trois étages

```
┌───────────────────────────────────────────────────────────────────────────┐
│ @bb/game-engine (pur)                                                     │
│   GameState 26×15 · getLegalMoves(state) · applyMove(state, move, rng)    │
│   137 compétences, table de coup d'envoi 2025, blessures, apothicaire…    │
│   ai/ : evaluator (7 termes, argmax 1-ply) · lookahead (2-ply END_TURN)   │
└──────────────▲────────────────────────────────────────────────────────────┘
               │ importé par
┌──────────────┴────────────────────────────────────────────────────────────┐
│ @bb/sim-engine                                                            │
│   hybrid-driver : abstraction 1D (yards), duels 1v1 synthétiques,         │
│                   behavior tree 3 passes + softmax  ← DÉFAUT EN PROD      │
│   full-driver   : vraie partie IA vs IA sur le moteur, poids dérivés du   │
│                   profil, opening book, kickoff + mi-temps headless       │
│   tactics/      : TacticalProfile (15 × [0,100]), race-profiles (16 éq.)  │
│   replay/       : CBOR+gzip {events} ou {v:1, events, fullReplay:states}  │
└──────────────▲────────────────────────────────────────────────────────────┘
               │ simulateMatch(input, { driverKind })
┌──────────────┴────────────────────────────────────────────────────────────┐
│ apps/server  pro-league-sim-runner (cron 10 min, T-24h, SYNCHRONE sur     │
│              l'event loop) → Replay.payload bytea → SSE /stream           │
│              seed = FNV-1a(matchId) · engineVer pinné par saison          │
└──────────────▲────────────────────────────────────────────────────────────┘
               │ GET /pro-league/matches/:id/{replay,full-replay,stream}
┌──────────────┴────────────────────────────────────────────────────────────┐
│ apps/web  /pro-league/matches/[id]/replay : onglet Classique (ticker 1D)  │
│           + onglet Terrain (<GameBoardWithDugouts state={states[i]}/>)    │
│           /live : ticker SSE seul, PAS de terrain                         │
└───────────────────────────────────────────────────────────────────────────┘
```

Points de repère : `packages/sim-engine/src/driver/full-driver.ts:261-540`
(boucle), `full-driver-halftime.ts:44-87` (seule remise en jeu headless),
`packages/game-engine/src/ai/evaluator.ts:41-83` (`EVAL_WEIGHTS`),
`lookahead.ts:94-162`, `apps/server/src/services/pro-league-sim-runner.ts`,
`apps/web/app/pro-league/matches/[id]/replay/FullReplayField.tsx`.

### 2.2 Chiffres (full driver, rosters moteur de 13 joueurs, 10 graines par duel)

| Mesure | Orques vs Elfes sylvains | Skavens vs Nains | Référence FUMBBL |
|---|---|---|---|
| TD / match (les deux équipes) | **0,50** | **0,50** | 3,2 à 4,8 |
| Matchs avec au moins 1 TD | 4 / 10 | 4 / 10 | — |
| Sorties / match | 1,1 | 2,1 | 2,0 à 3,0 |
| Blocages / match | 48 | 31 | — |
| Activations distinctes / match | 80 | 88 | ~250 à 350 |
| Coups moteur / match | 439 | 394 | — |
| Calcul / match | 0,9 s | 0,8 s | — |
| Replay compressé / match | **1,3 Mo** | **0,9 Mo** | doc : « 50-150 Ko » |

Et sur 5 graines Orques vs Elfes sylvains, en regardant chaque coup :

| Ce qui se passe réellement | Mesure |
|---|---|
| Blocages et blitz joués | 228 |
| … laissés **sans choix de dé** (`pendingBlock` non résolu) | **195 (85 %)** |
| … laissés sans direction de poussée | 57 |
| `END_TURN` qui ont effacé un choix en attente | 77 |
| Joueurs mis à terre | 96 |
| … qui se sont relevés **pendant** le drive | **0** |
| … relevés seulement au TD ou à la mi-temps | 51 |
| Tours d'équipe réellement joués (32 attendus) | 25 |
| Fins de tour sur **turnover** / volontaires | 90 / 35 (72 % de turnovers) |
| Joueurs activés par tour d'équipe (moyenne / max) | 3,9 / 10 |
| Snapshots « vides » (terrain déserté après un TD, phase `playing`) | 6 à 11 % des états |

Taille d'un même match selon ce qu'on stocke (gzip JSON) :

| Contenu | Taille |
|---|---|
| 400 snapshots + `gameLog` cumulé dans chacun (format actuel) | 1 770 Ko |
| 400 snapshots sans `gameLog` | 54 Ko |
| **État initial + coups + dés** (journal d'actions) | **4 Ko** |
| Évènements narratifs seuls | 6 Ko |

Sans roster fourni, le full driver retombe sur `setup()` du moteur : **2 contre
2**. C'est ce que mesurent aujourd'hui `sim:perf`, `sim:compare` et le smoke
test de perf — leurs chiffres (« 1-3 s », « ~150 coups ») ne décrivent pas un
vrai match.

### 2.3 Pourquoi un match n'est pas « intégral » aujourd'hui

| Manque | Où | Effet |
|---|---|---|
| Pas de remise en jeu après un TD | `full-driver.ts:449-480` ne traite que `halftime` ; `handlePostTouchdown` renvoie tout le monde en réserve avec `preMatch.phase='setup'` (`game-state.ts:961-1003`) | la fin de la mi-temps est une suite d'`END_TURN` sur un terrain vide ; plafond de fait à 1 TD par mi-temps |
| L'IA n'émet jamais `BLOCK_CHOOSE`, `PUSH_CHOOSE`, `FOLLOW_UP_CHOOSE`, `DUMP_OFF_CHOOSE` | `getLegalMoves` ne génère pas les choix en attente (`actions/legal-moves.ts:83-339`) | un blocage à 2-3 dés ne produit rien ; `END_TURN` efface le choix |
| Aucune action « se relever » (Prone / Stunned non distingués) | `stunned` n'est remis à `false` qu'au TD et à la récupération KO (`game-state.ts:894, 912`) | un joueur plaqué est perdu pour le drive, d'où l'attrition et les tours vides |
| Évènements de coup d'envoi interactifs ignorés (Défense solide, Coup haut, Vif comme l'éclair, Blitz) | `full-driver-kickoff.ts:153-155` | identité des drives appauvrie |
| `kickingTeam` jamais posé en 1re mi-temps | `full-driver-roster.ts:150-155` | 7 tours pour une équipe, choix du botteur de 2e mi-temps faux |
| `REROLL_CHOOSE` / `APOTHECARY_CHOOSE` : les deux options valent −50 | `evaluator.ts:725-726` | on relance toujours, on soigne toujours |
| Coups spéciaux (TTM, Regard hypnotique, Tronçonneuse…) à −50 | idem | jamais joués |
| Pas d'activation : coups d'une case **entremêlés** entre joueurs | `handlePlayerSwitch` ne clôt pas l'activation précédente (`game-state.ts:1309-1326`) | aucune « action de joueur » lisible, impossible à rejouer sur un plateau tel quel |

Ces manques concernent le moteur et son IA, donc aussi le mode **entraînement
contre l'IA** du jeu en ligne (même `pickAIMove`, mêmes `getLegalMoves`).

### 2.4 Ce que l'IA fait réellement

Un seul `argmax` sur la liste plate de **tous** les coups atomiques de tous les
joueurs (`evaluator.ts:736-755`) : un déplacement d'une case, un blocage, une
passe sont comparés entre eux par la différence d'évaluation de position (7
termes pondérés). Le 2-ply ne s'applique qu'à `END_TURN` et ne simule qu'**un**
coup atomique adverse. Pas de plan de drive, pas d'ordre d'activation, pas de
budget de relances, pas de modèle de probabilité d'esquive / GFI / ramassage /
passe (seul le blocage a une espérance, avec Block / Dodge / Tackle / Wrestle /
Dauntless). Le full driver est un argmax **déterministe** : la température
softmax et les stratégies (`cage-build`, `breakaway`, `stall`…) n'existent que
dans le hybride, sur une abstraction en yards.

Conséquence mesurée : 72 % des tours finissent sur un turnover, et une équipe
« joue » 4 joueurs par tour.

### 2.5 Profil tactique : figé, partiel, sans mémoire

- Les 15 paramètres (`bashIndex`, `passingFrequency`, `riskAppetite`,
  `cageAffinity`, `blitzPriority`, `rerollUsage`, `pace`, `foulFrequency`,
  `stallTendency`, `kickReturn`, `screenAffinity`, `breakawayInstinct`,
  `pressingDefense`, `patience`, `gfiTolerance`) sont **codés en dur** par
  équipe dans `race-profiles.ts:56-356`. `ProTeam` n'a pas de colonne
  `tactics` (le commentaire du schéma le dit, l'en-tête de
  `tactical-profile.ts` dit le contraire — il est périmé).
- Le full driver n'en lit que **6**, convertis en multiplicateurs ×0,4-1,6 sur
  11 poids (`tactics/ai-weights.ts:83-128`). `rerollUsage` et `kickReturn`
  n'ont **aucun** lecteur, nulle part.
- `momentum.ts` (chaud / froid en match) n'est jamais relu pendant le match ;
  `player-form.ts` et la colonne `ProTeamRoster.form` ne sont jamais écrits.
- Ce qui évolue vraiment entre deux matchs, c'est le **roster** (PSP,
  compétences apprises, blessures) — et encore : `mapToSimRoster` ne transmet
  que `ma/st/ag/pa/av/skills`, pas les colonnes `*Bonus` / `*Reduction`.

### 2.6 Replay : des photos, pas un journal

Le format `{ v: 1, events, fullReplay: { initialState, moves, states } }`
stocke **un `GameState` complet après chaque coup**, chacun embarquant le
`gameLog` cumulé (d'où le O(n²) et les 1,3-1,8 Mo). Le choix a été fait parce
que « le RNG est entamé par l'IA » (doc 3.D) — or l'IA du full driver ne touche
pas au RNG moteur : c'est un argmax. Rien n'empêche de dériver les états.

Ce qui manque pour rejouer sur un **plateau** : les dés par action (le `BLOCK`
narratif ne porte ni dés ni résultat ; le `gameLog` est tronqué à 200 entrées
à chaque `END_TURN`), la mise en place et le coup d'envoi comme des coups
(aujourd'hui des fonctions hors `Move`, la mi-temps est un faux `END_TURN`),
et une notion d'activation (chemin complet d'un joueur, pas des cases).

### 2.7 Gel et gate

`PRO_LEAGUE_ENABLED=false` coupe crons et routes en prod ; `/admin/sim/**`
(bac à sable, `POST /admin/sim/test-match`) **n'est pas gelé** et la CI tourne
flag ON. Le gate humain de la Phase 0 (C6-C9, 5 testeurs, 50 replays) **n'a
jamais eu lieu** — et les 50 replays étaient des textes du driver hybride. Les
KPI de `future-ideas.md` conditionnent les *extensions* produit (MPG, paris) ;
rendre le moteur crédible n'en dépend pas. Tout ce qui suit se construit et se
teste **sous le gel**.

## 3. « Comme un vrai match » : une définition mesurable

Avant de parler d'IA, fixer les invariants qu'un replay doit respecter, testés
sur 100 graines en CI :

1. **Structure** : 2 mi-temps × 8 tours par équipe ; `kickingTeam` posé ; TD
   → remise en place des deux équipes → coup d'envoi (table 2D6 complète,
   évènements interactifs compris) → reprise.
2. **Activation** : un joueur est activé **au plus une fois** par tour ; son
   action est une séquence contiguë (déplacement, puis blocage / passe /
   agression / remise) ; un seul blitz, une seule passe, une seule remise, une
   seule agression par tour.
3. **Résolution** : aucun `pending*` ne survit à un `END_TURN` ; 100 % des
   blocages choisissent un dé ; poussées et suivis décidés ; les joueurs à
   terre se relèvent (3 PM) ; relances et apothicaire sont des **décisions**.
4. **Statistiques** (bench full driver, pas hybride) : TD 1,5-2,4 par équipe
   selon la race, sorties 0,8-1,7 par équipe, turnovers 3-5 par équipe,
   écart-type TD ≥ 1,4, upset 12-18 % à écart de VE ≥ 200.
5. **Rejouabilité** : `replayMatch(initialState, moves, dice)` reproduit les
   états **bit à bit** ; un replay se lit sur plateau avec sa feuille.

## 4. Architecture cible : le coach, le plan, le joueur

### 4.1 Pas « un arbre par joueur » au sens littéral

Un arbre de décision par joueur, sur un plateau 26×15 avec 22 joueurs, ne peut
pas exprimer ce qui fait un match de BB : la **coordination** (une cage, ce
sont 5 joueurs ; un écran, c'est une ligne). L'arbre qu'on cherche vit à deux
niveaux :

```
            ┌──────────────────────────────────────────────┐
            │  COACH (par équipe) — persona + profil +     │
            │  mémoire : choisit le PLAN du drive          │
            │  cage · percée · stall · écran · pressing …  │
            └───────────────┬──────────────────────────────┘
                            │ plan (formation cible, tempo, budget de risque,
                            │        politique de relance et d'agression)
            ┌───────────────▼──────────────────────────────┐
            │  PLANIFICATEUR DE TOUR — ordonne les          │
            │  ACTIVATIONS (sans dés d'abord, puis blocs    │
            │  2 dés, blitz, ballon, esquives risquées)     │
            └───────────────┬──────────────────────────────┘
                            │ pour chaque joueur, candidats d'activation
            ┌───────────────▼──────────────────────────────┐
            │  JOUEUR — rôle (porteur, blitzer, lanceur,    │
            │  receveur, bloqueur, arrière, agresseur, gros)│
            │  × personnalité × forme : SCORE chaque        │
            │  activation en espérance (P(succès) × gain −  │
            │  P(échec) × coût du turnover)                 │
            └───────────────┬──────────────────────────────┘
                            │ softmax sur les meilleurs candidats
                            │ (température = risque du coach × joueur × score)
            ┌───────────────▼──────────────────────────────┐
            │  CHOIX — dé de blocage, poussée, suivi,       │
            │  relance, apothicaire, coup d'envoi           │
            └───────────────┬──────────────────────────────┘
                            │ Move
            ┌───────────────▼──────────────────────────────┐
            │  MOTEUR — applyMove(state, move, rng_coup)   │
            │  journal : coup + dés                        │
            └──────────────────────────────────────────────┘
```

C'est une *utility AI* pilotée par un plan, pas un arbre codé en dur : le
« style » est un **vecteur de paramètres** qui déforme les scores, et c'est ce
vecteur qui évolue. Un arbre figé ne pourrait pas évoluer sans être réécrit.

### 4.2 Le coach : un plan de drive qui tient

- Entrée : `DriveContext` (possession, position du ballon, tour, score,
  effectifs sur le terrain, relances restantes, météo, écart de VE).
- Sortie : une **stratégie** de la bibliothèque existante du hybride
  (`cage-build`, `breakaway`, `stall`, `defensive-screen`, `blitz-train`,
  `foul-fest`, à compléter par `two-turn-score` et `safe-hold`), tirée par
  softmax dont la température vient de `riskAppetite`, pondérée par le profil.
- **Collante** : choisie au début du drive, ré-évaluée seulement sur
  évènement (turnover, perte d'un joueur clé, tour 6+). Le hybride la retirait
  à chaque « key moment » — c'est la cause documentée de drives illisibles.
- La stratégie fixe : la **formation cible** (cage, écran, colonne), le
  **tempo** (marquer maintenant ou tenir jusqu'au tour 8), le **budget de
  risque** (nombre de jets 3+/4+ acceptés, GFI), la **politique de relance**
  (`rerollUsage`, enfin lu) et d'**agression** (`foulFrequency`).

En défense (le hybride ne la modélise pas : `hasPossession` y est toujours
vrai), le plan choisit entre écran, pressing du porteur, marquage des
receveurs — ce qui donne enfin un sens à `screenAffinity`, `pressingDefense`
et `blitzPriority`.

### 4.3 Le joueur : une activation, pas des cases

Le planificateur génère pour chaque joueur **des activations entières**
(chemin + action finale) et non des coups d'une case :

- **Rôles** dérivés du poste et des compétences (un Trois-quart qui gagne
  *Blocage* devient bloqueur, un receveur avec *Esquive* devient l'option de
  percée) — c'est ainsi que l'évolution du roster change le jeu sans réglage.
- **Modèle de probabilité** de la séquence : esquive, GFI, ramassage, passe,
  réception, blocage (avec compétences, zones de tacle, météo) et **budget de
  relances** ; un candidat vaut `P(succès) × gain − P(échec) × coût` où le coût
  d'un turnover dépend du tour et de la position du ballon.
- **Ordre canonique BB** : actions sans dés → blocages à 2 dés → blitz →
  ballon → esquives risquées en dernier ; un joueur qui échoue tôt ne détruit
  plus le tour.
- **Personnalité** (4-5 traits [0,100] par joueur, dérivés de la graine du
  joueur, lentement modifiés par l'expérience) : `aggression`, `caution`,
  `greed` (veut le ballon), `discipline` (agressions, Solitaire…), `clutch`
  (tours 7-8). **Forme** (chaud / froid) persistée avec décroissance — la
  colonne et le module existent déjà.
- **Variance contrôlée** : softmax sur les K meilleures activations, avec une
  température qui monte quand on est mené tard (le coach « tente »).

### 4.4 Les choix

Chaque `pending*` du moteur devient une décision de l'IA, générée par
`getLegalMoves` : dé de blocage (POW > Stumble > Push selon le plan ;
l'adversaire choisit sur 2 dés défavorables), direction de poussée (vers la
foule, loin du ballon, hors de la cage), suivi (intégrité de la formation),
relance (budget, valeur de l'action), apothicaire (valeur du joueur et de la
blessure), remise (`DUMP_OFF`), évènements de coup d'envoi interactifs.

### 4.5 Déterminisme et variance

Deux flux de RNG forkés depuis la graine du match : `ai` (softmax,
personnalités) et `move-<n>` (dés du coup n). Le résultat d'un coup ne dépend
plus de ce que l'IA a tiré avant lui : **(état initial, coups) suffit à
rejouer**, et la même graine donne le même match (bench, audit, pari).

### 4.6 Le profil qui évolue : trois échelles de temps

| Échelle | Ce qui bouge | Mécanisme | Déjà là ? |
|---|---|---|---|
| Pendant le match | confiance (chaud / froid), pression | `momentum` relu par la température et le budget de risque | module oui, branchement non |
| Entre deux matchs | forme des joueurs, prudence après blessure, rôles via nouvelles compétences | `player-form` persisté (`ProTeamRoster.form`), rôles redérivés | colonne et module oui, écriture non |
| Sur la saison | **le profil du coach** | adaptation bornée et expliquée (ci-dessous) | non |

Règle d'adaptation proposée — **bornée, déterministe, expliquée, rappelée vers
l'identité raciale** :

```
après chaque match, pour chaque drive de l'équipe :
  s = stratégie jouée, o = issue (TD +1 · turnover −1 · fin de mi-temps 0 ·
                                  sortie infligée +0,3 · sortie subie −0,3)
  memoire[s] = (1 − α) · memoire[s] + α · o                     (α = 0,2)

puis pour chaque paramètre p du profil :
  signal = Σ_s influence(p, s) · memoire[s]   (cageAffinity ← cage-build,
                                               breakawayInstinct ← breakaway,
                                               stallTendency ← stall …)
  p ← clamp(p + lr · signal, ancre_p − bande, ancre_p + bande)  (lr 2, bande 15)
  p ← p + (ancre_p − p) · 0,05                                  (rappel)
  journaliser { p, avant, après, raison }                       (Gazette)
```

L'ancre est le profil racial actuel (`race-profiles.ts`) : un coach orque peut
devenir plus patient ou plus joueur, jamais une équipe de passe. Le profil
**utilisé** par un match est **figé dans son replay** (entrée de la sim) : un
replay reste rejouable même après que le coach a changé d'avis. Et chaque
changement a une phrase : « après trois drives en percée perdus sur turnover,
le coach des Soaring Hawks revient à la cage » — matière à Gazette.

À écarter pour l'instant : l'apprentissage libre (self-play sur les poids
d'évaluation) qui gommerait l'identité raciale, et tout appel LLM dans la
boucle de décision (coût, non-déterminisme). Le self-play reste un outil
**hors ligne** pour recalibrer les ancres, sur le bench.

### 4.7 Modèle de données (esquisse)

| Modèle / colonne | Rôle |
|---|---|
| `ProCoach` (1-1 `ProTeam`) : `name`, `philosophy`, `profile Json` (15 params), `anchorProfile Json`, `experience Int` | le persona IA de l'équipe ; seedé depuis `race-profiles`, éditable en admin |
| `ProCoachMemory` (append-only) : `coachId`, `matchId`, `strategy`, `outcome`, `profileBefore`, `profileAfter`, `reason` | l'historique expliqué de l'évolution |
| `ProTeamRoster.form` (existe), `personality Json?` | forme et traits par joueur |
| `Replay` v2 : `{ v: 2, initialState (sans gameLog), moves, dice, coachProfiles, events }` | le journal d'actions ; v1 reste décodable |

Colonnes nullables, seeds *create-if-missing* : `prisma/migrations/` est
gitignoré, pas de backfill (règle du repo).

## 5. Rejouable sur plateau et sur terrain

### 5.1 Le journal d'actions

Un replay v2 = **état initial** (après mise en place, avant le coup d'envoi,
sans `gameLog`) + la liste ordonnée des **coups**, mise en place et coup
d'envoi compris (nouveaux `Move` : `SETUP_PLACE`, `KICKOFF`, `STAND_UP`,
`END_ACTIVATION`), + les **dés** consommés par chaque coup (ou rien, si les dés
viennent du fork `move-<n>` — les stocker reste utile pour l'audit et la
feuille papier). Mesuré : **4 Ko** compressé contre 1,3-1,8 Mo.

### 5.2 Dériver les états

`replayMatch(initialState, moves, dice) → states[]` est pur et rapide
(`applyMove` à ~1 ms, 400 coups). Côté web, `useFullReplay` conserve son
contrat (`states[i]`) mais les calcule localement ; côté serveur, l'endpoint
peut aussi servir des états dérivés à la demande pour le mobile. Un test CI
rejoue 100 graines et compare bit à bit.

### 5.3 La feuille de match papier (procès-verbal)

Chaque activation s'écrit en une ligne lisible sur un plateau physique :

```
H1 T3 — Smashers
  #4 Blitzer Orque · blitz : (12,7)→(14,8) [esquive 3+ : 5 ✓] · bloque #9 Catcher
      2 dés [POW, Push] → POW · armure 8+ : 9 ✓ · blessure : 7 → KO
  #7 Lanceur Orque · déplacement (10,6)→(11,8) · ramassage 3+ : 2 ✗ · relance ✓ 4 ✓
  #1 Troll · Cerveau lent : 1 ✗ (perd son activation)
```

C'est la convergence naturelle de deux briques existantes : le `narrator`
roster-aware et les gabarits PDF des ligues (`apps/web/app/lib/competition-pdf`,
feuille de rencontre de 5 pages). Les coordonnées suivent la convention du
plateau 26×15 du moteur.

### 5.4 Le terrain

- **Pas par activation** (et non par case ou par seconde) ; flèche du chemin
  complet ; dés rendus par `BlockDieIcon` / `D6Icon` (thèmes de dés du coach
  spectateur) ; joueur actif surligné (existe).
- **Live** : le diffuseur envoie des **coups** (et non des évènements narratifs
  avec perte), le client dérive l'état → `/live` gagne enfin un terrain. Le
  `displayAtMs` se cale sur l'activation (3-6 s) et non plus 1 s par case.
- Les défauts repérés en lisant le viewer actuel (ordre des hooks dans
  `MatchReplayPlayer.tsx`, 5 types d'évènements SSE jamais écoutés, double
  chargement du dump) tombent avec la refonte du format.

## 6. Lots proposés

| Lot | Contenu | Tests / gate | Taille |
|---|---|---|---|
| **1 — Un match complet** | remise en jeu après TD ; `STAND_UP` et Prone / Stunned ; choix en attente générés comme coups légaux et décidés (dé, poussée, suivi, relance, apothicaire, remise) ; évènements de coup d'envoi interactifs ; `kickingTeam` ; activation contiguë + `END_ACTIVATION` ; météo | invariants §3.1-3.3 sur 100 graines ; bench full driver (TD, sorties, turnovers) dans la fourchette FUMBBL **ou** écart documenté | ~2-3 sem |
| **2 — Le journal rejouable** | RNG forké par coup ; mise en place et coup d'envoi comme coups ; `Replay` v2 + `replayMatch` ; viewer Terrain pas-à-pas par activation, chemins, dés ; feuille de match papier ; live par coups | rejeu bit à bit 100 graines ; taille < 20 Ko ; v1 encore lisible ; e2e viewer | ~2 sem |
| **3 — Le cerveau du coach** | plan de drive collant (offensif ET défensif), planificateur d'activations, modèle de probabilité + budget de relances, rôles, personnalités, momentum branché, softmax | bench vs FUMBBL par race ; upset ; « lisibilité tactique » notée sur 20 replays Terrain par 3-5 coachs (le panel C6-C9 jamais tenu) | ~3-4 sem |
| **4 — Ça évolue** | `ProCoach` + `ProCoachMemory`, adaptation bornée, forme joueur persistée, profil figé dans le replay, admin coach, fil Gazette « le coach change » | simulation de 3 saisons : dérive bornée, identité raciale conservée, chaque changement expliqué | ~1,5-2 sem |
| **5 — Exploitation** | sims dans un pool de `worker_threads` (plus sur l'event loop) ; cotes sur 50 runs ou estimateur ; bench full driver nocturne ; rétention des replays ; transition `ready → completed` (aucun code ne la fait aujourd'hui) ; décision de dégel | charge : 8 matchs + 400 sims de cotes par semaine en < 10 min CPU ; `/health/pro-league` vert | ~1-2 sem |

Pourquoi cet ordre : sans le lot 1, rien de ce qui suit n'est mesurable (85 %
des blocages ne comptent pas, un TD tue la mi-temps). Le lot 2 vient tout de
suite parce que c'est la demande visible (plateau, terrain) **et** parce que le
journal d'actions est l'outil qui permet de juger l'IA du lot 3 à l'œil. Le lot
4 n'a de sens qu'avec une IA stable à faire évoluer. Un change OpenSpec par lot
(`/opsx:propose`), une branche par lot, commits atomiques.

Le driver **hybride** devient alors un estimateur (cotes, Monte-Carlo) ou
disparaît : deux implémentations des mêmes règles (ses `resolvers/` contre les
`mechanics/` du moteur) ne peuvent que diverger — c'est déjà le cas.

## 7. Performance et exploitation

- Aujourd'hui : 0,8-0,9 s par match à 22 joueurs, avec une IA naïve et le cache
  d'évaluation **désactivé** dès qu'un `weightsOverride` est passé (toujours le
  cas en full driver). Une IA à plan, probabilités et K candidats coûtera
  plausiblement 5 à 30 s par match ; l'ordre de grandeur est à mesurer au lot 3,
  pas à deviner.
- Volume Pro League : 8 matchs par semaine (16 équipes, 15 journées). Même à
  30 s, c'est 4 minutes de CPU par semaine. Le vrai poste, ce sont les **cotes**
  (200 sims par match) : 50 runs suffisent, ou un estimateur calibré sur le
  bench ; et tout cela sort de l'event loop (le cron appelle aujourd'hui
  `simulateMatch` **en synchrone**).
- Bench : le `sim-bench` CI par PR ne peut plus faire 200 runs × 3 duels en
  full driver ; smoke de 20 runs par PR, matrice complète en nocturne.

## 8. Décisions à prendre

| # | Question | Recommandation |
|---|---|---|
| 1 | Un seul driver (full) en prod, hybride relégué aux cotes ou supprimé ? | **Oui** : une seule vérité des règles |
| 2 | Niveau d'évolution : adaptation **bornée et expliquée** (§4.6) ou apprentissage libre ? | bornée ; le self-play reste un outil de calibrage hors ligne |
| 3 | Le coach : persona IA par équipe seulement, ou prévoir dès maintenant l'influence d'un coach humain (consignes, pep talk — backlog MPG) ? | persona IA, avec `ProCoach` comme point d'accroche futur ; rien d'humain avant le gate produit |
| 4 | Replay : dés **enregistrés** dans le journal en plus du RNG forké, ou rejoués seulement ? | enregistrés : audit, feuille papier, lecture sans moteur |
| 5 | Budget de calcul accepté par match et place des sims (worker in-process vs file de jobs) ? | ≤ 30 s, pool de `worker_threads` ; pas de BullMQ tant que 8 matchs/semaine |

## 9. Risques

- **Le moteur lui-même** : les manques §2.3 (relever, choix en attente)
  touchent aussi l'entraînement contre l'IA en ligne ; les corriger change le
  comportement d'une fonctionnalité vivante — tests de régression d'abord.
- **Variance** : une IA compétente tend vers les matchs serrés et prévisibles ;
  la personnalité, la température et Nuffle doivent garder l'écart-type de TD
  ≥ 1,4 (critère C1 de la gate) — mesurer à chaque lot.
- **Taille des lots** : le lot 3 est le plus incertain ; le découper en
  probabilités + activation (3a) puis plan de drive (3b) si le bench ne
  converge pas.
- **Saisons existantes** : `engineVer` pinné par saison ; toute saison de test
  en base devra être recréée (déjà la règle).

## 10. Pointeurs

- Gel : [`docs/pro-league-freeze-2026-06-01.md`](../../pro-league-freeze-2026-06-01.md) ;
  gate Phase 0 : [`docs/roadmap/sprints/pro-league-gate.md`](../sprints/pro-league-gate.md) ;
  sprint d'origine : [`SPRINT-pro-league.md`](../sprints/SPRINT-pro-league.md) ;
  full driver et replay Terrain : [`docs/engine-2026-05-13-lots-3d-full-replay.md`](../../engine-2026-05-13-lots-3d-full-replay.md),
  [`docs/engine-2026-05-13-lots-3e-replay-polish.md`](../../engine-2026-05-13-lots-3e-replay-polish.md) ;
  audits : [`docs/ai-audit-2026-05-19.md`](../../ai-audit-2026-05-19.md),
  [`docs/engine-audit-2026-05-19-full.md`](../../engine-audit-2026-05-19-full.md).
- Code : `packages/sim-engine/src/driver/full-driver*.ts`,
  `packages/sim-engine/src/tactics/*`, `packages/sim-engine/src/ai/*` (hybride),
  `packages/game-engine/src/ai/*`, `packages/game-engine/src/actions/legal-moves.ts`,
  `packages/game-engine/src/core/game-state.ts` (`handlePostTouchdown`),
  `apps/server/src/services/pro-league-sim-runner.ts`,
  `apps/web/app/lib/use-full-replay.ts`,
  `apps/web/app/pro-league/matches/[id]/replay/*`, `packages/ui/src/board/PixiBoard.tsx`.
- Reproduire les mesures : `simulateMatch(input, { driverKind: 'full' })` avec
  `roster` de 13 joueurs construit depuis `TEAM_ROSTERS` du moteur, 10 graines ;
  compter `pendingBlock` après chaque `BLOCK`/`BLITZ`, les transitions
  `stunned → !stunned`, et compresser `{ initialState, moves, dice }`.
