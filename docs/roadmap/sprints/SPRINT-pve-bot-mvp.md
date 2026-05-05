# SPRINT PvE Bot MVP — Vrais joueurs vs IA online

> Statut : **PRIORITE P1** (a demarrer apres GATE de SPRINT-sim-engine)
> Duree cible : ~4 semaines
> Theme : permettre a tout joueur connecte de lancer un match contre une IA
> en ligne, avec niveaux de difficulte et personnalites bot. Mode killer
> pour l'onboarding, l'entrainement, et la disponibilite 24/7.
> Pre-requis : [`SPRINT-sim-engine.md`](./SPRINT-sim-engine.md) **livre et
> gate passe** (>= 7/10 panel humain). Les Lots F.1-F.4 (difficulty levels +
> personnalites + API streaming) sont specifiquement bloquants.

## Contexte

Aujourd'hui Nuffle Arena propose **uniquement du PvP synchrone**. Trois
problemes structurels en decoulent :

1. **Onboarding brutal** : un nouveau coach doit jouer son premier match
   contre un humain experimente, prend 3 raclees, abandonne. Blood Bowl a une
   courbe d'apprentissage tres pentue (regles, dices, skills, tactique).
2. **Disponibilite limitee** : les joueurs doivent attendre / chercher un
   adversaire. Sur une base utilisateurs jeune, les fenetres de jeu sont
   rares, surtout aux horaires non-pic.
3. **Pas d'entrainement structure** : impossible de tester une nouvelle
   tactique, un nouveau roster, un build pre-tournoi sans risquer son ELO.

Le **SPRINT-sim-engine** delivre la fondation (moteur credible, IA tactique
lisible, niveaux de difficulte). Ce sprint **integre cette IA dans le flow
PvP existant** pour offrir l'option "jouer contre un bot".

**Why now** : c'est le sprint qui **maximise le retour sur investissement
sim-engine** (validation en production par milliers de matchs reels) et
**ameliore la retention nouveaux joueurs** (effet onboarding standard sur
Hearthstone, Magic Arena, Slay the Spire).

## Vision livrable

A la fin de ce sprint, un utilisateur peut :

