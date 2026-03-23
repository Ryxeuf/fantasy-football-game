# ROADMAP DONE — BlooBowl (Nuffle Arena)

> Historique complet de tout ce qui a été livré. Version : 1.36.1 — Audit du 2026-03-22.

---

## Phase 1 — Moteur de jeu (100%)

| # | Fonctionnalité | Détail |
|---|---------------|--------|
| 1 | Plateau 26×15 | RNG déterministe Mulberry32, grille complète |
| 2 | Système de mouvement | Orthogonal/diagonal, PM tracking, adjacence |
| 3 | Blocage complet | Dés de bloc, push, follow-up, assists off/def |
| 4 | Système de balle | Pickup, passe, catch, bounce, scatter, touchdowns |
| 5 | Passes 4 portées | Quick/short/long/bomb, précision, interceptions, handoff |
| 6 | Fautes | Assists de faute, jet d'armure, expulsion sur doubles |
| 7 | Blessures | Jets d'armure 2D6, table casualty D16, KO/stun/mort |
| 8 | Jets d'esquive | Modificateurs zones de tacle ([#31]) |
| 9 | Détection turnover | Blocage raté, passe ratée, catch raté, fumble |
| 10 | Blitz | Mouvement + bloc, limite 1/tour, coût PM |
| 11 | Going For It (GFI) | 2+ sur D6, Sure Feet reroll, turnover sur échec |
| 12 | Séquence pré-match | Fan factor, météo, journeymen, inducements, prières à Nuffle, coin toss |
| 13 | Gestion dugout | Réserves, KO, stunned, casualty, sent off, récupération |
| 14 | Team Value Calculator | VE, VEA, trésorerie, coût relances |
| 15 | Rosters S2 & S3 | Toutes les équipes avec positions |
| 16 | Star Players data | Stats, coûts, skills, images, mega stars |
| 17 | 200+ tests unitaires | Couverture complète du moteur |

---

## Phase 2 — Serveur, Auth & Persistance (95%)

