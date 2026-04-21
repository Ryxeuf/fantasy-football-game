# Phases de Developpement

> Derniere mise a jour : 2026-04-12
> Voir [audit-report.md](./audit-report.md) pour le detail des constats.
> Voir [evolution-analysis-2026-04-12.md](./evolution-analysis-2026-04-12.md) pour l'analyse d'evolution et les phases J-O.

---

## Phase A — Multijoueur temps reel (CRITIQUE)

> socket.io installe et attache au serveur Express. Auth JWT OK. Rooms OK.
> **Gap principal** : `getIO()` jamais appele depuis les routes — zero push temps reel.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| A.1 | Installer socket.io sur le serveur Express | Fort | Facile | [x] | Implemente dans #83 |
| A.2 | Creer les rooms par matchId | Fort | Facile | [x] | `socket.join(matchId)` + connect/disconnect |
| A.3 | Authentifier les connexions WebSocket | Fort | Moyen | [x] | Middleware JWT sur namespace `/game` |
| A.4 | Emettre le gameState apres chaque action | Fort | Moyen | [ ] | Apres `executeMove()`, broadcast `game:state-update` a la room |
| A.5 | Client socket.io dans le composant de jeu | Fort | Moyen | [ ] | Hook `useGameSocket(matchId)` qui connecte et ecoute `game:state-update` |
| A.6 | Synchroniser les actions via WebSocket | Fort | Moyen | [ ] | Client envoie `game:action`, serveur valide et broadcast |
| A.7 | Gerer la reconnexion WebSocket | Moyen | Moyen | [ ] | Exponential backoff, resync du gameState complet |
| A.8 | Fallback polling si WebSocket echoue | Moyen | Facile | [ ] | Detection deconnexion WS, bascule sur polling 3s |
| A.9 | Indicateur de connexion (online/offline) | Moyen | Facile | [ ] | Badge vert/rouge dans le HUD |
| A.10 | Notification "C'est votre tour" via WS | Fort | Facile | [ ] | Event `game:your-turn` avec toast + son optionnel |

---

## Phase B — Regles BB3 manquantes

### B0 — Architecture skills (prerequis)

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| B0.1 | Brancher `skill-registry.ts` dans le moteur | Fort | Moyen | [ ] | Appeler `collectModifiers`/`getSkillEffect` depuis blocking.ts, movement.ts, passing.ts, foul.ts. Debloque 38+ skills d'un coup. |
| B0.2 | Fixer le slug mismatch `sidestep` vs `side-step` | Fort | Facile | [ ] | Normaliser les slugs ou ajouter alias dans le registry |

### B1 — Regles critiques (impact chaque match)

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| B1.1 | Crowd push (surf) | Fort | Moyen | [x] | Sprint 0 — `handleInjuryByCrowd()` cable dans `blocking.ts` |
| B1.2 | Apothecaire — modele et logique | Fort | Moyen | [ ] | 1 utilisation/match, choix entre 2 resultats de blessure |
| B1.3 | Apothecaire — UI popup de choix | Fort | Facile | [ ] | Modal "Utiliser l'apothecaire ?" |
| B1.4 | Regeneration (skill) | Moyen | Facile | [ ] | Apres casualty, jet 4+ pour revenir en reserve |
| B1.5 | Loner (3+/4+/5+) reroll limitation | Moyen | Facile | [ ] | Jet Loner requis avant chaque team reroll |
| B1.6 | Wrestle | Fort | Facile | [ ] | SkillEffect + popup choix quand Block et Wrestle presents |
| B1.7 | Procedure mi-temps complete | Fort | Moyen | [~] | KO recovery OK. Manque : reset positions, re-kickoff, UI transition |
| B1.8 | Procedure fin de match | Fort | Moyen | [~] | SPP + MVP OK. Manque : winnings/fan factor, ecran resultats online |
| B1.9 | Post-touchdown : re-setup + re-kickoff | Fort | Moyen | [ ] | Actuellement pas de re-setup apres un TD |
| B1.10 | Timer de tour (optionnel) | Moyen | Moyen | [ ] | Countdown configurable, fin de tour auto |

