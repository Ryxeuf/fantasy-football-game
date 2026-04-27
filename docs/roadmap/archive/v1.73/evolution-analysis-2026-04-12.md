# Analyse du Projet & Plan d'Evolution

> Date : 2026-04-12
> Version : v1.50.0 (post-Sprint 11)
> Analyse : evaluation complete du projet, identification des manques, propositions d'evolution

---

## 1. Etat Actuel — Synthese

### Chiffres cles

| Metrique | Valeur |
|----------|--------|
| Version | v1.50.0 |
| Sprints livres | 11 (Sprint 0-10 done, Sprint 11 en cours) |
| LOC TypeScript | ~87 000 |
| Game engine | ~34 000 LOC |
| Skills avec effets mecaniques | 64 / 137 definis |
| Rosters | 32 S2 + 29 S3 = 61 |
| Star Players | 67 (10 avec regles speciales mecaniques) |
| Tests | 200+ (115 fichiers) |
| Pages web | 40+ routes |
| Ecrans mobile | 7 |

### Ce qui fonctionne

- **Game engine complet** : plateau 26x15, mouvement 8 directions, blocage, passes, fautes, blessures, blitz, GFI
- **RNG deterministe** (mulberry32), kickoff events, meteo, tackle zones
- **35+ skills actifs** dans le moteur via skill-registry + mecaniques dediees
- **Multiplayer temps reel** : Socket.io, JWT auth, reconnexion, fallback polling, timer
- **Matchmaking** : queue TV +/-150k, ELO ranking, leaderboard pagine
- **Progression joueurs** : SPP, level-up, blessures permanentes, mort, journeymen
- **UI riche** : Pixi.js board, animations, popups, chat, spectateur, replayer, sons, indicateurs tactiques
- **Notifications push** : Service Worker, web-push, preferences
- **Contenu** : 61 rosters, 67 star players, i18n FR/EN, admin panel CRUD
- **Infrastructure** : Docker, CI/CD, Traefik SSL, Semantic Release, Vercel preview

---

## 2. Analyse des Manques

### 2.1 Regles de jeu critiques (equilibre casse)

**73 skills sans effet mecanique** sur 137 definis. Le probleme majeur : les **traits negatifs** sont absents.

| Skill | Impact | Equipes affectees |
|-------|--------|-------------------|
| `bone-head` | Roll D6, echec = perte action | Ogres, Snotlings |
| `really-stupid` | Roll D6, echec = perte action | Ogres, Snotlings |
| `wild-animal` | Roll D6, echec = block only | Chaos, Khorne |
| `animal-savagery` | Roll D6, echec = block coequipier | Necromantic |
| `bloodlust` (1/2/3) | Doit mordre thrall | Vampires |
| `take-root` | Roll D6, echec = enracine | Halflings (Treeman) |
| `always-hungry` | Roll D6, echec = mange le lance | Ogres, Halflings |
| `no-hands` | Ne peut porter le ballon | Snotlings, certains Big Guys |
| `right-stuff` | Peut etre lance | Snotlings, Halflings |
| `instable` | Retire sur double armor break | Daemons |
| `foul-appearance` | Adversaire roll D6 avant block | Nurgle, Undead |

**Sans ces traits, les equipes comme Ogres, Vampires, Nurgle sont surpuissantes** car leurs joueurs n'ont aucun handicap.

Autres skills manquants a fort impact :
- `leap` — vital pour Wood Elves, High Elves, Slann
- `stab`, `chainsaw`, `ball-and-chain`, `bombardier` — actions uniques pour positionnels specifiques
- `dump-off` — defensif essentiel pour porteurs de balle
- `kick`, `sneaky-git`, `disturbing-presence` — gameplay tactique

### 2.2 Features competitives manquantes

| Feature | Impact | Existant |
|---------|--------|----------|
| **Systeme de ligues** | Coeur du BB competitif | Cups basiques seulement |
| **Systeme d'amis** | Social, invitations directes | `connected-users.ts` existe |
| **Historique de matchs** | Stats de carriere, W/L/D | Donnees existent, pas de vue |
| **Ladder saisonnier** | Resets, placements, tiers | ELO sans saisons |
| **Achievements** | Engagement, milestones | Rien |

