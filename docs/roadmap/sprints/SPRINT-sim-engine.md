# SPRINT Sim Engine — Fondation simulation Blood Bowl

> Statut : **PRIORITE P0** (a demarrer apres SPRINT Ligues v2 / pendant que Ligues v2 termine)
> Duree cible : ~10 semaines (8 sem moteur + 2 sem polish PvE-ready)
> Theme : construire un moteur de simulation Blood Bowl credible (regles
> conformes, IA tactique lisible, variance saine) qui servira de fondation
> pour **tous** les modes de jeu non-PvP : PvE bot, Pro League, tournois auto,
> match resimulables (audit), replays, future couche fantasy.
> Pre-requis : `packages/game-engine` stable. Aucune autre dependance.

## Contexte

Aujourd'hui Nuffle Arena propose **uniquement du PvP synchrone** (matchs joues
en personne). Plusieurs roadmaps produit en dependent (PvE bot, Pro League,
fantasy/mercato future) et **necessitent toutes le meme socle technique** :
un moteur de simulation Blood Bowl capable de jouer un match credible
**sans humain dans la boucle**.

Plutot que de batir ce socle dans le cadre d'un sprint produit (et risquer de
sous-investir sur la qualite du sim au profit du livrable produit), on en
fait un sprint dedie. Objectif :

1. **Conformite regles** — chaque action passe par les resolvers BB existants
   (`packages/game-engine`), aucune approximation tolerable.
2. **Realisme tactique** — un match doit ressembler a du Blood Bowl : Orcs en
   cage, Elfes Sylvains qui passent, Nains qui montent un mur, Skavens en
   gunslinger. Pas du "Excel qui crache un score".