1. Cliquer sur "Match d'entrainement vs IA" depuis le hub matchmaking.
2. Choisir une **difficulte** (Easy / Normal / Hard / Nuffle's Wrath).
3. Choisir une **personnalite bot** (12 personnalites distinctes, chaque liee
   a une race et un style tactique).
4. Selectionner sa propre equipe (rosters existants, pas de restrictions
   particulieres).
5. Lancer le match dans le **flow PvP existant** (Pixi, Boardgame.io) — l'IA
   joue le role de l'adversaire, transparent pour le moteur de match.
6. Voir les actions du bot s'enchainer avec animation "le bot reflechit..."
   < 500ms.
7. Consulter un **historique de matchs PvE** dedie sur son profil (sans
   impact sur l'ELO PvP).
8. Acceder a un **mode tutorial** progressif (4-5 matchs scenarises Easy →
   Hard) pour les nouveaux coachs.

## Decoupage en lots

| Lot | Theme | Objectif livrable | Estimation |
|-----|-------|-------------------|------------|
| **A** | Integration sim-engine ↔ match flow | Bot consomme `simulateTurn` dans `apps/server` boardgame.io | ~1 sem |
| **B** | UI selection PvE + tutorial | Page selection difficulte/perso, tutorial progressif | ~1 sem |
| **C** | Persistance & profil | Historique PvE, stats coach (sans ELO PvP), achievements onboarding | ~0.5 sem |
| **D** | QA & beta fermee | Tests E2E, beta 30 testeurs, tuning difficulty | ~1 sem |
| **E** | Polish & go-live | Animations attente, narration bot, marketing page | ~0.5 sem |

## Taches

### Lot A — Integration sim-engine ↔ match flow (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| A.1 | Service `pve-bot-player.ts` | Backend | L | [ ] | Service serveur qui implemente le role "joueur 2" dans Boardgame.io quand le match est de type PvE. A chaque tour adverse, appelle `simEngine.simulateTurn(state, {difficulty, profile})` et applique les actions retournees au state du match via les memes mutations que les actions humaines. Garantit qu'aucune triche IA n'est possible (utilise les memes APIs que les humains). |
| A.2 | Type de match `PvE` dans Prisma | DB | S | [ ] | Ajout enum `MatchType {PVP, PVE}` sur `Match` (default PVP). Champ `Match.opponentBotProfile` JSON. Migration. |
| A.3 | Endpoint `POST /matches/pve/start` | API | M | [ ] | Body : `{ teamId, difficulty, opponentProfileId }`. Cree le match avec `MatchType=PVE`, side B = bot (no userId), persiste le `opponentBotProfile`. Retourne le match URL. |
| A.4 | Boardgame.io : adapter le pairing | Backend | M | [ ] | Quand un joueur connecte un match PvE, le serveur enregistre automatiquement un "fake player 2" controle par `pve-bot-player.ts`. Pas de matchmaking, pas de lobby, demarrage immediat. Reutilise les mecaniques timer / turn-based existantes. |
| A.5 | Animation "le bot reflechit..." | Frontend | S | [ ] | Pendant que le serveur calcule le tour bot (max 500ms cible, mais peut deborder en hard), afficher un overlay Pixi non-bloquant. Si > 1s, ajouter un mini-flavor "Borak hesite entre deux options...". |
| A.6 | Tests integration match PvE | Tests | M | [ ] | Test : creer match PvE → simuler 16 tours alternes (humain mock + bot reel) → verifier coherence state, pas de crash, pas de blocage. Couvre les 4 niveaux de difficulte. |

### Lot B — UI selection PvE + tutorial (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| B.1 | Page `/play/pve` (hub PvE) | Frontend | M | [ ] | Liste des 12 personnalites bot avec portrait, race, citation, style tactique. Selection difficulte (4 niveaux). Selection equipe joueur (rosters existants). Bouton "Lancer le match". |
| B.2 | Composant `<DifficultySelector/>` | Frontend | S | [ ] | 4 niveaux avec description claire : "Easy : le bot fait des erreurs evidentes" / "Hard : le bot anticipe et joue serieusement". Indicateur visuel attendu winrate humain (75% / 60% / 45% / 30%). |
| B.3 | Composant `<BotPersonalityCard/>` | Frontend | M | [ ] | Affiche personnalite : nom, portrait, race, "Borak the Brutal — Orcs — Bash player who taunts after every KO". Cliquable pour lock le choix. |
| B.4 | Mode tutorial 4 matchs scenarises | Frontend + Backend | L | [ ] | Pour les nouveaux coachs (`User.firstLogin || coachLevel < 5`) : sequence de 4 matchs guides — Tutorial 1 (Easy, mecaniques de base, mini-tooltips), 2 (Easy, dodge/pass), 3 (Normal, gestion turnover), 4 (Normal, casualties). Chaque match a un objectif (marquer 1 TD, faire 1 cas, etc.) et une recap. Nouveau modele `TutorialProgress {userId, step, completedAt}`. |
| B.5 | CTA proeminent "Match d'entrainement" sur `/dashboard` | Frontend | S | [ ] | Bouton visible sur le dashboard utilisateur : "Tu attends un adversaire ? Lance un match d'entrainement vs IA en 1 clic". Filtre context : visible si pas de match actif. |
| B.6 | Onboarding hint dans `/teams/new` | Frontend | S | [ ] | Apres creation d'une 1ere equipe, suggestion "Teste ton equipe contre Borak (Easy) avant ton premier vrai match". Lien vers `/play/pve` pre-rempli. |

### Lot C — Persistance & profil (~0.5 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| C.1 | Stats PvE separees de PvP | Backend + DB | M | [ ] | Ajouter `CoachStats.pveWins`, `pveLosses`, `pveDraws`, `pveByDifficulty {easy: {w,l,d}, ...}`. **Pas d'impact sur ELO PvP** (`Coach.elo` n'est jamais touche par un match PvE). |
| C.2 | Section "Historique PvE" sur `/coach/[slug]` | Frontend | S | [ ] | Onglet ou section dediee : liste des matchs PvE recents, breakdown par difficulte, par personnalite affrontee, score cumule. |
| C.3 | Achievements onboarding | Backend + Content | M | [ ] | Catalogue de 8-10 achievements PvE : "Premier match d'entrainement", "Bat Easy en 3 matchs", "Bat Hard pour la 1ere fois", "Bat les 12 personnalites", "Survis a Nuffle's Wrath", "Tuto complet", etc. Notification debloquage + badge profil. Reutilise infra badges existante (S26.5 Achievements). |
| C.4 | Anti-farm: limite raisonnable | Backend | S | [ ] | Pour eviter farm intensif (ex: bot qui exploit un pattern), limiter nombre de matchs PvE actifs simultanes a 3, et achievements PvE pour la rejouabilite uniquement (pas de gain Crowns/cosmetiques significatif). Cap journalier 20 matchs PvE comptabilises. |

### Lot D — QA & beta fermee (~1 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| D.1 | Tests E2E Playwright "match PvE complet" | Tests | M | [ ] | Scenario : login → /play/pve → choisir difficulty + perso + team → match s'ouvre → 16 tours s'enchainent → resultat affiche → historique PvE mis a jour. Tester les 4 niveaux. |
| D.2 | Tests E2E "tutorial complet" | Tests | M | [ ] | Login nouveau user → guide 4 matchs → achievements debloques → flag tutorial completed. |
| D.3 | Beta fermee 30 testeurs | Process | M | [ ] | Recrutement Discord + nouveaux inscrits (cible : moitie veterans BB, moitie debutants). 2 semaines de tests. Feedback structure : winrate auto-mesure, NPS, qualitative IA. |
| D.4 | Tuning difficulty post-beta | Tuning | M | [ ] | Si winrate humain Easy > 85% (trop facile) ou Hard < 25% (trop dur), ajuster temperature IA. Si winrate Easy bot trop bas (les bots Easy ne perdent jamais alors qu'ils devraient), revoir profile. Cible finale : Easy 75%, Normal 60%, Hard 45%, Nuffle's Wrath 30% pour un coach moyen. |
| D.5 | Stress test latence | DevOps | S | [ ] | Verifier que le serveur tient 50 matchs PvE concurrents sans degradation latence. Profile CPU/RAM. |

### Lot E — Polish & go-live (~0.5 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| E.1 | Narration bot (taunts post-action) | Content + Frontend | S | [ ] | Chaque personnalite a 5-10 phrases declenchees sur events : "Borak after KO: 'Smash 'em flat!'", "Silas after dodge fail: 'Probability has betrayed me'". Affichees dans un coin du screen, non-bloquant. Cosmetique mais ajoute saveur. |
| E.2 | Page marketing `/play/pve/about` | Marketing | S | [ ] | Pitch : "Joue contre l'IA pour t'entrainer 24/7, decouvre 12 personnalites, 4 niveaux de difficulte." SEO, OG image, video courte (asset Pixi). |
| E.3 | Analytics events | DevX | S | [ ] | Plausible/PostHog : `pve_match_started`, `pve_match_completed`, `pve_difficulty_chosen`, `tutorial_step_completed`, `pve_achievement_unlocked`. Permet de mesurer onboarding success. |
| E.4 | Annonce communautaire | Marketing | S | [ ] | Post Discord, Reddit r/bloodbowl, X/Twitter. Demo video (1 match Hard accelere). |

## Definition of done

- [ ] Un utilisateur peut lancer un match PvE depuis `/play/pve` en < 30 secondes.
- [ ] Les 4 niveaux de difficulte donnent des winrates humains conformes a la cible (±5%) sur la beta.
- [ ] 12 personnalites bot distinctes jouables.
- [ ] Tutorial 4 matchs accessible aux nouveaux coachs, completion taggee dans `TutorialProgress`.
- [ ] Pas d'impact sur ELO PvP : un match PvE ne touche jamais `Coach.elo`.
- [ ] Historique PvE consultable sur `/coach/[slug]`, separe du PvP.
- [ ] >= 8 achievements PvE deployes.
- [ ] Tests E2E "match PvE complet" + "tutorial complet" passent.
- [ ] Beta fermee 30 testeurs validee (NPS >= 35, winrate par difficulte dans cible ±5%).
- [ ] Latence bot mesuree : <200ms easy/normal, <500ms hard, <800ms nuffle's wrath p95.
- [ ] Annonce communautaire postee, page marketing en ligne.

## Dependances & risques

### Dependances
- **`SPRINT-sim-engine.md` livre et gate passe** (>= 7/10 panel humain). Lots F.1-F.4 du sim-engine sont specifiquement bloquants : difficulty levels, personnalites, latence interactive, API streaming.
- **`packages/game-engine` stable** (transitif via sim-engine).
- **Boardgame.io existant** : architecture turn-based actuelle reutilisee. Si refonte boardgame.io en cours en parallele, coordonner.
- **Infrastructure achievements (S26.5)** : reutilisee pour les achievements PvE.

### Risques

- **Difficulty hard mal calibree** : si Hard est en realite plus facile que Normal (mauvais tuning lookahead), l'experience est cassee. **Mitigation** : Lot D.4 prevu pour tuning post-beta, metriques winrate par niveau trackees.
- **Latence bot bloquante** : un tour bot qui prend 5s en hard = experience nulle. **Mitigation** : `worker_threads` + budget compute fixe, fallback heuristique simple si timeout, animation d'attente.
- **Boardgame.io ne supporte pas bien le mode "fake player"** : potentiel hack si l'archi attend deux connexions humaines. **Mitigation** : Lot A.1/A.4 prevoient cette integration, prototyper en debut de sprint avant de scoper le reste.
- **Tutorial qui frustre les veterans** : un veteran qui doit subir 4 matchs Easy avant de jouer un Hard = mauvais signal. **Mitigation** : `Skip tutorial` button toujours visible, gate sur `coachLevel` strict (uniquement si nouveau).
- **Bot qui repete les memes patterns** : les utilisateurs decouvrent un exploit (ex: "Borak fonce toujours sur le ball-carrier") et le farm. **Mitigation** : temperature non-zero sur tous les niveaux (meme hard a 0.1), 12 personnalites pour varier, retour en sim-engine si pattern detecte.
- **PvE prend toute l'attention au detriment du PvP** : si 90% des matchs deviennent PvE, l'ecosysteme PvP s'etiole. **Mitigation** : monitoring des ratios PvE/PvP, eventuellement ajouter incitations PvP (XP boostee, rewards) si trop de bascule.

## Migration / data

- 1 migration Prisma : `MatchType` enum, `Match.opponentBotProfile` JSON, `CoachStats.pve*` champs, `TutorialProgress` table, `Achievement` rows pour catalog PvE.
- **Pas de retro-actif** : les matchs existants sont automatiquement `MatchType=PVP`.
- Seeder etendu : ajouter 12 `BotProfile` rows (presets avec personnalite + niveau de base).

## Ordre de livraison recommande

| PR | Lots | Description | Estim |
|----|------|-------------|-------|
| **PR1** | A.1-A.6 | Integration sim-engine ↔ Boardgame.io + endpoint creation match PvE | ~1 sem |
| **PR2** | B.1-B.3, B.5, B.6 | UI selection PvE (page hub, components, CTA dashboard) | ~0.5 sem |
| **PR3** | B.4 | Tutorial 4 matchs scenarises | ~0.5 sem |
| **PR4** | C.1-C.4 | Stats / historique / achievements / anti-farm | ~0.5 sem |
| **PR5** | D.1-D.5 | E2E + beta fermee + tuning difficulty | ~1 sem |
| **PR6** | E.1-E.4 | Polish + marketing + analytics + annonce | ~0.5 sem |
| **GO-LIVE** | — | Deploiement public PvE | — |

## KPI de succes (3 mois post-launch)

- **Adoption** : >= 60% des nouveaux inscrits lancent au moins 1 match PvE.
- **Onboarding** : >= 50% des nouveaux completent le tutorial 4 matchs.
- **Retention J7** : nouveaux ayant joue >= 3 PvE retiennent a J7 a 1.5x le taux des non-utilisateurs PvE.
- **Conversion PvE → PvP** : >= 30% des utilisateurs PvE actifs jouent un PvP dans les 30j.
- **Difficulty distribution** : <50% restent uniquement en Easy (signe d'engagement progressif).
- **NPS PvE** : >= 35.

Si KPI atteints, on **declenche** le SPRINT-pro-league. Sinon on itere sur le PvE (variantes, nouvelles personnalites, tournois solo) avant d'investir sur la Pro League.

## Sources

- Audit produit + brainstorm conduit le 2026-05-05.
- [`SPRINT-sim-engine.md`](./SPRINT-sim-engine.md) : sprint amont bloquant.
- Inspirations onboarding : Hearthstone (mode Practice), Magic Arena (Sparky bot), Slay the Spire (Daily Climbs).
- Architecture Boardgame.io existante (`apps/server/src/boardgame/`).
- Infrastructure achievements (S26.5 livree).