### B2 — Regles importantes (certains matchs)

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| B2.1 | Inducements — liste et effets | Fort | Difficile | [~] | Stub existe, `items: []` toujours vide |
| B2.2 | Inducements — UI selection pre-match | Fort | Moyen | [ ] | Page depense petty cash |
| B2.3 | Prayers to Nuffle — 16 effets | Moyen | Moyen | [~] | Stub existe, texte generique |
| B2.4 | Throw Team-Mate | Moyen | Difficile | [ ] | Type declare, aucune mecanique |
| B2.5 | Secret Weapons — expulsion fin de drive | Moyen | Facile | [ ] | Slugs existent, aucune logique |
| B2.6 | Sweltering Heat — retrait aleatoire | Moyen | Facile | [~] | `getWeatherModifiers()` OK, connexion flow a verifier |
| B2.7 | Animosity — jet avant passe/handoff | Moyen | Facile | [ ] | 2+ sinon refus si receveur race differente |
| B2.8 | Decay (skill) | Faible | Facile | [ ] | Blessures 1 niveau plus grave |
| B2.9 | Hypnotic Gaze | Faible | Moyen | [ ] | Action speciale, cible perd tackle zone |
| B2.10 | Projectile Vomit | Faible | Moyen | [ ] | Bloc range 1 avec jet special |

### B3 — Star Players special rules

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| B3.1 | Implementer regles speciales Mega Stars | Moyen | Difficile | [ ] | 60/67 star players n'ont qu'un texte fallback generique |
| B3.2 | UI affichage regles speciales | Moyen | Facile | [ ] | Tooltip/popup au survol |

---

## Phase C — Matchmaking & flow en ligne

> Lobby invite-by-ID existe. Pas de matchmaking automatique.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| C.1 | Page "Jouer en ligne" avec bouton recherche | Fort | Moyen | [x] | `apps/web/app/play/page.tsx` avec `team-select` + bouton "Chercher un match" → `POST /matchmaking/join` |
| C.2 | File d'attente matchmaking (queue) | Fort | Moyen | [x] | Table Prisma `MatchQueue` + `apps/server/src/services/matchmaking.ts` (matching TV ±150k) |
| C.3 | Matching automatique + creation match | Fort | Moyen | [x] | `apps/server/src/routes/matchmaking.ts` (join/leave/status) + tests unitaires 327 lignes |
| C.4 | Notification match trouve | Fort | Facile | [x] | Hook `useMatchmakingSocket` écoute `matchmaking:found` + notif browser + son + redirect |
| C.5 | Phase de setup en ligne | Fort | Moyen | [x] | `apps/server/src/services/prematch-setup.ts` (placement + bouton Pret) + `ai-setup.ts` pour AI |
| C.6 | Sequence pre-match automatisee | Fort | Moyen | [x] | Moteur + inducements (catalogue 9 types, validation CTV, effets) + 16 prayers reels + UI online (PreMatchSummary, InducementSelector) + WS `game:submit-inducements` + E2E |
| C.7 | Fin de match en ligne (resultats) | Fort | Moyen | [x] | `apps/web/app/components/PostMatchSPP.tsx` ecran recap |
| C.8 | Abandon / deconnexion = defaite | Moyen | Facile | [x] | `apps/server/src/services/forfeit-tracker.ts` (forfait > 2 min) + tests |

---

## Phase D — Progression des joueurs (TERMINEE)

> Tous les services sont implementes et cables pour local et online.

| # | Tache | Statut |
|---|-------|--------|
| D.1 | SPP tracking en match | [x] |
| D.2 | Ecran post-match SPP | [x] |
| D.3 | Level-up choix competence | [x] |
| D.4 | Table avancement BB3 | [x] |
| D.5 | Blessures permanentes | [x] |
| D.6 | Mort de joueur | [x] |
| D.7 | Achat de remplacants | [x] |
| D.8 | Journeymen automatiques | [x] |

---

## Phase E — Animations & experience web

> Board web statique. Mobile a des tweens (Reanimated).

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| E.1 | Tween deplacement joueur | Fort | Moyen | [ ] | Pixi.js ticker, 150-250ms easing |
| E.2 | Tween balle (passe/scatter) | Fort | Moyen | [ ] | Arc trajectoire |
| E.3 | File d'attente d'animations | Moyen | Moyen | [ ] | Promise-based, skip Espace |
| E.4 | Animation de blocage | Moyen | Moyen | [ ] | Shake/flash selon resultat |
| E.5 | Animation de touchdown | Moyen | Facile | [ ] | Flash + particules endzone |
| E.6 | Animation de blessure | Moyen | Facile | [ ] | Icone KO/casualty/mort |
| E.7 | Animation de des | Moyen | Moyen | [ ] | Des 2D/3D animes |

