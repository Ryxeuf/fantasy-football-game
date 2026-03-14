# 📋 ROADMAP - BlooBowl Fantasy Football Game

> Roadmap complète du projet [fantasy-football-game](https://github.com/Ryxeuf/fantasy-football-game), organisée en 7 phases progressives.
> Dernière mise à jour : 2026-03-14

---

## 📊 Audit global — État d'avancement

### Résumé par domaine

| Domaine | Avancement | Détail |
|---------|-----------|--------|
| **Moteur de jeu (Engine)** | 🟢 ~80% | Mouvement, blocage, passes, fautes, blessures, blitz, turnover, pré-match, dugout — tous fonctionnels. Manque : GFI, compétences avancées, effets météo |
| **Serveur (API/DB)** | 🟢 ~95% | Auth JWT, CRUD complet, turns, matchs, cups, star players, admin, local matches — tout implémenté |
| **Web (Next.js)** | 🟡 ~75% | Board Pixi.js, popups, HUD, Star Players, Skills, Teams, Admin, i18n, Local Matches — OK. Manque : zoom/pan, animations, heatmap, replayer |
| **Mobile (Expo)** | 🔴 ~10% | MVP minimal : 1 écran avec board + end turn. Pas de login, lobby, zoom, notifications |
| **Notifications** | 🔴 ~15% | Toast/dice notifications in-game seulement. Pas de push, permissions, préférences |
| **Données statiques** | 🟢 ~95% | Rosters S2/S3, positions, skills FR/EN, star players avec images — complet |

---

## Phase 1 — Fondations & Moteur de jeu ✅ COMPLÈTE (95%)

> _Objectif : moteur de jeu déterministe fonctionnel avec toutes les mécaniques de base._

### ✅ Réalisé

- [x] **Plateau 26×15** avec RNG déterministe (Mulberry32)
- [x] **Système de mouvement** — déplacement orthogonal/diagonal, PM tracking, adjacence
- [x] **Blocage complet** — dés de bloc, push, follow-up, assists offensifs/défensifs
- [x] **Système de balle** — pickup, passe, catch, bounce, scatter, touchdowns
- [x] **Passes** — 4 portées (quick/short/long/bomb), précision, interceptions
- [x] **Fautes** — assists de faute, jet d'armure, expulsion sur doubles
- [x] **Blessures** — jets d'armure (2D6), blessures, table de casualty (D16), KO, stun, mort
- [x] **[#31](https://github.com/Ryxeuf/fantasy-football-game/issues/31)** Jets d'esquive avec modificateurs ✅
- [x] **Détection de turnover** — tous les cas (blocage raté, passe ratée, catch raté, fumble)
- [x] **Blitz** — mouvement + bloc, limite 1/tour, coût PM
- [x] **Séquence pré-match** — fan factor, météo, journeymen, inducements, prières à Nuffle, coin toss
- [x] **Gestion du dugout** — réserves, KO, stunned, casualty, sent off, récupération KO
- [x] **Team Value Calculator** — VE, VEA, trésorerie, coût relances
- [x] **Rosters Season 2 & Season 3** — toutes les équipes avec positions
- [x] **Star Players** — données complètes (stats, coûts, skills, images, mega stars)
- [x] **161+ tests** passants

### ⚠️ Manques identifiés (reportés en Phase 3)

- [ ] **Going For It (GFI)** — mécanisme non implémenté (Sure Feet existe mais pas de GFI)
- [ ] **Effets météo en jeu** — tables définies mais pas raccordées aux mécaniques
- [ ] **Compétences avancées** — seulement 7/100+ ont des effets mécaniques (Block, Dodge, Tackle, Sure Hands, Sure Feet, Guard, Mighty Blow)

---

## Phase 2 — Serveur, Auth & Persistance ✅ COMPLÈTE (95%)

> _Objectif : backend complet avec auth, persistance, matchmaking et admin._

### ✅ Réalisé

- [x] **[#18](https://github.com/Ryxeuf/fantasy-football-game/issues/18)** Modèles Prisma complets — User, Match, Turn, Team, TeamPlayer, TeamStarPlayer, TeamSelection, LocalMatch, LocalMatchAction, Cup, CupParticipant, Skill, Roster, Position, StarPlayer ✅
- [x] **[#19](https://github.com/Ryxeuf/fantasy-football-game/issues/19)** Sauvegarde des turns — chaque action crée un Turn avec gameState JSON, endpoint list ✅
- [x] **Auth JWT** — register (avec validation admin), login, refresh, middleware authUser
- [x] **[#15](https://github.com/Ryxeuf/fantasy-football-game/issues/15)** Liens d'invitation — shareToken sur LocalMatch, join via token ✅
- [x] **[#16](https://github.com/Ryxeuf/fantasy-football-game/issues/16)** Lobby de partie — acceptation par turns, coin toss, setup phase, ready status ✅
- [x] **Gestion des équipes** — CRUD complet, joueurs, star players, calcul valeurs
- [x] **Local Matches** — création, partage, validation, moves, action logging détaillé
- [x] **Cups/Tournois** — création, inscription, standings, scoring configurable
- [x] **Admin API** — gestion users, skills, rosters, positions, star players
- [x] **12 fichiers de routes** couvrant tous les endpoints

### ⚠️ Manques identifiés (reportés en Phase 5)

- [ ] **WebSocket/SSE temps réel** — actuellement polling uniquement
- [ ] **Rate limiting & throttling** — pas de protection contre l'abus
- [ ] **Logs structurés & monitoring** — pas de logging centralisé

---

## Phase 3 — Règles Blood Bowl avancées 🔶 EN COURS (40%)

> _Objectif : compléter les règles manquantes pour un jeu fidèle au Blood Bowl._

### ✅ Réalisé

- [x] Zones de tacle fonctionnelles — malus calculés pour dodge, pickup, passe, catch, interception
- [x] 7 compétences avec effets mécaniques (Block, Dodge, Tackle, Sure Hands, Sure Feet, Guard, Mighty Blow)

### 🔲 À implémenter

- [ ] **[#33](https://github.com/Ryxeuf/fantasy-football-game/issues/33)** Zones de tacle — visualisation heatmap + influence complète
- [ ] **[#32](https://github.com/Ryxeuf/fantasy-football-game/issues/32)** Compétences de base (2-3) — Esquive/Blocage affichage icônes/tooltip
- [ ] **Going For It (GFI)** — 2 cases supplémentaires avec jet 2+ (D6), turnover sur échec
- [ ] **Effets météo en jeu** — raccorder les 12 types météo aux mécaniques (ex: Blizzard -1 passe, Chaleur accablante → épuisement)
- [ ] **Kickoff events** — table de kickoff complète (8 résultats : Get the Ref, Riot, Perfect Defence, High Kick, Cheering Fans, Brilliant Coaching, Changing Weather, Quick Snap)

#### 💡 Améliorations proposées (innovantes)

- [ ] **Système de compétences modulaire** — architecture plugin pour ajouter facilement de nouvelles compétences sans modifier le code existant. Chaque skill = un fichier avec `canApply()`, `apply()`, `description`
- [ ] **Moteur d'événements chainés** — système événementiel pour gérer les cascades (bloc → push → crowd surf → injury → apothecary → casualty) avec rollback possible
- [ ] **Simulateur de probabilités** — calcul en temps réel des probabilités de succès avant chaque action (affichable dans l'UI)
- [ ] **Mode "règles allégées"** — variante simplifiée pour les nouveaux joueurs (pas de compétences, météo simplifiée)
- [ ] **Validation par arbitre IA** — vérification automatique de la légalité de chaque action côté serveur, détection des incohérences d'état

---

## Phase 4 — Expérience Web immersive 🔶 EN COURS (60%)

> _Objectif : transformer le board statique en une expérience de jeu riche et fluide._

### ✅ Réalisé

- [x] **Board Pixi.js** — terrain complet avec endzones, lignes, grille, joueurs colorés, balle dorée
- [x] **[#34](https://github.com/Ryxeuf/fantasy-football-game/issues/34)** Surbrillance des coups possibles ✅ — overlay vert pour les moves légaux
- [x] **[#28](https://github.com/Ryxeuf/fantasy-football-game/issues/28)** HUD overlay ✅ — scoreboard avec half/turn/team, PM, relances, turnover indicator, touchdown animation
- [x] **Système de popups complet** — ActionPicker, BlockChoice, DiceResult, PushChoice, FollowUpChoice
- [x] **GameLog** — log scrollable avec entrées colorées par type
- [x] **Dugout complet** — zones réserves, KO, stunned, casualty avec compteurs
- [x] **Star Players catalog** — grille filtrable avec recherche, filtre roster/coût/skill
- [x] **Skills reference** — catégories, bilingue FR/EN, recherche, filtres Season 2/3
- [x] **Teams management** — listing, filtres tier/ruleset, création/édition
- [x] **Admin panel** — dashboard complet avec stats, CRUD data, gestion users/cups
- [x] **Local Matches UI** — listing, filtres, détails, création
- [x] **i18n FR/EN** — LanguageContext, translations complètes, switcher

### 🔲 À implémenter

- [ ] **[#41](https://github.com/Ryxeuf/fantasy-football-game/issues/41)** Zoom/Pan (wheel + drag) — viewport Pixi.js avec limites et reset
- [ ] **[#36](https://github.com/Ryxeuf/fantasy-football-game/issues/36)** Animations tween déplacement — interpolation 150-250ms, easing, queue, skip (S)
- [ ] **[#38](https://github.com/Ryxeuf/fantasy-football-game/issues/38)** Système d'assets (loader/cache) — sprite sheets, pions par équipe
- [ ] **[#26](https://github.com/Ryxeuf/fantasy-football-game/issues/26)** Thème visuel terrain (tileset) — calques Pixi herbe/en-buts, lignes séparées
- [ ] **[#27](https://github.com/Ryxeuf/fantasy-football-game/issues/27)** Heatmap zones de tacle — overlay semi-transparent avec intensité

#### 💡 Améliorations proposées (innovantes)

- [ ] **Système de caméra cinématique** — zoom automatique sur l'action en cours (bloc, passe longue, touchdown) avec transitions fluides
- [ ] **Mode spectateur** — vue en lecture seule pour regarder un match en cours avec commentaires auto-générés
- [ ] **Thèmes de terrain dynamiques** — terrain qui change visuellement selon la météo (neige, pluie, nuit) avec particles Pixi.js
- [ ] **Indicateurs tactiques** — affichage des lignes de passe potentielles, trajectoires de blitz, et zones de danger au survol
- [ ] **Replay 3D-like** — perspective isométrique optionnelle avec effet de profondeur pour les moments clés
- [ ] **Sound design** — effets sonores contextualités (impact bloc, sifflet turnover, foule) via Web Audio API
- [ ] **Export GIF/vidéo** — capture animée d'une action ou d'un tour complet pour partage social

---

## Phase 5 — Multijoueur temps réel & Notifications 🔴 À FAIRE (15%)

> _Objectif : expérience multijoueur fluide avec notifications push._

### ✅ Réalisé

- [x] Toast notifications in-game (dés, actions)
- [x] Match lobby avec acceptation et setup
- [x] Invitation par token

### 🔲 À implémenter

- [ ] **WebSocket/Server-Sent Events** — synchronisation temps réel des moves entre joueurs
- [ ] **Indicateur "adversaire en train de jouer"** — animation de réflexion, timer visuel
- [ ] **[#23](https://github.com/Ryxeuf/fantasy-football-game/issues/23)** UI permission & préférences notifications — modal d'activation, page /settings
- [ ] **[#24](https://github.com/Ryxeuf/fantasy-football-game/issues/24)** Badge cloche + toast activation — icône header actif/inactif
- [ ] **Push notifications (Service Worker)** — "C'est votre tour !", "Match terminé", "Invitation reçue"
- [ ] **Chat in-game** — messagerie simple entre joueurs pendant un match

#### 💡 Améliorations proposées (innovantes)

- [ ] **Système de timer adaptatif** — timer par tour qui s'ajuste selon la complexité de la situation (plus de temps si beaucoup d'options)
- [ ] **Notifications intelligentes** — regroupement des notifications, résumé digest ("3 matchs vous attendent"), heure de notification préférée
- [ ] **Présence & statut** — indicateur en ligne/hors ligne, "dernière connexion il y a 5 min"
- [ ] **Emotes rapides** — système d'emotes pendant le match (GG, Nice Block, Ouch!, 🎲) sans quitter le board
- [ ] **Reconnexion gracieuse** — reprise automatique après déconnexion avec synchronisation d'état

---

## Phase 6 — Application Mobile 🔴 À FAIRE (10%)

> _Objectif : application mobile native complète miroir du web._

### ✅ Réalisé

- [x] Setup Expo + React Native basique
- [x] Board PixiBoard.native.tsx (rendu minimal)
- [x] 1 écran MVP avec mouvement + fin de tour

### 🔲 À implémenter

- [ ] **[#17](https://github.com/Ryxeuf/fantasy-football-game/issues/17)** Flow Login → New/Join → Lobby — écrans Expo Stack complets
- [ ] **[#42](https://github.com/Ryxeuf/fantasy-football-game/issues/42)** Zoom/Pan (pinch + drag) — gestes natifs avec limites
- [ ] **[#35](https://github.com/Ryxeuf/fantasy-football-game/issues/35)** Surbrillance des coups possibles — tap → cases jouables, double-tap annule
- [ ] **[#29](https://github.com/Ryxeuf/fantasy-football-game/issues/29)** Renderer Canvas RN (MVP) — plateau complet rect/cercles, gestes tap/long press
- [ ] **[#37](https://github.com/Ryxeuf/fantasy-football-game/issues/37)** Animations tween RN — API partagée avec le web
- [ ] **[#40](https://github.com/Ryxeuf/fantasy-football-game/issues/40)** Pack d'assets léger — sprite sheet 1x/2x, fallback vectoriel
- [ ] **[#25](https://github.com/Ryxeuf/fantasy-football-game/issues/25)** Notifications Expo — permissions, toggles, push
- [ ] **[#22](https://github.com/Ryxeuf/fantasy-football-game/issues/22)** Historique minimal — liste turns + bouton voir l'état

#### 💡 Améliorations proposées (innovantes)

- [ ] **Gestes avancés** — swipe pour end turn, long press pour action picker, shake pour relance
- [ ] **Mode hors-ligne** — jouer un match local contre l'IA sans connexion, sync au retour en ligne
- [ ] **Widget iOS/Android** — widget affichant "À votre tour dans X matchs" sur l'écran d'accueil
- [ ] **Haptic feedback** — vibrations contextuelles (bloc réussi = vibration forte, esquive = vibration légère)
- [ ] **Mode portrait optimisé** — board pivotable avec UI adaptative pour jouer d'une main

---

## Phase 7 — Polish, Compétitivité & Communauté 🔴 À FAIRE (5%)

> _Objectif : fonctionnalités avancées pour fidéliser et créer une communauté._

### 🔲 À implémenter

- [ ] **[#21](https://github.com/Ryxeuf/fantasy-football-game/issues/21)** Replayer avec curseur de tour — recalcul seed + events, UI stepper + slider
- [ ] **[#20](https://github.com/Ryxeuf/fantasy-football-game/issues/20)** Historique du match (onglet) — liste turns, "Rejouer depuis ici"
- [ ] **[#39](https://github.com/Ryxeuf/fantasy-football-game/issues/39)** Variantes de terrain (skins) — sélecteur herbe/ruine/neige + preview Lobby

#### 💡 Améliorations proposées (innovantes)

**Statistiques & Analytics**
- [ ] **Dashboard statistiques par coach** — win rate, touchdowns/match, équipes préférées, graphiques d'évolution sur le temps
- [ ] **Statistiques par joueur (carrière)** — touchdowns, casualties, passes, MVP awards, blessures subies, progression SPP
- [ ] **Classement ELO** — système de classement avec leagues (Bronze, Argent, Or, Légende), matchmaking basé sur ELO
- [ ] **Heatmap de terrain post-match** — visualisation des zones les plus jouées, couloirs de passe, zones de combat

**Engagement communautaire**
- [ ] **Système de saisons** — saisons compétitives de 4 semaines avec récompenses cosmétiques, reset de classement
- [ ] **Achievements/Trophées** — 50+ achievements déblocables (1er touchdown, 10 casualties, gagner sans turnover, etc.)
- [ ] **Profil public de coach** — page de profil avec palmarès, équipes, statistiques, badges, historique de matchs
- [ ] **Leaderboards thématiques** — meilleur bloqueur, meilleur passeur, coach le plus chanceux (ratio dés)

**Expérience enrichie**
- [ ] **Mode draft** — sélection alternée de joueurs avant un match exhibition
- [ ] **Tournois automatiques** — brackets automatiques, Swiss system, round-robin avec timers
- [ ] **Système de progression cosmétique** — couleurs d'équipe, blasons, animations de touchdown personnalisées
- [ ] **IA adversaire** — bot avec 3 niveaux de difficulté (Débutant, Intermédiaire, Légende) pour le jeu solo
- [ ] **Tutoriel interactif** — scénarios guidés pas-à-pas pour apprendre les règles (mouvement → bloc → passe → blitz)
- [ ] **API publique** — API REST documentée pour intégrations tierces (bots Discord, apps communautaires, outils d'analyse)

---

## 📊 Statistiques globales

### Répartition par phase

| Phase | Statut | Complété | Items total |
|-------|--------|----------|-------------|
| **Phase 1** — Moteur de jeu | ✅ Complète | 95% | 18 items |
| **Phase 2** — Serveur & Auth | ✅ Complète | 95% | 12 items |
| **Phase 3** — Règles avancées | 🔶 En cours | 40% | 12 items |
| **Phase 4** — Expérience Web | 🔶 En cours | 60% | 19 items |
| **Phase 5** — Multijoueur & Notif | 🔴 À faire | 15% | 14 items |
| **Phase 6** — Mobile | 🔴 À faire | 10% | 14 items |
| **Phase 7** — Polish & Communauté | 🔴 À faire | 5% | 18 items |

### Répartition par zone

| Zone | Issues originales | Nouvelles propositions | Total |
|------|------------------|----------------------|-------|
| **Engine** | 4 | 5 | 9 |
| **Server** | 4 | 3 | 7 |
| **Web** | 12 | 7 | 19 |
| **Mobile** | 8 | 5 | 13 |
| **Notifications** | 3 | 5 | 8 |
| **Communauté/Polish** | 3 | 14 | 17 |
| **Total** | **34** | **39** | **73** |

### Fonctionnalités non-listées dans l'ancienne roadmap mais déjà implémentées

Ces fonctionnalités majeures étaient **absentes du TODO** mais sont **pleinement fonctionnelles** :

| Fonctionnalité | Statut | Détail |
|---------------|--------|--------|
| Star Players complet | ✅ 100% | Catalog, CRUD admin, images, hiring rules, stats |
| Skills bilingue FR/EN | ✅ 100% | Categories, search, Season 2/3, descriptions |
| Teams management | ✅ 100% | Listing, filtres, création, édition, players |
| Admin panel complet | ✅ 100% | Dashboard stats, CRUD complet, user management |
| i18n FR/EN | ✅ 100% | Context, translations, switcher, persistance |
| Local Matches | ✅ 100% | Création, partage, moves, action logging |
| Cups/Tournois | ✅ 100% | Scoring configurable, standings, brackets |
| SEO (partiel) | ⚠️ 50% | Structured data JSON-LD, métadonnées |
| Popup system | ✅ 100% | 5 popups interactifs pour le gameplay |
| Dice notifications | ✅ 100% | Toast system avec icons de dés |
| GameLog complet | ✅ 100% | Log scrollable coloré par type |
| Dugout UI | ✅ 100% | Zones visuelles avec compteurs |
| Pré-match sequence | ✅ 100% | Fan Factor, Météo, Journeymen, Inducements |
| Blitz system | ✅ 100% | Mouvement + bloc, limite par tour |
| Passing complet | ✅ 100% | 4 portées, interceptions, handoff |

---

_Source : [GitHub Issues](https://github.com/Ryxeuf/fantasy-football-game/issues)_
_Audit réalisé le 2026-03-14 par analyse exhaustive du code source_
