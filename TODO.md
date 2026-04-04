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
| B0.1 | Brancher `skill-registry.ts` dans le moteur | Architecture | [~] |
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
| B0.2 | Fix slug mismatch sidestep/side-step | Bug | [ ] |

### Sprint 3 — Matchmaking & Animations (~6 jours)

| # | Tache | Type | Statut |
|---|-------|------|--------|
| C.1-3 | Queue matchmaking + matching auto | Matchmaking | [ ] |
| E.1-3 | Tweens mouvement/balle + queue animations | UX | [ ] |
| A.10 | Notification "C'est votre tour" | Multiplayer | [ ] |
| H.5 | Effets sonores basiques | UX | [ ] |

### Sprint 4 — Contenu & Competitif

| # | Tache | Type | Statut |
|---|-------|------|--------|
| B2.1-2 | Inducements fonctionnels | Regle | [ ] |
| B2.3 | Prayers to Nuffle (16 vrais effets) | Regle | [ ] |
| F.1-2 | Systeme ELO | Classement | [ ] |
| B3.1 | Regles speciales star players (top 10) | Contenu | [ ] |

---

## Resume par phase

| Phase | Taches | Fait | Partiel | A faire | Criticite |
|-------|--------|------|---------|---------|-----------|
| **S0 — Bugfixes** | 5 | 5 | 0 | 0 | TERMINE |
| **A — Multijoueur temps reel** | 10 | 4 | 0 | 6 | BLOQUANT |
| **B0 — Architecture skills** | 2 | 0 | 0 | 2 | BLOQUANT |
| **B1 — Regles BB3 critiques** | 10 | 1 | 2 | 7 | ESSENTIEL |
| **B2 — Regles BB3 importantes** | 10 | 0 | 3 | 7 | SECONDAIRE |
| **B3 — Star Players specials** | 2 | 0 | 0 | 2 | BONUS |
| **C — Matchmaking & flow** | 8 | 0 | 2 | 6 | BLOQUANT |
| **D — Progression joueurs** | 8 | 8 | 0 | 0 | TERMINE |
| **E — Animations web** | 7 | 0 | 0 | 7 | IMPORTANT (UX) |
| **F — ELO & classement** | 4 | 0 | 0 | 4 | SOUHAITABLE |
| **G — Notifications push** | 5 | 0 | 0 | 5 | SOUHAITABLE |
| **H — Polish** | 7 | 0 | 0 | 7 | BONUS |
| **I — Contenu & donnees** | 10 | 0 | 0 | 10 | BONUS |

---

## Chemin critique pour jouer en ligne

```
Sprint 0 (Bugfixes) ──→ Sprint 1 (WS + UI + skills) ──→ MATCH ONLINE JOUABLE
       │                         │
       │                Sprint 2 (Regles BB3 critiques)
       │                         │
       │                Sprint 3 (Matchmaking + Animations) ──→ EXPERIENCE COMPLETE
       │                         │
       │                Sprint 4 (Contenu + ELO) ──→ COMPETITIF
       │
       └── Phases B2/B3 + G + H + I ──→ GAMEPLAY RICHE + POLISH
```

> **Recommandation (2026-04-02)** :
> 1. **Immediat** : Sprint 0 — fixer les bugs critiques et failles securite
> 2. **Sprint 1** : Brancher skills + WebSocket + UI manquante = match jouable
> 3. **Sprint 2** : Regles BB3 essentielles (apothecaire, wrestle, mi-temps)
> 4. **Sprint 3** : Matchmaking + animations = experience complete
> 5. **Plus tard** : ELO, notifications, star players specials, polish