---

## Phase F — ELO & classement

> Rien dans le schema Prisma.

| # | Tache | Gain | Diff | Statut |
|---|-------|------|------|--------|
| F.1 | Champ ELO sur User (Prisma) | Moyen | Facile | [ ] |
| F.2 | Calcul ELO apres match | Moyen | Moyen | [ ] |
| F.3 | Page leaderboard | Moyen | Moyen | [ ] |
| F.4 | ELO dans profil et lobby | Moyen | Facile | [ ] |

---

## Phase G — Notifications push

> Aucun service worker ni web-push.

| # | Tache | Gain | Diff | Statut |
|---|-------|------|------|--------|
| G.1 | Service Worker push | Fort | Moyen | [ ] |
| G.2 | Endpoint serveur web-push | Fort | Moyen | [ ] |
| G.3 | Push "C'est votre tour" | Fort | Facile | [ ] |
| G.4 | Push "Match trouve" | Fort | Facile | [ ] |
| G.5 | UI permission + preferences | Moyen | Facile | [ ] |

---

## Phase H — Polish & qualite de vie

| # | Tache | Gain | Diff | Statut |
|---|-------|------|------|--------|
| H.1 | Chat in-game | Moyen | Moyen | [ ] |
| H.2 | Mode spectateur | Moyen | Moyen | [ ] |
| H.3 | Replayer basique | Moyen | Moyen | [ ] |
| H.4 | Indicateurs tactiques | Moyen | Moyen | [ ] |
| H.5 | Sons (effets sonores) | Moyen | Moyen | [ ] |
| H.6 | Sprite sheets par equipe | Moyen | Moyen | [ ] |
| H.7 | Variantes terrain | Faible | Moyen | [ ] |

---

## Phase I — Contenu & donnees (NOUVEAU)

> Decouvert lors de l'audit contenu 2026-04-02.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| I.1 | Ajouter roster Slann en Season 3 | Faible | Facile | [ ] | Present en S2, absent en S3 |
| I.2 | Descriptions S3 rosters | Faible | Moyen | [ ] | `descriptionFr`/`descriptionEn` absents |
| I.3 | Fixer images star players manquantes (~28) | Moyen | Moyen | [ ] | 28 star players sans image propre |
| I.4 | Fixer bug encodage Morg 'n' Thorg image | Faible | Facile | [ ] | Apostrophe ASCII vs Unicode curly quote |
| I.5 | Fixer placeholders images (6 star players) | Faible | Facile | [ ] | Pointent vers Fungus-the-Loon alors qu'ils ont leur image |
| I.6 | Rediger les 60 specialRule star players manquantes | Moyen | Difficile | [ ] | 60/67 ont un fallback generique |
| I.7 | Star players specifiques Season 3 | Moyen | Moyen | [ ] | S3 = clone S2 actuellement |
| I.8 | Fixer 2 conditions meteo manquantes | Faible | Facile | [ ] | Affaissement du plafond, Ames errantes en colere |
| I.9 | Implementer 4 kickoff events delegues UI | Moyen | Moyen | [ ] | perfect-defence, high-kick, quick-snap, blitz |
| I.10 | Fixer cheering fans dedicated fans a 0 | Faible | Facile | [ ] | Hardcode dans kickoff-events.ts |

---

## Phase J — Traits negatifs & equilibre equipes (CRITIQUE)

