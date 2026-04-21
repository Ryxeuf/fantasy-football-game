# TODO — Nuffle Arena (Blood Bowl 3 Online)

> Backlog priorise par valeur (Gain) et effort (Difficulte).
> Derniere mise a jour : 2026-04-14 (repriorisation 5 equipes)
>
> **Objectif** : livrer un jeu 100% fonctionnel avec un scope reduit a 5 equipes prioritaires,
> puis rayonner sur le reste du contenu.
>
> **Equipes prioritaires** (MVP complet) :
> 1. Skaven
> 2. Gnomes
> 3. Hommes-Lezards
> 4. Nains
> 5. Noblesse Imperiale
>
> **Ordre strategique post-Sprint 12** :
> 1. Completer les skills intrinseques et star players des 5 equipes → jeu joueable complet
> 2. Engagement & retention (tutoriel, IA, amis, achievements) — deplace en priorite haute
> 3. Ligues + mobile + contenu restant ensuite
>
> **Documentation detaillee** : [`docs/roadmap/`](./docs/roadmap/)
> - [Audit complet (2026-04-02)](./docs/roadmap/audit-report.md) — constats game engine, frontend, backend, contenu
> - [Phases detaillees (A-O)](./docs/roadmap/phases.md) — toutes les taches par phase
> - [Sprint 0 — Bugfixes](./docs/roadmap/sprint-0.md) — bugs critiques et securite
> - [Analyse d'evolution (2026-04-12)](./docs/roadmap/evolution-analysis-2026-04-12.md) — evaluation complete, plan sprints 12-20

---

## Etat des lieux (audit 2026-04-02)

### Ce qui est fait
- Moteur de jeu : plateau 26x15, mouvement, blocage, passes, fautes, blessures, blitz, GFI
- 8 skills avec effet mecanique reel (Block, Dodge, Tackle, Sure Hands, Sure Feet, Guard, Mighty Blow, hasSkill)
- 126 skills definis (noms, descriptions, categories) — mais 118 sans effet en jeu
- 32 rosters BB3 S2 + 29 rosters S3 avec toutes les positions
- 67 Star Players avec stats et couts
- Zones de tacle, effets meteo (12 types, 37/43 conditions), kickoff events (11, 7 fonctionnels)
- Sequence pre-match (fan factor, meteo, journeymen, coin toss)
- Auth JWT complete + rate limiting
- Base de donnees Prisma (User, Match, Turn, Team, Cup, etc.)
- Board Pixi.js avec zoom/pan, HUD, popups, dugout
- Lobby de match avec invitations par token
- Admin panel complet, i18n FR/EN
- Docker + CI/CD + Traefik SSL
- 200+ tests unitaires
- Progression joueurs complete (SPP, level-up, blessures, mort, journeymen) — local et online
- socket.io installe avec auth JWT et rooms par matchId

### Problemes critiques decouverts (audit 2026-04-02)
1. **Architecture skills cassee** : `skill-registry.ts` (44 skills) jamais appele par le moteur — code mort
2. **Bug dodge** : `armorSuccess = true` hardcode dans `actions.ts:809` — dodge rate = jamais de blessure
3. **Bug RNG** : `Math.random()` au lieu du RNG seede dans `game-state.ts` — resultats non reproductibles
4. **Crowd push manquant** : `handleInjuryByCrowd()` existe mais jamais appelee — surf impossible
5. **Faille securite** : `/admin/data/*` sans middleware auth — endpoints publics
6. **WebSocket non cable** : `getIO()` jamais appele depuis les routes — zero push temps reel
7. **UI match online incomplete** : Block/Push/FollowUp popups, Reroll, GameLog non cables
8. **Post-TD / mi-temps** : pas de re-setup, pas de re-kickoff apres un touchdown

---

## Sprints

### Sprint 0 — Bugfixes critiques & securite (IMMEDIAT)

> [Detail](./docs/roadmap/sprint-0.md)

| # | Tache | Type | Statut |
|---|-------|------|--------|
| BUG-1 | Fix `armorSuccess = true` hardcode dans actions.ts | Bug | [x] |
| BUG-2 | Remplacer `Math.random()` par RNG seede dans game-state.ts | Bug | [x] |
| BUG-3 | Cabler `handleInjuryByCrowd()` dans blocking.ts | Bug | [x] |
| SEC-1 | Ajouter auth middleware sur `/admin/data/*` | Securite | [x] |
| SEC-2 | Valider participant match dans socket room join | Securite | [x] |

### Sprint 1 — Match online jouable (~5 jours)

| # | Tache | Type | Statut |
|---|-------|------|--------|
| B0.1 | Brancher `skill-registry.ts` dans le moteur | Architecture | [x] |
| A.4 | Emettre gameState via WebSocket apres chaque action | Multiplayer | [x] |
| A.5 | Hook client `useGameSocket(matchId)` | Multiplayer | [x] |
| A.6 | Synchroniser actions via WebSocket | Multiplayer | [x] |
| UI-1 | Cabler Block/Push/FollowUp popups en match online | UI | [x] |
| UI-2 | Cabler bouton Reroll interactif | UI | [x] |
| B1.9 | Post-touchdown : re-setup + re-kickoff | Game flow | [x] |

### Sprint 2 — Regles BB3 essentielles (~5 jours)

| # | Tache | Type | Statut |
|---|-------|------|--------|
| B1.2-3 | Apothecaire (logique + UI) | Regle | [x] |
| B1.6 | Wrestle skill effect | Regle | [x] |
| B1.5 | Loner reroll limitation | Regle | [x] |
| B1.7 | Mi-temps complete (reset + re-kickoff) | Game flow | [x] |
| B1.4 | Regeneration | Regle | [x] |
| B0.2 | Fix slug mismatch sidestep/side-step | Bug | [x] |

### Sprint 3 — Matchmaking & Animations (~6 jours)

| # | Tache | Type | Statut |
|---|-------|------|--------|
| C.1-3 | Queue matchmaking + matching auto | Matchmaking | [x] |
| E.1-3 | Tweens mouvement/balle + queue animations | UX | [x] |
| A.10 | Notification "C'est votre tour" | Multiplayer | [x] |
| H.5 | Effets sonores basiques | UX | [x] |

### Sprint 4 — Contenu & Competitif

| # | Tache | Type | Statut |
|---|-------|------|--------|
| B2.1 | Inducements — catalogue, validation, effets (game engine) | Regle | [x] |
| B2.2 | Inducements — UI selection pre-match | UI | [x] |
| B2.3 | Prayers to Nuffle (16 vrais effets) | Regle | [x] |
| F.1-2 | Systeme ELO | Classement | [x] |
| B3.1 | Regles speciales star players (top 10) | Contenu | [x] |

### Sprint 5 — Robustesse multijoueur & flow complet (~6 jours)

| # | Tache | Type | Statut |
|---|-------|------|--------|
| A.7 | Reconnexion WebSocket avec exponential backoff | Multiplayer | [x] |
| A.8 | Fallback polling si WebSocket echoue | Multiplayer | [x] |
| A.9 | Indicateur de connexion online/offline dans le HUD | UI | [x] |
| C.4 | Notification match trouve via WebSocket | Matchmaking | [x] |
| C.5 | Phase de setup en ligne (placement + bouton Pret) | Game flow | [x] |
| C.6 | Sequence pre-match automatisee online | Game flow | [x] |
| C.7 | Fin de match en ligne (ecran resultats) | Game flow | [x] |
| C.8 | Abandon / deconnexion = defaite (forfait > 2 min) | Multiplayer | [x] |
| B1.8 | Fin de match complete (winnings, fan factor, ecran) | Game flow | [x] |
| B1.10 | Timer de tour configurable avec fin de tour auto | Game flow | [x] |

### Sprint 6 — Regles BB3 complementaires (~5 jours)

| # | Tache | Type | Statut |
|---|-------|------|--------|
| B2.5 | Secret Weapons — expulsion fin de drive + Bribe | Regle | [x] |
| B2.7 | Animosity — jet avant passe/handoff | Regle | [x] |
| B2.8 | Decay — blessures 1 niveau plus grave | Regle | [x] |
| B2.4 | Throw Team-Mate — mecanique complete | Regle | [x] |
| B2.9 | Hypnotic Gaze — action speciale | Regle | [x] |
| B2.10 | Projectile Vomit — bloc range 1 | Regle | [x] |

### Sprint 7 — Notifications push (~5 jours)

| # | Tache | Type | Statut |
|---|-------|------|--------|
| G.1 | Service Worker push notifications | Notifications | [x] |
| G.2 | Endpoint serveur web-push | Notifications | [x] |
| G.3 | Push "C'est votre tour" | Notifications | [x] |
| G.4 | Push "Match trouve" | Notifications | [x] |
| G.5 | UI permission + preferences | Notifications | [x] |

### Sprint 8 — Polish & Contenu

| # | Tache | Type | Statut |
|---|-------|------|--------|
| H.1 | Chat in-game (WebSocket) | Polish | [x] |
| H.2 | Mode spectateur | Polish | [x] |
| I.4 | Fix bug encodage Morg 'n' Thorg image | Contenu | [x] |
| I.5 | Fix placeholders images (6 star players) | Contenu | [x] |
| I.10 | Fix cheering fans dedicated fans a 0 | Contenu | [x] |
| I.8 | Fix 2 conditions meteo manquantes | Contenu | [x] |

### Sprint 9 — Animations avancees & contenu restant (~5 jours)

| # | Tache | Type | Statut |
|---|-------|------|--------|
| E.4 | Animation de blocage (shake/flash sur impact) | UX | [x] |
| E.5 | Animation de touchdown (flash + particules endzone) | UX | [x] |
| E.6 | Animation de blessure (icone KO/casualty/mort) | UX | [x] |
| E.7 | Animation de des (des 2D animes) | UX | [x] |
| I.9 | Implementer 4 kickoff events delegues UI | Contenu | [x] |
| F.3 | Page leaderboard | Classement | [x] |
| F.4 | ELO dans profil et lobby | Classement | [x] |

### Sprint 10 — Contenu & polish restants

| # | Tache | Type | Statut |
|---|-------|------|--------|
| I.1 | Ajouter roster Slann en Season 3 | Contenu | [x] |
| I.2 | Descriptions S3 rosters (descriptionFr/En) | Contenu | [x] |
| I.3 | Fixer images star players manquantes (~28) | Contenu | [x] |
| B3.2 | UI affichage regles speciales star players | UI | [x] |
| H.3 | Replayer basique | Polish | [x] |
| H.4 | Indicateurs tactiques (zones de tacle, portee) | Polish | [x] |
| H.6 | Sprite sheets par equipe (5/5 — sprite manifest registry + UI resolver + PixiBoard integration, atlases directory ready) | Polish | [x] |

### Sprint 11 — Donnees S3 & taches restantes

| # | Tache | Type | Statut |
|---|-------|------|--------|
| I.7 | Differencier star players S3 vs S2 (overrides, Slann regional rules) | Contenu | [x] |
| B2.6 | Verifier connexion Sweltering Heat dans le flow (deja cable) | Regle | [x] |
| I.6 | Rediger regles speciales star players manquantes (~60) | Contenu | [x] |
| H.7 | Variantes de terrain (skins herbe/ruine/neige) | Polish | [x] |

### Sprint 12 — Fondations & Securite (~5 jours)

> Securiser la plateforme et combler les manques critiques d'equilibre.
> [Detail](./docs/roadmap/evolution-analysis-2026-04-12.md)

| # | Tache | Type | Statut |
|---|-------|------|--------|
| SEC-3 | Centraliser JWT_SECRET/MATCH_SECRET dans `config.ts`, crash si absent en prod | Securite | [x] |
| SEC-4 | Restreindre CORS aux origines specifiques | Securite | [x] |
| J.1 | Implementer `bone-head` (activation roll) | Regle | [x] |
| J.2 | Implementer `really-stupid` (1/2) | Regle | [x] |
| J.3 | Implementer `wild-animal` | Regle | [x] |
| J.4 | Implementer `animal-savagery` | Regle | [x] |
| J.5 | Implementer `take-root` | Regle | [x] |
| J.6 | Implementer `no-hands` | Regle | [x] |
| J.7 | Implementer `right-stuff` | Regle | [x] |
| TEST-1 | Activer vitest coverage reporting | Qualite | [x] |
| SEC-5 | Validation Zod sur toutes les routes non validees | Securite | [x] |

### Sprint 13 — Skills intrinseques des 5 equipes prioritaires (~6 jours)

> Finaliser tous les skills presents de base sur les rosters Skaven, Gnomes, Hommes-Lezards, Nains, Noblesse Imperiale.
> Objectif : chaque joueur des 5 rosters joue avec ses regles BB3 correctement appliquees.

| # | Tache | Type | Statut |
|---|-------|------|--------|
| J.8 | Implementer `bloodlust` (3 variantes) | Regle | [x] |
| J.9 | Implementer `always-hungry` | Regle | [x] |
| J.10 | Implementer `foul-appearance` | Regle | [x] |
| J.11 | Implementer `instable` | Regle | [x] |
| K.1 | Implementer `leap` + `pogo-stick` | Regle | [x] |
| K.2 | Implementer `stab` | Regle | [x] |
| K.3 | Implementer `chainsaw` | Regle | [x] |
| K.4 | Implementer `dump-off` | Regle | [x] |
| K.5 | Implementer `on-the-ball` | Regle | [x] |
| P1.1 | Implementer `stunty` (Skinks, Lineman Gnome, joueurs petits) | Regle | [x] |
| P1.2 | Implementer `dauntless` (Dwarf Troll Slayer) | Regle | [x] |
| P1.3 | Implementer `break-tackle` (Dwarf Deathroller) | Regle | [x] |
| P1.4 | Implementer `juggernaut` (Dwarf Deathroller) | Regle | [x] |
| P1.5 | Implementer `stand-firm` (Deathroller, Bodyguard, Treeman Gnome) | Regle | [x] |
| P1.6 | Implementer `armored-skull` (Dwarf Deathroller) | Regle | [x] |
| P1.7 | Implementer `iron-hard-skin` (Gnomes : piston, beastmaster, treeman) | Regle | [x] |
| P1.8 | Implementer `shadowing` (Lizardmen Chameleon Skink) | Regle | [x] |
| P1.9 | Implementer `fend` (Imperial Retainer Lineman) — verifier | Regle | [x] |
| P1.10 | Implementer `running-pass` (Imperial Thrower) | Regle | [x] |
| P1.11 | Audit : verifier que `prehensile-tail`, `frenzy`, `throw-team-mate`, `thick-skull`, `on-the-ball`, `loner` s'appliquent correctement aux joueurs des 5 equipes | Regle | [x] |
| TEST-2a | Tests integration : `stunty` + `armored-skull` (batch 1) | Tests | [x] |
| TEST-2b | Tests integration : `dauntless` + `juggernaut` (batch 2) | Tests | [x] |
| TEST-2c | Tests integration : `stand-firm` + `fend` (batch 3) | Tests | [x] |
| TEST-2d | Tests integration : `break-tackle` + `iron-hard-skin` (batch 4) | Tests | [x] |
| TEST-2e | Tests integration : `shadowing` + `running-pass` (batch 5) | Tests | [x] |
| TEST-3 | Test E2E : un match complet Nains vs Skaven sans divergence de regles | Tests | [x] |

### Sprint 14 — Skills de progression & Star Players des 5 equipes (~6 jours)

> Completer les skills selectionnables lors du level-up + toutes les star players hirables par les 5 equipes prioritaires.

| # | Tache | Type | Statut |
|---|-------|------|--------|
| P2.1 | Implementer `kick` (tres pris en progression, universel) | Regle | [x] |
| P2.2 | Implementer `defensive` (progression universelle) | Regle | [x] |
| P2.3 | Implementer `disturbing-presence` (progression universelle) | Regle | [x] |
| P2.4 | Implementer `leap` (Saurus progression frequente) | Regle | [x] |
| P2.5 | Implementer `dump-off` (Imperial / Skaven Thrower progression) | Regle | [x] |
| P2.6 | Implementer `sneaky-git` (Dwarf Troll Slayer progression) | Regle | [x] |
| P2.7 | Lister les star players hirables par les 5 equipes (flag `hirableBy`) | Contenu | [x] |
| P2.8 | Ecrire les special rules manquantes de ces star players (~15-25) | Contenu | [x] |
| P2.9 | Images + descriptions FR/EN de ces star players | Contenu | [x] |
| P2.10 | Tests unitaires sur les special rules star players des 5 equipes | Tests | [x] |

### Sprint 15 — Tutoriel & IA adversaire (~6 jours, ex-Sprint 18 remonte)

> Rendre le jeu accessible aux debutants avant toute autre croissance.

| # | Tache | Type | Statut |
|---|-------|------|--------|
| N.1 | Tutoriel interactif (match guide, scripts pas a pas) | Engagement | [x] |
| N.2 | Mode simplifie pour debutants (leverager `SIMPLIFIED_RULES`) | Engagement | [x] |
| N.3 | IA adversaire — evaluation heuristique basique (eval position + coup) | Engagement | [x] |
| N.4 | Mode pratique contre IA (3 niveaux de difficulte) | Engagement | [x] |
| N.4b | IA contrainte aux 5 equipes prioritaires dans un premier temps | Engagement | [x] |

### Sprint 16 — Social & retention (~5 jours, ex-Sprint 19 remonte)

> Fideliser les joueurs autour des 5 equipes jouables.

| # | Tache | Type | Statut |
|---|-------|------|--------|
| N.5 | Systeme d'amis (ajout, invitation, statut en ligne) | Social | [x] |
| N.6 | Historique de matchs avec stats de carriere (par equipe, par joueur) | Social | [x] |
| N.7 | Systeme d'achievements (succes) | Social | [x] |
| N.8 | Badges "Maitre" par equipe prioritaire (gagner X matchs avec chaque) | Social | [x] |

### Sprint 17 — Infrastructure Competitive : ligues (~8 jours, ex-Sprint 14)

> Systeme de ligues — activite long-terme autour des 5 equipes.

| # | Tache | Type | Statut |
|---|-------|------|--------|
| L.1 | Modeles Prisma League/LeagueSeason/LeagueParticipant/LeagueRound | DB | [x] |
| L.2 | Migration Prisma + seed data | DB | [x] |
| L.3 | Routes API CRUD ligue (create, join, schedule, standings) | API | [x] |
| L.4 | Generateur de calendrier round-robin | Backend | [x] |
| L.5 | Page liste des ligues | Frontend | [x] |
| L.6 | Page detail ligue (calendrier, classement, matchs) | Frontend | [x] |
| L.7 | Integration match online -> ligue (resultats auto) | Backend | [x] |
| L.8 | ELO saisonnier avec reset et placements | Backend | [x] |
| L.9 | Ligue demarrage : "Open 5 Teams" limite aux 5 equipes prioritaires | Backend | [ ] |

### Sprint 18-19 — Parite Mobile (~10 jours, ex-Sprint 16-17)

> Amener l'app mobile a un etat utilisable.

| # | Tache | Type | Statut |
|---|-------|------|--------|
| M.1 | Ecrans gestion d'equipe (creer, editer, voir) | Mobile | [ ] |
| M.2 | Ecran queue matchmaking | Mobile | [ ] |
| M.3 | Integration WebSocket complete | Mobile | [ ] |
| M.4 | Popups block/push/followup/reroll natifs | Mobile | [ ] |
| M.5 | Chat in-game mobile | Mobile | [ ] |
| M.6 | Ecran leaderboard | Mobile | [ ] |
| M.7 | Ecran replay de match | Mobile | [ ] |
| M.8 | Ecrans cups/ligues | Mobile | [ ] |
| M.9 | Push notifications natives (Expo Notifications) | Mobile | [ ] |
| M.10 | Details joueur et progression | Mobile | [ ] |
| M.11 | Catalogue Star Players mobile | Mobile | [ ] |
| M.12 | Profil et settings mobile | Mobile | [ ] |

### Sprint 20-21 — Extension contenu : skills & equipes restantes

> Une fois les 5 equipes prioritaires totalement finies, ouvrir progressivement le reste.

| # | Tache | Type | Statut |
|---|-------|------|--------|
| J.8 | Implementer `bloodlust` (3 variantes) — Vampires | Regle | [x] |
| J.9 | Implementer `always-hungry` — Ogres / Snotlings | Regle | [x] |
| J.10 | Implementer `foul-appearance` — Nurgle / Chaos | Regle | [x] |
| J.11 | Implementer `instable` — divers | Regle | [x] |
| K.1b | Implementer `pogo-stick` — Goblin | Regle | [x] |
| K.2 | Implementer `stab` — Vampire / Underworld | Regle | [x] |
| K.3 | Implementer `chainsaw` — Secret weapons | Regle | [x] |
| K.10 | Implementer `multiple-block` — Ogres | Regle | [ ] |
| K.11 | Implementer `hail-mary-pass` + `safe-pass` | Regle | [ ] |
| K.12 | Implementer `ball-and-chain` — Goblin Fanatic | Regle | [ ] |
| K.13 | Implementer `bombardier` — Goblin Bomma | Regle | [ ] |
| O.2 | Star player special rules restantes (~30, hors 5 equipes) | Contenu | [ ] |
| O.1 | ~39 skills niche restants (batch 3) | Contenu | [ ] |

### Sprint 22+ — Polish final & communaute

> Qualite, performance, rayonnement.

| # | Tache | Type | Statut |
|---|-------|------|--------|
| O.3 | Verification differences regles S3 | Contenu | [ ] |
| O.4 | Expansion E2E tests (couverture cible 80%) | Qualite | [ ] |
| O.5 | Optimisation taille GameState (separer gameLog) | Perf | [ ] |
| O.6 | Standardiser error handling (`ApiResponse<T>`) | Qualite | [ ] |
| O.7 | Optimiser queries DB (pagination, select) | Perf | [ ] |
| O.8 | Cosmetiques (logos equipe, generateur noms) | Engagement | [ ] |
| O.9 | Features communautaires (match of the week, Discord) | Engagement | [ ] |
| O.10 | Dashboard analytics personnel et global | Engagement | [ ] |

---

## Resume par phase

| Phase | Taches | Fait | Partiel | A faire | Criticite |
|-------|--------|------|---------|---------|-----------|
| **S0 — Bugfixes** | 5 | 5 | 0 | 0 | TERMINE |
| **A — Multijoueur temps reel** | 10 | 10 | 0 | 0 | TERMINE |
| **B0 — Architecture skills** | 2 | 2 | 0 | 0 | TERMINE |
| **B1 — Regles BB3 critiques** | 10 | 10 | 0 | 0 | TERMINE |
| **B2 — Regles BB3 importantes** | 10 | 10 | 0 | 0 | TERMINE |
| **B3 — Star Players specials** | 2 | 2 | 0 | 0 | TERMINE |
| **C — Matchmaking & flow** | 8 | 8 | 0 | 0 | TERMINE |
| **D — Progression joueurs** | 8 | 8 | 0 | 0 | TERMINE |
| **E — Animations web** | 7 | 7 | 0 | 0 | TERMINE |
| **F — ELO & classement** | 4 | 4 | 0 | 0 | TERMINE |
| **G — Notifications push** | 5 | 5 | 0 | 0 | TERMINE |
| **H — Polish** | 7 | 7 | 0 | 0 | TERMINE |
| **I — Contenu & donnees** | 10 | 10 | 0 | 0 | TERMINE |
| **P1 — Skills intrinseques 5 equipes** | 13 | 0 | 0 | 13 | CRITIQUE (Sprint 13) |
| **P2 — Progression & Stars 5 equipes** | 10 | 1 | 0 | 9 | CRITIQUE (Sprint 14) |
| **N — Croissance & engagement** | 8 | 0 | 0 | 8 | HAUTE (Sprint 15-16) |
| **L — Ligues** | 9 | 0 | 0 | 9 | HAUTE (Sprint 17) |
| **M — Parite mobile** | 12 | 0 | 0 | 12 | MOYENNE (Sprint 18-19) |
| **J — Traits negatifs restants** | 4 | 4 | 0 | 0 | TERMINE (livre avant ordonnancement) |
| **K — Skills fort impact (non-5 equipes)** | 8 | 3 | 0 | 5 | BASSE (Sprint 20-21) |
| **O — Contenu & polish** | 10 | 0 | 0 | 10 | SOUHAITABLE (Sprint 22+) |

---

## Chemin critique

```
Phase 1 : Sprints 0-12 ✅ ──→ MATCH ONLINE JOUABLE + GAMEPLAY RICHE + SECURITE

Phase 2 : MVP "5 equipes totalement fonctionnelles" (repriorisation 2026-04-14)

Sprint 13 (Skills intrinseques 5 equipes)
    │
    └── Sprint 14 (Progression + Star Players 5 equipes)
           │
           └── ✅ Les 5 equipes (Skaven/Gnomes/Lezards/Nains/Noblesse) sont jouables a 100%
                  │
                  ├── Sprint 15 (Tutoriel + IA)           ── onboarding debutants
                  │     │
                  │     └── Sprint 16 (Amis, achievements) ── retention
                  │
                  └── Sprint 17 (Ligues) ── activite competitive long-terme

Phase 3 : Extension

Sprint 18-19 (Mobile) ── [App stores]
Sprint 20-21 (Skills + equipes restantes) ── ouvrir les 56 autres rosters
Sprint 22+ (Polish, perf, communaute)
```

> **Historique (Sprints 0-12)** :
> 1. ~~Sprint 0~~ ✅ — bugs critiques et failles securite
> 2. ~~Sprint 1~~ ✅ — skills + WebSocket + UI = match jouable
> 3. ~~Sprint 2~~ ✅ — regles BB3 essentielles
> 4. ~~Sprint 3~~ ✅ — matchmaking + animations
> 5. ~~Sprint 4~~ ✅ — contenu + ELO
> 6. ~~Sprint 5~~ ✅ — robustesse WS, flow complet, timer = production ready
> 7. ~~Sprint 6~~ ✅ — regles BB3 complementaires (Secret Weapons, Animosity, TTM)
> 8. ~~Sprint 7~~ ✅ — notifications push (Service Worker, web-push, integration)
> 9. ~~Sprint 8~~ ✅ — polish & contenu (chat in-game, bugfixes donnees)
> 10. ~~Sprint 9~~ ✅ — animations avancees, kickoff events, leaderboard
> 11. ~~Sprint 10~~ ✅ — contenu & polish restants (Slann S3, images, replayer)
> 12. ~~Sprint 11~~ ✅ — donnees S3, taches restantes
> 13. ~~Sprint 12~~ ✅ — securite + traits negatifs (equilibre critique)
>
> **Plan d'evolution repriorise (2026-04-14)** :
> 14. Sprint 13 — skills intrinseques des 5 equipes (stunty, dauntless, break-tackle, juggernaut, stand-firm, armored-skull, iron-hard-skin, shadowing, fend, running-pass)
> 15. Sprint 14 — skills de progression + star players hirables par les 5 equipes (kick, defensive, disturbing-presence, leap, dump-off, sneaky-git + ~20 stars)
> 16. Sprint 15 — tutoriel interactif + IA adversaire (onboarding) [REMONTE]
> 17. Sprint 16 — amis, achievements, historique carriere (retention) [REMONTE]
> 18. Sprint 17 — systeme de ligues (competitif) [DECALE]
> 19. Sprint 18-19 — parite mobile [DECALE]
> 20. Sprint 20-21 — skills et equipes restantes (bloodlust, stab, chainsaw, ball-and-chain, bombardier, etc.)
> 21. Sprint 22+ — polish final (E2E, perf, analytics, communaute)