3. **Variance calibree** — assez d'imprevisible pour que les matchs aient du
   sel (upsets, coups d'eclat, drama), pas tellement que le resultat devienne
   roulette pure.
4. **Validation publique** — passe par un panel humain BB experts AVANT
   d'etre exploite par tout sprint produit downstream.

Ce sprint est **bloquant** pour :
- [`SPRINT-pve-bot-mvp.md`](./SPRINT-pve-bot-mvp.md) — vrais joueurs vs IA
  online, **prochaine priorite produit**.
- [`SPRINT-pro-league.md`](./SPRINT-pro-league.md) — championnat virtuel auto
  (differe, depend de la traction PvE).
- Tous les items du backlog
  ([`docs/roadmap/backlog/future-ideas.md`](../backlog/future-ideas.md)) qui
  consomment la sim (Pro League extensions, ligues thematiques, etc.).

## Vision livrable

A la fin de ce sprint, on dispose de :

| Element | Etat livre |
|---------|-----------|
| **Package `packages/sim-engine`** | Driver hybride + resolvers + 16 profils tactiques + variance Nuffle |
| **CLI bench harness** | `pnpm sim:bench` capable de comparer la sim vs dataset reference FUMBBL |
| **CI regression** | Bench automatique sur chaque PR touchant le package |
| **Metriques validees** | Stats moyennes ±10% FUMBBL, variance OK (std dev TD >=1.4, upset rate 12-18%) |
| **Validation humaine** | Panel 5 testeurs BB experts >= 7/10 sur 50 replays |
| **API publique stable** | `simulateMatch(input): SimResult`, `MatchEvent[]`, `TacticalProfile`, gel via `engineVer` |
| **PvE-ready** | Niveaux de difficulte modulables, latence interactive <500ms, personnalites bot variees |

**Gate de sortie** : si la validation humaine note < 6.5/10 sur "lisibilite
tactique" ou si les benchs statistiques devient de >10% des refs FUMBBL,
**le sprint reste ouvert** — on ne libere pas l'API pour les sprints
downstream tant que le gate n'est pas passe.

## Decoupage en lots

| Lot | Theme | Objectif livrable | Estimation |
|-----|-------|-------------------|------------|
| **A** | Architecture core | Package + driver hybride + resolvers + PRNG seede | ~2 sem |
| **B** | IA tactique | Behavior trees + 16 profils + temperature + memoire | ~2 sem |
| **C** | Variance & Nuffle moments | Eye of Nuffle events, momentum, underdog boost | ~1 sem |
| **D** | Bench harness | CLI, dataset FUMBBL, metriques vivacite, CI regression | ~1 sem |
| **E** | Tuning + validation humaine | Boucle iteration profils, replay sampling, panel | ~2 sem |
| **F** | PvE-ready polish | Niveaux difficulte, latence interactive, personnalites bot | ~2 sem |

## Taches

### Lot A — Architecture core (~2 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| A.1 | Nouveau package `packages/sim-engine` | Backend | M | [ ] | Workspace pnpm, build TS, depend de `packages/game-engine` (regles, dices, types). Interface publique : `simulateMatch(input: SimInput): SimResult`. Output : `{result, events: MatchEvent[], summary, casualties[], engineVer}`. |
| A.2 | Driver hybride (drive-level + key moments) | Backend | L | [ ] | Boucle haut niveau : kickoff → drive → resolution turn-by-turn des actions critiques (block, dodge, pass, turnover) via `game-engine` actions. Drives non-critiques resolus en proba (avancement yards + fumble chance). Garde la possibilite de basculer en `full` driver plus tard sans casser les events. |
| A.3 | Format `MatchEvent` typed partage | Types | M | [ ] | `packages/shared-types/match-event.ts` : enum `EventType` (KICKOFF / TURN_START / BLOCK / DODGE / PASS / TD / KO / CASUALTY / TURNOVER / NUFFLE / HALFTIME / END). Champs `displayAtMs` (offset depuis kickoff, utile pour diffusion live future), `seed`, `meta`. Versionne via `engineVer`. |
| A.4 | PRNG seede + injection partout | Backend | M | [ ] | `packages/sim-engine/rng/seeded.ts` (xoroshiro). Banni `Math.random` du package via lint custom (`no-restricted-globals`). Tout consommateur recoit le PRNG en parametre. Permet replay deterministe + audit + reproductibilite tests. |
| A.5 | Resolvers actions BB | Backend | L | [ ] | `resolvers/{block,dodge,pass,pickup,gfi,foul}.ts` consomment `game-engine` rules (skills, modifiers, weather) pour rester strict regle. Output : `{success, newState, events[]}`. Couverture par tests unitaires sur cas typiques + cas edge (skill stack, double-skull, etc.). |
| A.6 | Driver `full` (turn-by-turn complet) — placeholder | Backend | S | [ ] | Stub `drivers/full.ts` exposant la meme interface que `hybrid.ts`, lance `throw new Error("not implemented yet")` pour le moment. Garantit que la migration future ne casse pas le format des events. |

### Lot B — IA tactique (~2 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| B.1 | Behavior tree + patterns library | Backend | XL | [ ] | `ai/strategy/` (cage-build, breakaway, defensive-screen, blitz-train, stall, foul-fest), `ai/tactics/patterns/` (cage-formation, line-grind, pass-route-deep, wedge, screen). 3 passes par tour : evaluer situation → choisir strategie → executer pattern. Garantit coherence narrative des drives. |
| B.2 | Type `TacticalProfile` + schema Zod | Types | S | [ ] | ~15 parametres : bashIndex, passingFrequency, riskAppetite, cageAffinity, blitzPriority, reroll_usage, pace, foulFrequency, stallTendency, kickReturn, etc. Validation Zod cote sim-engine. Profile stocke en JSON par equipe/bot. |
| B.3 | 16 profils raciaux + variantes | Content | L | [ ] | Couvre les races jouables : Orc-bash, Wood Elf-passing, Skaven-gunslinger, Dwarf-tank, Lizardmen-discipline, Dark Elf-agile, Norse-brutal, Undead-grind, Halfling-underdog, etc. Chaque profil = preset + 2-3 variantes (defensive/offensive/balanced) pour donner du choix au bot/coach. |
| B.4 | Memoire partielle d'etat de match (momentum) | Backend | M | [ ] | Forme par joueur : `hot` apres 2+ TD ou 3+ blocks reussis (+1 confiance temporaire), `cold` apres echecs en chaine. Memoire mensuelle visible publiquement. |
| B.5 | Temperature IA (decisions sub-optimales controlees) | Backend | M | [ ] | Au lieu de toujours prendre l'action max-EV, sample sur top-K avec poids dependant du profil (`riskAppetite` + `temperature` parameter). Genere variance entre matchs identiques sur le papier. Critical pour PvE : levier principal des niveaux de difficulte (Lot F.1). |

### Lot C — Variance & Nuffle moments (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| C.1 | Bibliotheque "Eye of Nuffle" events | Content + Backend | M | [ ] | ~25-30 events scriptes avec probabilites : rookie_brilliance (3%), crowd_riot (1%), sudden_inspiration (4%), weather_shift (5%), tantrum_star (2%), banana_skin (2%), bombardier_gone_wild (1%), nemesis_clash (3%), etc. Chacun emet un `MatchEvent` type `NUFFLE` annonce par le ticker / log. |
| C.2 | Hooks injection Nuffle events | Backend | S | [ ] | Le driver hybride invoque le rolleur Nuffle a chaque debut de tour. Effets appliques au state via PRNG seede. Events stockes pour replay et alimentation contenu (Gazette, narration PvE). |
| C.3 | Boost variance underdog (subtil) | Backend | S | [ ] | Si TV gap > 200 ou pre-match win prob < 15%, +10% sur les rolls critiques cote underdog. Non visible utilisateur. Cible : upset rate 12-18% (pas 5%). Toggle on/off pour mode competitif strict (Pro League future) vs decontracte (PvE). |
| C.4 | Streaks/forme cross-match | Backend | S | [ ] | Persiste `PlayerForm` (hot/normal/cold) entre matchs. Decay sur 3 matchs. Stocke dans une table dediee, exploitee par downstream sprints. |

### Lot D — Bench harness (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| D.1 | CLI `pnpm sim:bench` | DevX | M | [ ] | Script `packages/sim-engine/scripts/bench.ts` : `--team=A vs --team=B --runs=10000` simule en parallele worker_threads, sort un rapport stat (TDs/match, casualties, turnovers, win%, std dev, p5/p95). Optionnel `--matrix` pour toutes les races. |
| D.2 | Dataset reference FUMBBL | Data | M | [ ] | Scraper / import statique des stats publiques FUMBBL : winrates par race, casualty rates, TD averages, durees de drive. Stocke en `packages/sim-engine/bench/reference-fumbbl.json` versionne. |
| D.3 | Metriques "vivacite" (variance & outliers) | DevX | S | [ ] | Au-dela des moyennes : std dev, fat-tails (% matchs avec >= 5 TD, >= 4 casualties), upset rate, distribution MVP (Gini coefficient). Cible MVP : std dev TD >= 1.4, upset rate 12-18%, MVP non concentre uniquement sur stars. |
| D.4 | CI regression `sim-bench` | DevX | M | [ ] | `.github/workflows/sim-bench.yml` : sur chaque PR touchant `packages/sim-engine`, run `--runs=5000` vs `bench-baseline.json`. Alerte si deviation > 5% sur metriques cles. Baseline versionne avec `engineVer`. |

### Lot E — Tuning + validation humaine (~2 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| E.1 | Iteration tuning profils | Tuning | XL | [ ] | Boucle : run bench → identifier deltas vs FUMBBL (>10%) → ajuster profils (bashIndex, riskAppetite, etc.) → re-run. Objectif : tous les matchups raciaux dans ±10% du winrate FUMBBL. Documenter ajustements dans `packages/sim-engine/CHANGELOG.md`. |
| E.2 | Replay sampling tool | DevX | M | [ ] | Script `pnpm sim:replay --random=50` qui sort 50 matchs aleatoires en format lisible (txt narratif + lien web Pixi spectate). Pour panel humain. |
| E.3 | Panel BB experts (5 testeurs) | Process | M | [ ] | Recruter 5 testeurs BB experts (FUMBBL veterans, NAF coaches, communaute). Leur fournir 50 replays aleatoires + grille notation 0-10 sur : lisibilite tactique, coherence drives, identite raciale, moments memorables. Cible >= 7/10 moyenne. |
| E.4 | Gate decision documentee | Process | S | [ ] | Document `docs/roadmap/sprints/sim-engine-gate.md` : metriques stat finales, scores humains, deltas residuels, GO/NO-GO motive. Si NO-GO, retour en Lot E.1 avec plan d'amelioration. **Bloquant pour SPRINT-pve-bot-mvp**. |

### Lot F — PvE-ready polish (~2 sem)

> Ces taches sont **specifiquement pour preparer le sprint PvE** mais restent
> dans le sim-engine package : c'est du parametrage / robustesse moteur, pas
> de l'integration produit.

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| F.1 | Niveaux de difficulte | Backend | L | [ ] | API `simulateTurn(state, {difficulty: 'easy' \| 'normal' \| 'hard' \| 'nuffle-wrath', profile})` qui module : temperature (haute en easy → erreurs frequentes), profondeur lookahead (1-3 turns), risk awareness (le bot easy tente des dodges 5+ stupides, hard les evite), priorisation cibles (easy = random, hard = star/ball-carrier). Documente intervalles attendus de winrate humain (easy ~75%, hard ~40%). |
| F.2 | Latence interactive <500ms | Backend | L | [ ] | Profile + optimise le calcul d'un tour bot. Cibles : <200ms en easy/normal, <500ms en hard (avec lookahead). Si depassement, `worker_threads` pour ne pas bloquer event loop, animation "le bot reflechit..." cote client. |
| F.3 | Personnalites bot (saveur PvE) | Content + Backend | M | [ ] | Personnalites distinctes au-dela des profils raciaux : "Borak the Brutal" (orc, focus violence, taunt apres KO), "Silas the Calculator" (lizard, defensif, ne tente jamais > 4+), "Gribbly Grin" (skaven, chaotique, sample temperature haute), etc. ~12 personnalites pour donner de la rejouabilite. Chaque personnalite = preset profil + flavor text. |
| F.4 | API streaming d'events pour PvE | Backend | M | [ ] | Au lieu de `simulateMatch` (full match), exposer `simulateTurn(state)` qui rend juste les actions du tour bot, en async generator. Le client peut afficher les actions une par une avec animations Pixi. Reutilisable plus tard pour broadcaster live (Pro League). |
| F.5 | Tests robustesse / fuzzing | Tests | M | [ ] | 100k matchs random pour detecter crashes, infinite loops, etats incoherents. Coverage des edge cases : pitch invasion, throw rock, timer tour. Bench memory leaks sur 10k iterations. |
| F.6 | Documentation API publique | Docs | S | [ ] | `packages/sim-engine/README.md` : interface, examples, guidelines pour consommateurs (PvE, Pro League future), breaking change policy via `engineVer`. |

## Definition of done

### Globale
- [ ] Package `packages/sim-engine` publie en interne, importable par `apps/server` et `apps/web` (mode replay).
- [ ] API stable : `simulateMatch`, `simulateTurn`, `MatchEvent`, `TacticalProfile`, `engineVer`.
- [ ] Driver hybride operationnel ; `full` driver stub en place pour evolution future.
- [ ] PRNG seede partout, `Math.random` interdit dans le package (lint custom).

### Conformite regles
- [ ] Tests unitaires sur les 6 resolvers BB principaux (block, dodge, pass, pickup, gfi, foul) couvrent >= 90% des cas regles documentes (`extraction_blood_bowl.md`).
- [ ] Cas edge testes : skill stacks (Block + Dodge + Tackle), conditions meteo, special play cards, double-skull, pow!.

### Realisme tactique
- [ ] 16 profils raciaux livres avec variantes.
- [ ] Behavior trees + 3-passes-par-tour fonctionnent.
- [ ] Panel humain (5 testeurs BB experts) note moyenne >= 7/10 sur 50 replays.

### Variance & vivacite
- [ ] Std dev TDs/match >= 1.4.
- [ ] Upset rate 12-18% selon TV gap.
- [ ] >= 1 Nuffle event par match en moyenne.
- [ ] Distribution MVP non concentree uniquement sur stars (Gini < 0.5).

### Performance
- [ ] `simulateMatch` complet en ~2s CPU (driver hybride).
- [ ] `simulateTurn` (un tour bot) en <500ms en hard, <200ms en easy/normal.
- [ ] Pas de fuites memoire sur 10k iterations.

### Validation
- [ ] Bench stat : tous les matchups raciaux dans ±10% du winrate FUMBBL.
- [ ] CI sim-bench passe sur baseline pinnee.
- [ ] Doc gate `sim-engine-gate.md` publiee avec metriques + GO/NO-GO motive.

## Dependances & risques

### Dependances
- **`packages/game-engine` stable** : la sim depend des resolvers actions BB. Aucune evolution breaking pendant ce sprint, ou re-baseline necessaire.
- **Aucune autre dependance** : sprint autonome, ne touche pas `apps/server`, `apps/web`, prisma.

### Risques

- **Realisme tactique insuffisant** (P1, critique) : si le panel humain note <7/10, l'engine perd toute credibilite et tous les sprints downstream sont a risque. **Mitigation** : Lot E (tuning + panel) prevu avec 2 semaines explicites d'iteration, possibilite de boucler sans avancer.
- **Variance trop forte / trop faible** : si favoris perdent 50% du temps = roulette ; si <5% = ennui. **Mitigation** : metriques `upset rate` mesuree explicitement (cible 12-18%), variance pilotable via temperature IA + Nuffle events probas.
- **Drift game-engine ↔ sim-engine** : un patch BB Cyanide / regles GW peut invalider replays. **Mitigation** : `engineVer` strict, replays anciens read-only, freeze des matchs joues.
- **Determinisme casse** : un `Math.random` oublie ou un import non-pur (`Date.now()`) casse les replays et l'audit. **Mitigation** : lint custom `no-restricted-globals`, PRNG injecte partout, tests de reproductibilite (re-simuler 10x un meme match avec meme seed → events identiques).
- **Latence PvE non atteignable** : si lookahead profond fait depasser 500ms, l'experience PvE est cassee. **Mitigation** : `worker_threads` + budget compute fixe en hard, fallback heuristique simple si timeout.
- **Sur-investissement** : 10 sem c'est lourd, risque de bikeshed sur les profils. **Mitigation** : Lot E prevoit gate strict, pas de polish infini.

## Migration / data

- **Aucune migration Prisma** dans ce sprint. C'est purement du code package.
- Seul ajout dans `packages/shared-types` : types `MatchEvent`, `TacticalProfile`, `SimInput`, `SimResult`, `PlayerForm`.

## Ordre de livraison recommande

| PR | Lots | Description | Estim |
|----|------|-------------|-------|
| **PR1** | A.1-A.6 | Sim engine fondation + driver hybride + resolvers + PRNG | ~2 sem |
| **PR2** | B.1-B.5 | Behavior trees + 16 profils + temperature + memoire match | ~2 sem |
| **PR3** | C.1-C.4 | Variance, Nuffle events, underdog boost, streaks | ~1 sem |
| **PR4** | D.1-D.4 | Bench harness + dataset + CI regression | ~1 sem |
| **PR5** | E.1-E.4 | Tuning loop + replay sampling + panel humain + gate doc | ~2 sem |
| **GATE** | — | Decision GO/NO-GO basee sur metriques + panel | — |
| **PR6** | F.1-F.3 | Difficulty levels + latence + personnalites bot | ~1 sem |
| **PR7** | F.4-F.6 | API streaming + fuzzing + docs | ~1 sem |

## Sources

- Audit produit + architecture conduit le 2026-05-05 par 5 agents en parallele
  (game design / paris / paysage concurrentiel / architecture technique /
  moonshots).
- Donnees BB : FUMBBL stats publiques, NAF tournament data, regles officielles
  Saison 2/3 (cf. `extraction_blood_bowl.md`).
- `packages/game-engine/` : resolvers existants block/dodge/pass/foul reutilises.
- Reference sprint produit consommateur : [`SPRINT-pve-bot-mvp.md`](./SPRINT-pve-bot-mvp.md) (deduit de ce sprint).
- Reference sprint produit differe : [`SPRINT-pro-league.md`](./SPRINT-pro-league.md) (depend de ce sprint + retour PvE).