### 2.3 Dette technique

| Probleme | Severite | Detail |
|----------|----------|--------|
| JWT_SECRET fallback `"dev-secret-change-me"` | **CRITIQUE** | 5 fichiers, forge de tokens en prod si env manquant |
| CORS `origin: "*"` | **HAUTE** | Express + Socket.io, CSRF-like via CORS |
| Validation input partielle | HAUTE | Certaines routes sans Zod |
| Config dispersee | MOYENNE | Secrets dans 5+ fichiers differents |
| Error handling inconsistant | MOYENNE | `catch (e: any)` sans format standard |
| gameLog sans limite | MOYENNE | GameState grossit indefiniment |
| Coverage non mesuree | MOYENNE | Vitest sans coverage configure |

### 2.4 Contenu incomplet

- **73 skills** sans effet mecanique (sur 137)
- **~57 star players** sans regles speciales mecaniques (sur 67)
- **Differences S3** non verifiees (skills `isModified`, `season3Only`)
- **6 conditions meteo** potentiellement manquantes

### 2.5 Mobile

L'app mobile a **7 ecrans** contre **40+ sur web**. Il manque :
- Gestion d'equipe (creer, editer, voir)
- Queue matchmaking
- Popups Block/Push/FollowUp/Reroll
- Chat, leaderboard, replay, cups/ligues
- Push notifications natives (Expo)
- Spectateur, profil, catalogue Star Players

### 2.6 Croissance & engagement

- **Pas de tutoriel** — Blood Bowl est complexe, les nouveaux joueurs sont perdus
- **Pas d'IA** — impossible de jouer solo ou s'entrainer
- **Pas de features communautaires** — match of the week, replays features, profils coach
- **Pas de stats analytiques** — equipe preferee, win rate, tendances

---

## 3. Plan d'Evolution — Sprints 12 a 20

### Sprint 12 — Fondations & Securite (~5 jours)

> Objectif : Securiser la plateforme et combler les manques critiques d'equilibre.

| # | Tache | Type | Prio | Effort |
|---|-------|------|------|--------|
| SEC-3 | Centraliser JWT_SECRET/MATCH_SECRET dans `config.ts`, crash si absent en prod | Securite | P0 | S |
| SEC-4 | Restreindre CORS aux origines specifiques | Securite | P0 | S |
| J.1 | Implementer `bone-head` | Regle | P0 | S |
| J.2 | Implementer `really-stupid` (1/2) | Regle | P0 | S |
| J.3 | Implementer `wild-animal` | Regle | P0 | S |
| J.4 | Implementer `animal-savagery` | Regle | P0 | M |
| J.5 | Implementer `take-root` | Regle | P0 | S |
| J.6 | Implementer `no-hands` | Regle | P0 | S |
| J.7 | Implementer `right-stuff` | Regle | P0 | S |
| TEST-1 | Activer vitest coverage reporting | Qualite | P1 | S |
| SEC-5 | Validation Zod sur toutes les routes non validees | Securite | P1 | S |

**Fichiers critiques** :
- `apps/server/src/config.ts` (nouveau)
- `apps/server/src/middleware/authUser.ts`, `authSocket.ts`
- `packages/game-engine/src/skills/skill-registry.ts`
- `packages/game-engine/src/actions/actions.ts`

### Sprint 13 — Equilibre des Equipes (~6 jours)

> Objectif : Rendre toutes les equipes jouables avec les bonnes mecaniques.

| # | Tache | Type | Prio | Effort |
|---|-------|------|------|--------|
| J.8 | Implementer `bloodlust` (3 variantes) | Regle | P0 | M |
| J.9 | Implementer `always-hungry` | Regle | P0 | S |
| J.10 | Implementer `foul-appearance` | Regle | P0 | S |
| J.11 | Implementer `instable` | Regle | P0 | S |
| K.1 | Implementer `leap` + `pogo-stick` | Regle | P1 | M |
| K.2 | Implementer `stab` | Regle | P1 | M |
| K.3 | Implementer `chainsaw` | Regle | P1 | M |
| K.4 | Implementer `dump-off` | Regle | P1 | M |
| K.5 | Implementer `on-the-ball` | Regle | P1 | S |
| TEST-2 | Tests unitaires pour tous les nouveaux skills | Tests | P1 | M |