| # | Fonctionnalité | Détail |
|---|---------------|--------|
| 1 | Modèles Prisma complets | User, Match, Turn, Team, TeamPlayer, TeamStarPlayer, TeamSelection, LocalMatch, LocalMatchAction, Cup, CupParticipant, Skill, Roster, Position, StarPlayer ([#18]) |
| 2 | Sauvegarde turns | Chaque action → Turn avec gameState JSON ([#19]) |
| 3 | Auth JWT | Register, login, refresh, middleware authUser, bcryptjs |
| 4 | Invitation par token | ShareToken sur LocalMatch, join via lien ([#15]) |
| 5 | Lobby de partie | Acceptation, coin toss, setup phase, ready ([#16]) |
| 6 | Gestion des équipes | CRUD complet, joueurs, star players, calcul valeurs |
| 7 | Local Matches | Création, partage, validation, moves, action logging |
| 8 | Cups/Tournois | Création, inscription, standings, scoring configurable |
| 9 | Admin API | Gestion users, skills, rosters, positions, star players |
| 10 | 12 fichiers de routes | Couverture complète des endpoints |
| 11 | Seed management | Données de base, seeding déterministe |
| 12 | Changement de mot de passe | Validation, gestion d'erreurs ([v1.24]) |
| 13 | Rate limiting auth | express-rate-limit sur /login, /register (5 req/min par IP) |
| 14 | Rate limiting API global | Limite globale 100 req/min par IP, headers standard RateLimit |

---

## Phase 3 — Règles Blood Bowl avancées (100%)

| # | Fonctionnalité | Détail |
|---|---------------|--------|
| 1 | Zones de tacle | Heatmap engine 26×15, intensité par équipe, zones contestées ([#33]) |
| 2 | Compétences modulaires | Architecture plugin SkillEffect : canApply(), getModifiers(), modifyBlockResult(), canReroll(), specialEffect() |
| 3 | 35+ compétences | Block, Dodge, Tackle, Sure Hands, Sure Feet, Guard, Mighty Blow, Dauntless, Frenzy, Jump Up, Stand Firm, Side Step, Dirty Player, Pass, Catch, Thick Skull, Stunty, Wrestle, Fend, Strip Ball, Pro, Break Tackle, Horns, Juggernaut, Sprint, Leader, Grab, Diving Tackle, Diving Catch, Accurate, Strong Arm, Prehensile Tail, Two Heads, Very Long Legs, Big Hand, Extra Arms, Claws, Iron Hard Skin, Pile Driver, Brawler |
| 4 | Effets météo | 12 types raccordés aux mécaniques (Blizzard, Chaleur, Pluie…) |
| 5 | Kickoff events | Table 2D6, 11 événements complets |
| 6 | Probabilités temps réel | Calcul pour moves, blocks, passes, fouls avec risk level |
| 7 | Mode règles allégées | FULL_RULES / SIMPLIFIED_RULES configurable |
| 8 | Arbitre/Validateur | validateMove(), validateGameState(), anti-triche |

---

## Phase 4 — Expérience Web (partie livrée)

| # | Fonctionnalité | Détail |
|---|---------------|--------|
| 1 | Board Pixi.js | Terrain, endzones, lignes, grille, joueurs colorés, balle |
| 2 | Surbrillance moves | Overlay vert cases légales ([#34]) |
| 3 | HUD overlay | Scoreboard, half/turn/team, PM, relances, turnover, TD animation ([#28]) |
| 4 | Système de popups | ActionPicker, BlockChoice, DiceResult, PushChoice, FollowUpChoice |
| 5 | GameLog | Log scrollable, entrées colorées par type |
| 6 | Dugout UI | Zones réserves, KO, stunned, casualty avec compteurs |
| 7 | Star Players catalog | Grille filtrable, recherche, filtres roster/coût/skill |
| 8 | Skills reference | Catégories, bilingue FR/EN, recherche, filtres S2/S3 |
| 9 | Teams management | Listing, filtres tier/ruleset, création/édition |
| 10 | Admin panel | Dashboard stats, CRUD complet, gestion users/cups/matchs |
| 11 | Local Matches UI | Listing, filtres, détails, création, action logging |
| 12 | i18n FR/EN | LanguageContext, translations, switcher, persistance |
| 13 | Dice notifications | Toast system avec icônes de dés |
| 14 | Pré-match UI | Fan Factor, Météo, Journeymen, Inducements |
| 15 | PDF export | Récapitulatif match local avec export jsPDF |
| 16 | SEO partiel | Structured data JSON-LD, métadonnées |
| 17 | Zoom molette board Pixi.js | Wheel zoom vers curseur, clamp 0.5x–3x, boutons +/− ([#41]) |
| 18 | Pan drag board Pixi.js | Middle-click ou Space+drag, pointer capture ([#41]) |
| 19 | Bouton reset zoom/position | Overlay HTML Tailwind, reset scale=1 + origin ([#41]) |
| 20 | Indicateur adversaire en train de jouer | Bandeau vert/jaune dans le HUD selon isMyTurn, animation pulse |

---

## Phase 5 — Multijoueur (partie livrée)

| # | Fonctionnalité | Détail |
|---|---------------|--------|
| 1 | Toast notifications | Dés, actions in-game |
| 2 | Match lobby | Acceptation et setup |
| 3 | Invitation par token | Partage de lien |

---

## Phase 6 — Mobile (partie livrée)

| # | Fonctionnalité | Détail |
|---|---------------|--------|
| 1 | Setup Expo + RN | Configuration de base |
| 2 | Board natif | PixiBoard.native.tsx, rendu minimal |
| 3 | Écran MVP | Mouvement + fin de tour |
| 4 | UI responsive mobile | Layout responsive, initiales joueurs ([v1.31]) |

---

## Infrastructure & DevOps (livré)

| # | Fonctionnalité | Détail |
|---|---------------|--------|
| 1 | Docker + Compose | Containers web, server, PostgreSQL 16 |
| 2 | GitHub Actions CI | Typecheck, lint, build, test sur PR |
| 3 | Deploy automatisé | SSH, health checks, rollback auto |
| 4 | Traefik + SSL | Reverse proxy, Let's Encrypt, nufflearena.fr |
| 5 | Semantic Release | Versioning automatique, CHANGELOG |
| 6 | Turbo monorepo | Build orchestration, caching |
| 7 | Preview Vercel | Déploiements preview sur PR |
| 8 | EAS Build mobile | Pipeline build Expo |
| 9 | Auto-merge | Merge automatique releases |
| 10 | PR template + labeler | Standardisation contributions |