> Analyse d'evolution 2026-04-12. Sans ces traits, les equipes Big Guys/Vampires/Nurgle sont surpuissantes.
> Fichiers principaux : `skill-registry.ts`, `actions.ts`, `types.ts`

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| J.1 | Implementer `bone-head` | Fort | Facile | [ ] | Roll D6 a l'activation; sur 1, perte d'action. Ogres, Snotlings |
| J.2 | Implementer `really-stupid` (1/2) | Fort | Facile | [ ] | Roll D6; sur 1, perte action (sauf coequipier adjacent non-RS) |
| J.3 | Implementer `wild-animal` | Fort | Facile | [ ] | Roll D6; sur 1-2, ne peut que block/blitz |
| J.4 | Implementer `animal-savagery` | Fort | Moyen | [ ] | Roll D6; sur 1, block un coequipier adjacent aleatoire |
| J.5 | Implementer `take-root` | Fort | Facile | [ ] | Roll D6; sur 1, enracine (ne peut bouger tout le tour) |
| J.6 | Implementer `no-hands` | Fort | Facile | [ ] | Ne peut ramasser/attraper/porter le ballon |
| J.7 | Implementer `right-stuff` | Fort | Facile | [ ] | Peut etre lance; blessure reduite a l'atterrissage |
| J.8 | Implementer `bloodlust` (3 variantes) | Fort | Moyen | [ ] | Doit mordre un thrall apres activation; echec = turnover |
| J.9 | Implementer `always-hungry` | Fort | Facile | [ ] | Roll D6; sur 1, mange le coequipier lance |
| J.10 | Implementer `foul-appearance` | Fort | Facile | [ ] | Adversaire roll D6 avant block; sur 1, block echoue |
| J.11 | Implementer `instable` | Moyen | Facile | [ ] | Retire du jeu sur double armor break |

---

## Phase K — Skills a fort impact

> Skills couramment rencontres qui enrichissent significativement le gameplay.
> Fichiers principaux : `skill-registry.ts`, `actions.ts`, `movement.ts`, `blocking.ts`

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| K.1 | Implementer `leap` + `pogo-stick` | Fort | Moyen | [ ] | Sauter par-dessus les tackle zones. Wood Elves, High Elves, Slann |
| K.2 | Implementer `stab` | Fort | Moyen | [ ] | Action alternative au block standard. Assassins |
| K.3 | Implementer `chainsaw` | Fort | Moyen | [ ] | Action alternative au block, -armorRoll. Secret Weapon |
| K.4 | Implementer `dump-off` | Fort | Moyen | [ ] | Quick Pass defensif quand cible par block en portant le ballon |
| K.5 | Implementer `on-the-ball` | Moyen | Facile | [ ] | Deplacement libre quand adversaire fait une passe |
| K.6 | Implementer `kick` | Moyen | Facile | [ ] | Choix de placement du kickoff (pas de scatter aleatoire) |
| K.7 | Implementer `sneaky-git` | Moyen | Facile | [ ] | Fouls : pas d'expulsion sur doubles |
| K.8 | Implementer `defensive` | Moyen | Facile | [ ] | Deplacement 1 case lors du setup adverse |
| K.9 | Implementer `disturbing-presence` | Moyen | Facile | [ ] | -1 aux jets passe/interception/catch adverses adjacents |
| K.10 | Implementer `multiple-block` | Moyen | Moyen | [ ] | Block deux adversaires adjacents simultanement |
| K.11 | Implementer `hail-mary-pass` + `safe-pass` | Moyen | Moyen | [ ] | Passe longue portee / protection fumble |
| K.12 | Implementer `ball-and-chain` | Fort | Moyen | [ ] | Mouvement aleatoire obligatoire, block auto |
| K.13 | Implementer `bombardier` | Fort | Moyen | [ ] | Lancer de bombe (scatter, KO zone) |

---

## Phase L — Systeme de ligues (CRITIQUE)

> Killer feature competitive. Le coeur du Blood Bowl en ligne.
> Fichiers principaux : `prisma/schema.prisma`, `routes/league.ts` (nouveau), `apps/web/app/leagues/` (nouveau)

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| L.1 | Modeles Prisma League/Season/Participant/Round | Fort | Moyen | [ ] | Schema DB pour ligues persistantes |
| L.2 | Migration Prisma + seed data | Fort | Facile | [ ] | Tables et donnees initiales |
| L.3 | Routes API CRUD ligue | Fort | Difficile | [ ] | create, join, schedule, standings, matchs |
| L.4 | Generateur de calendrier round-robin | Fort | Moyen | [ ] | Algorithme de paires, gestion byes |
| L.5 | Page liste des ligues | Fort | Moyen | [ ] | Browse, search, join |
| L.6 | Page detail ligue | Fort | Difficile | [ ] | Calendrier, classement, matchs, stats |
| L.7 | Integration match -> ligue | Fort | Moyen | [ ] | Resultats auto apres match online |
| L.8 | ELO saisonnier avec reset | Moyen | Moyen | [ ] | Saisons, placements, tiers |