**Fichiers critiques** :
- `packages/game-engine/src/skills/skill-registry.ts`
- `packages/game-engine/src/actions/actions.ts`
- `packages/game-engine/src/mechanics/movement.ts`
- `packages/game-engine/src/mechanics/blocking.ts`

### Sprint 14 — Infrastructure Competitive (~8 jours)

> Objectif : Lancer le systeme de ligues.

| # | Tache | Type | Prio | Effort |
|---|-------|------|------|--------|
| L.1 | Modeles Prisma League/LeagueSeason/LeagueParticipant/LeagueRound | DB | P0 | M |
| L.2 | Migration Prisma + seed data | DB | P0 | S |
| L.3 | Routes API CRUD ligue (create, join, schedule, standings) | API | P0 | L |
| L.4 | Generateur de calendrier round-robin | Backend | P0 | M |
| L.5 | Page liste des ligues | Frontend | P0 | M |
| L.6 | Page detail ligue (calendrier, classement, matchs) | Frontend | P0 | L |
| L.7 | Integration match online -> ligue (resultats auto) | Backend | P0 | M |
| L.8 | ELO saisonnier avec reset et placements | Backend | P2 | M |

**Fichiers critiques** :
- `prisma/schema.prisma`
- `apps/server/src/routes/league.ts` (nouveau)
- `apps/server/src/services/league.ts` (nouveau)
- `apps/web/app/leagues/` (nouveau)

### Sprint 15 — Skills a Fort Impact (~5 jours)

> Objectif : Completer les skills les plus frequemment rencontres.

| # | Tache | Type | Prio | Effort |
|---|-------|------|------|--------|
| K.6 | Implementer `kick` | Regle | P1 | S |
| K.7 | Implementer `sneaky-git` | Regle | P1 | S |
| K.8 | Implementer `defensive` | Regle | P1 | S |
| K.9 | Implementer `disturbing-presence` | Regle | P1 | S |
| K.10 | Implementer `multiple-block` | Regle | P1 | M |
| K.11 | Implementer `hail-mary-pass` + `safe-pass` | Regle | P1 | M |
| K.12 | Implementer `ball-and-chain` (mouvement aleatoire) | Regle | P1 | M |
| K.13 | Implementer `bombardier` (lancer de bombe) | Regle | P1 | M |
| B3.3 | 20 prochaines star player special rules | Contenu | P1 | M |

**Fichiers critiques** :
- `packages/game-engine/src/skills/skill-registry.ts`
- `packages/game-engine/src/skills/star-player-rules.ts`
- `packages/game-engine/src/actions/actions.ts`

### Sprint 16-17 — Parite Mobile (~10 jours)

> Objectif : Amener l'app mobile a un etat utilisable pour le jeu en ligne.

| # | Tache | Type | Prio | Effort |
|---|-------|------|------|--------|
| M.1 | Ecrans gestion d'equipe (creer, editer, voir) | Mobile | P0 | L |
| M.2 | Ecran queue matchmaking | Mobile | P0 | M |
| M.3 | Integration WebSocket complete | Mobile | P0 | M |
| M.4 | Popups block/push/followup/reroll natifs | Mobile | P0 | M |
| M.5 | Chat in-game mobile | Mobile | P1 | S |
| M.6 | Ecran leaderboard | Mobile | P1 | S |
| M.7 | Ecran replay de match | Mobile | P1 | M |
| M.8 | Ecrans cups/ligues | Mobile | P1 | M |
| M.9 | Push notifications natives (Expo Notifications) | Mobile | P1 | M |
| M.10 | Details joueur et progression | Mobile | P1 | M |
| M.11 | Catalogue Star Players | Mobile | P2 | S |
| M.12 | Profil et settings | Mobile | P2 | S |

**Fichiers critiques** :
- `apps/mobile/app/` (nouveaux ecrans)
- `packages/ui/src/board/PixiBoard.native.tsx`

### Sprint 18-19 — Croissance & Engagement (~10 jours)

> Objectif : Attirer et retenir les joueurs.

