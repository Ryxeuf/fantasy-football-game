# TODO — Nuffle Arena (Blood Bowl 3 Online)

> Backlog priorise par valeur (Gain) et effort (Difficulte).
> Derniere mise a jour : 2026-04-02
>
> **Objectif** : jouer en ligne a Blood Bowl avec les regles BB3 (Season 2/3).
>
> **Documentation detaillee** : [`docs/roadmap/`](./docs/roadmap/)
> - [Audit complet (2026-04-02)](./docs/roadmap/audit-report.md) — constats game engine, frontend, backend, contenu
> - [Phases detaillees (A-I)](./docs/roadmap/phases.md) — toutes les taches par phase
> - [Sprint 0 — Bugfixes](./docs/roadmap/sprint-0.md) — bugs critiques et securite

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
| I.5 | Fix placeholders images (6 star players) | Contenu | [ ] |
| I.10 | Fix cheering fans dedicated fans a 0 | Contenu | [ ] |
| I.8 | Fix 2 conditions meteo manquantes | Contenu | [ ] |

---

## Resume par phase

| Phase | Taches | Fait | Partiel | A faire | Criticite |
|-------|--------|------|---------|---------|-----------|
| **S0 — Bugfixes** | 5 | 5 | 0 | 0 | TERMINE |
| **A — Multijoueur temps reel** | 10 | 7 | 0 | 3 | EN COURS (Sprint 5) |
| **B0 — Architecture skills** | 2 | 2 | 0 | 0 | TERMINE |
| **B1 — Regles BB3 critiques** | 10 | 7 | 1 | 2 | EN COURS (Sprint 5) |
| **B2 — Regles BB3 importantes** | 10 | 4 | 1 | 5 | EN COURS (Sprint 6) |
| **B3 — Star Players specials** | 2 | 1 | 0 | 1 | BONUS |
| **C — Matchmaking & flow** | 8 | 3 | 1 | 4 | EN COURS (Sprint 5) |
| **D — Progression joueurs** | 8 | 8 | 0 | 0 | TERMINE |
| **E — Animations web** | 7 | 3 | 0 | 4 | IMPORTANT (UX) |
| **F — ELO & classement** | 4 | 2 | 0 | 2 | SOUHAITABLE |
| **G — Notifications push** | 5 | 2 | 0 | 3 | EN COURS (Sprint 7) |
| **H — Polish** | 7 | 2 | 0 | 5 | EN COURS (Sprint 8) |
| **I — Contenu & donnees** | 10 | 0 | 0 | 10 | BONUS |

---

## Chemin critique pour jouer en ligne

```
Sprint 0 (Bugfixes) ✅ ──→ Sprint 1 (WS + UI + skills) ✅ ──→ MATCH ONLINE JOUABLE ✅
       │                         │
       │                Sprint 2 (Regles BB3 critiques) ✅
       │                         │
       │                Sprint 3 (Matchmaking + Animations) ✅ ──→ EXPERIENCE COMPLETE ✅
       │                         │
       │                Sprint 4 (Contenu + ELO) ✅ ──→ COMPETITIF ✅
       │                         │
       │                Sprint 5 (Robustesse + Flow) ✅ ──→ PRODUCTION READY ✅
       │                         │
       │                Sprint 6 (Regles BB3 complementaires) ✅ ──→ GAMEPLAY COMPLET ✅
       │                         │
       │                Sprint 7 (Notifications push) ──→ ENGAGEMENT
       │
       └── Phases B2/B3 + G + H + I ──→ GAMEPLAY RICHE + POLISH
```

> **Recommandation (2026-04-07)** :
> 1. ~~Sprint 0~~ ✅ — bugs critiques et failles securite
> 2. ~~Sprint 1~~ ✅ — skills + WebSocket + UI = match jouable
> 3. ~~Sprint 2~~ ✅ — regles BB3 essentielles
> 4. ~~Sprint 3~~ ✅ — matchmaking + animations
> 5. ~~Sprint 4~~ ✅ — contenu + ELO
> 6. ~~Sprint 5~~ ✅ — robustesse WS, flow complet, timer = production ready
> 7. ~~Sprint 6~~ ✅ — regles BB3 complementaires (Secret Weapons, Animosity, TTM)
> 8. ~~Sprint 7~~ ✅ — notifications push (Service Worker, web-push, integration)
> 9. **En cours** : Sprint 8 — polish & contenu (chat in-game, bugfixes donnees)
> 10. **Plus tard** : H suite (spectateur, replayer), I suite (contenu)