---

## Phase M — Parite mobile

> L'app mobile a 7 ecrans vs 40+ sur web. Objectif : jeu en ligne complet sur mobile.
> Fichiers principaux : `apps/mobile/app/` (nouveaux ecrans), `packages/ui/src/board/PixiBoard.native.tsx`

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| M.1 | Ecrans gestion d'equipe | Fort | Difficile | [ ] | Creer, editer, voir, star players |
| M.2 | Ecran queue matchmaking | Fort | Moyen | [ ] | Bouton recherche, attente, notification |
| M.3 | Integration WebSocket complete | Fort | Moyen | [ ] | Socket.io client, reconnexion, statut |
| M.4 | Popups block/push/followup/reroll | Fort | Moyen | [ ] | Composants natifs touch-friendly |
| M.5 | Chat in-game mobile | Moyen | Facile | [ ] | Bulle de chat overlay |
| M.6 | Ecran leaderboard | Moyen | Facile | [ ] | ELO rankings pagines |
| M.7 | Ecran replay de match | Moyen | Moyen | [ ] | Controles lecture, timeline |
| M.8 | Ecrans cups/ligues | Moyen | Moyen | [ ] | Browse, detail, classement |
| M.9 | Push notifications natives | Moyen | Moyen | [ ] | Expo Notifications, preferences |
| M.10 | Details joueur et progression | Moyen | Moyen | [ ] | Stats, SPP, blessures, level-up |
| M.11 | Catalogue Star Players | Faible | Facile | [ ] | Liste avec images et stats |
| M.12 | Profil et settings | Faible | Facile | [ ] | Coach name, ELO, preferences |

---

## Phase N — Croissance & engagement

> Features pour attirer et retenir les joueurs.
> Fichiers principaux : `rules-config.ts`, `packages/game-engine/src/ai/` (nouveau), `prisma/schema.prisma`

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| N.1 | Tutoriel interactif | Fort | Difficile | [ ] | Match guide etape par etape contre scripts |
| N.2 | Mode simplifie debutants | Fort | Moyen | [ ] | Leverager `SIMPLIFIED_RULES` existant |
| N.3 | IA adversaire (heuristique) | Fort | Tres Diff | [ ] | Evaluation positionnelle, scoring coups |
| N.4 | Mode pratique contre IA | Fort | Moyen | [ ] | Match solo pour s'entrainer |
| N.5 | Systeme d'amis | Moyen | Difficile | [ ] | Ajout, invitation directe, statut en ligne |
| N.6 | Historique matchs + stats carriere | Moyen | Moyen | [ ] | W/L/D, head-to-head, stats aggregees |
| N.7 | Systeme d'achievements | Moyen | Difficile | [ ] | Milestones, deblocables, progression |

---

## Phase O — Contenu & polish final

> Completion de couverture, optimisations, qualite.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| O.1 | ~39 skills niche restants (batch 3) | Moyen | Difficile | [ ] | cannoneer, cloud-burster, etc. |
| O.2 | Star player special rules (~30 restantes) | Moyen | Moyen | [ ] | Effets mecaniques dans star-player-rules.ts |
| O.3 | Verification differences regles S3 | Moyen | Moyen | [ ] | Skills isModified, season3Only |
| O.4 | Expansion E2E tests (80% coverage) | Moyen | Difficile | [ ] | Vitest coverage, Playwright specs |
| O.5 | Optimisation GameState (separer gameLog) | Moyen | Moyen | [ ] | Log croit sans limite, diffs par tour |
| O.6 | Standardiser error handling | Moyen | Moyen | [ ] | ApiResponse<T> uniforme |
| O.7 | Optimiser queries DB | Moyen | Moyen | [ ] | Pagination, select, indexes |
| O.8 | Cosmetiques | Faible | Moyen | [ ] | Logos equipe, generateur noms par race |
| O.9 | Features communautaires | Faible | Difficile | [ ] | Match of the week, Discord, profils coach |
| O.10 | Dashboard analytics | Faible | Moyen | [ ] | Stats perso et globales |
