# TODO — Nuffle Arena (Blood Bowl 3 Online)

> Backlog priorise par valeur (Gain) et effort (Difficulte).
> Derniere mise a jour : 2026-04-12
>
> **Objectif** : jouer en ligne a Blood Bowl avec les regles BB3 (Season 2/3).
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
| SEC-4 | Restreindre CORS aux origines specifiques | Securite | [ ] |
| J.1 | Implementer `bone-head` (activation roll) | Regle | [ ] |
| J.2 | Implementer `really-stupid` (1/2) | Regle | [ ] |
| J.3 | Implementer `wild-animal` | Regle | [ ] |
| J.4 | Implementer `animal-savagery` | Regle | [ ] |
| J.5 | Implementer `take-root` | Regle | [ ] |
| J.6 | Implementer `no-hands` | Regle | [ ] |
| J.7 | Implementer `right-stuff` | Regle | [ ] |
| TEST-1 | Activer vitest coverage reporting | Qualite | [ ] |
| SEC-5 | Validation Zod sur toutes les routes non validees | Securite | [ ] |

### Sprint 13 — Equilibre des Equipes (~6 jours)

> Rendre toutes les equipes jouables avec les bonnes mecaniques.

| # | Tache | Type | Statut |
|---|-------|------|--------|
| J.8 | Implementer `bloodlust` (3 variantes) | Regle | [ ] |
| J.9 | Implementer `always-hungry` | Regle | [ ] |
| J.10 | Implementer `foul-appearance` | Regle | [ ] |
| J.11 | Implementer `instable` | Regle | [ ] |
| K.1 | Implementer `leap` + `pogo-stick` | Regle | [ ] |
| K.2 | Implementer `stab` | Regle | [ ] |
| K.3 | Implementer `chainsaw` | Regle | [ ] |
| K.4 | Implementer `dump-off` | Regle | [ ] |
| K.5 | Implementer `on-the-ball` | Regle | [ ] |
| TEST-2 | Tests unitaires pour tous les nouveaux skills | Tests | [ ] |

### Sprint 14 — Infrastructure Competitive (~8 jours)

> Lancer le systeme de ligues — coeur du Blood Bowl competitif.

| # | Tache | Type | Statut |
|---|-------|------|--------|
| L.1 | Modeles Prisma League/LeagueSeason/LeagueParticipant/LeagueRound | DB | [ ] |
| L.2 | Migration Prisma + seed data | DB | [ ] |
| L.3 | Routes API CRUD ligue (create, join, schedule, standings) | API | [ ] |
| L.4 | Generateur de calendrier round-robin | Backend | [ ] |
| L.5 | Page liste des ligues | Frontend | [ ] |
| L.6 | Page detail ligue (calendrier, classement, matchs) | Frontend | [ ] |
| L.7 | Integration match online -> ligue (resultats auto) | Backend | [ ] |
| L.8 | ELO saisonnier avec reset et placements | Backend | [ ] |

### Sprint 15 — Skills a Fort Impact (~5 jours)

> Completer les skills les plus frequemment rencontres.

| # | Tache | Type | Statut |
|---|-------|------|--------|
| K.6 | Implementer `kick` | Regle | [ ] |
| K.7 | Implementer `sneaky-git` | Regle | [ ] |
| K.8 | Implementer `defensive` | Regle | [ ] |
| K.9 | Implementer `disturbing-presence` | Regle | [ ] |
| K.10 | Implementer `multiple-block` | Regle | [ ] |
| K.11 | Implementer `hail-mary-pass` + `safe-pass` | Regle | [ ] |
| K.12 | Implementer `ball-and-chain` | Regle | [ ] |
| K.13 | Implementer `bombardier` | Regle | [ ] |
| B3.3 | 20 prochaines star player special rules | Contenu | [ ] |

### Sprint 16-17 — Parite Mobile (~10 jours)

> Amener l'app mobile a un etat utilisable pour le jeu en ligne.

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

### Sprint 18-19 — Croissance & Engagement (~10 jours)

> Attirer et retenir les joueurs.

| # | Tache | Type | Statut |
|---|-------|------|--------|
| N.1 | Tutoriel interactif (match guide contre scripts) | Engagement | [ ] |
| N.2 | Mode simplifie pour debutants (leverager `SIMPLIFIED_RULES`) | Engagement | [ ] |
| N.3 | IA adversaire — evaluation heuristique basique | Engagement | [ ] |
| N.4 | Mode pratique contre IA | Engagement | [ ] |
| N.5 | Systeme d'amis (ajout, invitation, statut en ligne) | Social | [ ] |
| N.6 | Historique de matchs avec stats de carriere | Social | [ ] |
| N.7 | Systeme d'achievements | Social | [ ] |

### Sprint 20+ — Contenu & Polish

> Completer la couverture skills, ameliorer la qualite.

| # | Tache | Type | Statut |
|---|-------|------|--------|
| O.1 | ~39 skills niche restants (batch 3) | Contenu | [ ] |
| O.2 | Star player special rules restantes (~30) | Contenu | [ ] |
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
| **J — Traits negatifs** | 11 | 0 | 0 | 11 | CRITIQUE (Sprint 12-13) |
| **K — Skills fort impact** | 13 | 0 | 0 | 13 | IMPORTANT (Sprint 13-15) |
| **L — Ligues** | 8 | 0 | 0 | 8 | CRITIQUE (Sprint 14) |
| **M — Parite mobile** | 12 | 0 | 0 | 12 | IMPORTANT (Sprint 16-17) |
| **N — Croissance** | 7 | 0 | 0 | 7 | IMPORTANT (Sprint 18-19) |
| **O — Contenu & polish** | 10 | 0 | 0 | 10 | SOUHAITABLE (Sprint 20+) |

---

## Chemin critique

```
Phase 1 : Sprints 0-11 ✅ ──→ MATCH ONLINE JOUABLE + GAMEPLAY RICHE + POLISH

Phase 2 : Sprints 12-20 (en cours)

Sprint 12 (Securite + Traits negatifs)
    │
    ├── Sprint 13 (Equilibre equipes) ── Sprint 15 (Skills fort impact)
    │                                         │
    │                                    Sprint 20+ (Skills niche)
    │
    ├── Sprint 14 (Ligues) ── Sprint 18 (Amis, Stats)
    │
    ├── Sprint 16-17 (Mobile) ── [App stores]
    │
    └── Sprint 18-19 (Tutoriel + IA) ── Sprint 20+ (Communaute)
```

> **Historique (Sprints 0-11)** :
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
>
> **Plan d'evolution (2026-04-12)** :
> 13. Sprint 12 — securite + traits negatifs (equilibre critique)
> 14. Sprint 13 — equilibre equipes (bloodlust, leap, stab, dump-off)
> 15. Sprint 14 — systeme de ligues (killer feature competitive)
> 16. Sprint 15 — skills a fort impact (kick, ball-and-chain, bombardier)
> 17. Sprint 16-17 — parite mobile (7 → 20+ ecrans)
> 18. Sprint 18-19 — croissance (tutoriel, IA, amis, achievements)
> 19. Sprint 20+ — contenu & polish (skills niche, E2E, optimisations)