| # | Tache | Type | Prio | Effort |
|---|-------|------|------|--------|
| N.1 | Tutoriel interactif (match guide contre scripts) | Engagement | P0 | L |
| N.2 | Mode simplifie pour debutants (leverager `SIMPLIFIED_RULES`) | Engagement | P0 | M |
| N.3 | IA adversaire — evaluation heuristique basique | Engagement | P1 | XL |
| N.4 | Mode pratique contre IA | Engagement | P1 | M |
| N.5 | Systeme d'amis (ajout, invitation, statut en ligne) | Social | P1 | L |
| N.6 | Historique de matchs avec stats de carriere | Social | P1 | M |
| N.7 | Systeme d'achievements | Social | P2 | L |

**Fichiers critiques** :
- `packages/game-engine/src/core/rules-config.ts` (SIMPLIFIED_RULES)
- `packages/game-engine/src/ai/` (nouveau module)
- `prisma/schema.prisma` (Friend, Achievement)
- `apps/server/src/services/connected-users.ts`

### Sprint 20+ — Contenu & Polish

> Objectif : Completer la couverture skills, ameliorer la qualite.

| # | Tache | Type | Prio | Effort |
|---|-------|------|------|--------|
| O.1 | ~39 skills niche restants (batch 3) | Contenu | P2 | L |
| O.2 | Star player special rules restantes (~30) | Contenu | P2 | M |
| O.3 | Verification differences regles S3 | Contenu | P2 | M |
| O.4 | Expansion E2E tests (couverture cible 80%) | Qualite | P2 | L |
| O.5 | Optimisation taille GameState (separer gameLog) | Perf | P2 | M |
| O.6 | Standardiser error handling (`ApiResponse<T>`) | Qualite | P2 | M |
| O.7 | Optimiser queries DB (pagination, select) | Perf | P2 | M |
| O.8 | Cosmetiques (logos equipe, generateur noms) | Engagement | P3 | M |
| O.9 | Features communautaires (match of the week, Discord) | Engagement | P3 | L |
| O.10 | Dashboard analytics personnel et global | Engagement | P3 | M |

---

## 4. Matrice Priorite / Effort

```
              S          M          L          XL
         ┌──────────┬──────────┬──────────┬──────────┐
   P0    │ SEC-3,4  │ J.1-7    │ L.3,L.6  │          │
         │ J.6,10   │ J.4,8    │ M.1      │          │
         │ TEST-1   │ M.2-4    │ N.1      │          │
         ├──────────┼──────────┼──────────┼──────────┤
   P1    │ SEC-5    │ K.1-5    │ K.6-13   │ N.3 (IA) │
         │ K.6-9    │ TEST-2   │ N.5      │          │
         │ M.5,6    │ M.7-10   │ B3.3     │          │
         │          │ N.2,4,6  │          │          │
         ├──────────┼──────────┼──────────┼──────────┤
   P2    │ M.11,12  │ L.8      │ N.7      │          │
         │          │ O.2,3,5  │ O.1,4    │          │
         │          │ O.6,7    │          │          │
         ├──────────┼──────────┼──────────┼──────────┤
   P3    │          │ O.8,10   │ O.9      │          │
         └──────────┴──────────┴──────────┴──────────┘
```

---

## 5. Chemin Critique

```
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

**Dependances** :
- Sprint 13 depend de Sprint 12 (architecture traits negatifs)
- Sprint 14 (ligues) est independant, peut etre parallelize
- Sprint 16-17 (mobile) est independant, peut etre parallelize
- Sprint 18-19 (IA) depend du game engine stable (post-Sprint 15)

---

## 6. Recommandations

1. **Securite d'abord** (Sprint 12) — les fallbacks JWT sont une faille critique en production
2. **Equilibre avant contenu** — les traits negatifs cassent le gameplay competitif
3. **Ligues = killer feature** — c'est ce qui distingue un jeu Blood Bowl d'une demo
4. **Mobile en parallele** — peut etre travaille independamment par un autre dev
5. **IA = retention** — permet le jeu solo, l'entrainement, et comble les creux de queue
6. **Mesurer la coverage** — impossible d'ameliorer ce qu'on ne mesure pas
