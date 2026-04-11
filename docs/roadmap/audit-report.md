# Audit Complet — 2026-04-02

## 1. Game Engine

### Skills : 8 effets actifs sur 126 definis
Le registre `skills/index.ts` contient **126 skills** (105 S2 + 21 S3).
Le plugin system `skill-registry.ts` enregistre **44 skills** avec `registerSkill()`.
Mais **aucune fonction du registry n'est appelee par le moteur** (`actions.ts`, `blocking.ts`, `movement.ts`, `passing.ts`, `foul.ts`).

Le code reel utilise `skill-effects.ts` qui n'exporte que **8 fonctions** :
- `hasSkill()`, `blockNegatesBothDown()` (Block), `dodgeNegatesStumble()` (Dodge/Tackle), `canRerollDodge()` (Dodge), `canRerollPickup()` (Sure Hands), `canRerollGFI()` (Sure Feet), `hasGuard()` (Guard), `getMightyBlowBonus()` (Mighty Blow)

**~118 skills sans aucun effet mecanique en match.**

Skills critiques manquants : Wrestle, Frenzy, Regeneration, Loner, Animosity, Decay, Hypnotic Gaze, Secret Weapons, Pro, Side Step, Stand Firm, Juggernaut, Grab, Claw, Dauntless, Fend, Strip Ball, Dirty Player, Catch, Pass (reroll), Nerves of Steel, etc.

Slug inconsistency : les rosters utilisent `sidestep` (sans tiret) mais le registry enregistre `side-step` (avec tiret).

### Regles BB3 manquantes

| Regle | Etat | Detail |
|-------|------|--------|
| Crowd push (surf) | Non implemente | `handleInjuryByCrowd()` existe dans `injury.ts:229` mais n'est jamais appelee. `blocking.ts:669` log "ne peut pas etre repousse" quand aucune direction. |
| Apothecaire | Champ Prisma seulement | Zero logique en jeu. Pas de `useApothecary()`, pas de prompt. |
| Regeneration | Slug enregistre seulement | Pas de check dans `injury.ts` ou le flow casualty. |
| Wrestle | Registry inert | Enregistre dans `skill-registry.ts:299` mais `collectModifiers` jamais appele. |
| Throw Team-Mate | Type declare seulement | `THROW_TEAM_MATE` dans `ActionType` mais tombe dans le `default` de `applyMove()`. |
| Secret Weapons | Slugs dans rosters | Aucune logique d'expulsion fin de drive. |
| Inducements | Stub | `processInducements()` calcule petty cash mais `items: []` toujours vide. |
| Prayers to Nuffle | Stub | Roll D16 mais texte generique, aucun effet de jeu. |
| Animosity | Definition seulement | Pas de check dans `handlePass` ou `handleHandoff`. |
| Decay | Definition seulement | Pas de check dans `performInjuryRoll()`. |
| Hypnotic Gaze | Definition seulement | Pas d'action type, pas de handler. |

### Bugs critiques trouves

| Bug | Fichier | Impact |
|-----|---------|--------|
| `const armorSuccess = true` hardcode | `actions.ts:809` | Dodge rate ne cause JAMAIS de blessure — scaffolding test laisse en prod |
| `Math.random()` au lieu du RNG seede | `game-state.ts:658,628` | Recovery KO et MVP non reproductibles/non deterministes |
| Crowd push silencieusement ignore | `blocking.ts:669` | Impossible de surfer un joueur hors du terrain |
| Skill registry jamais appele | Architecture | 38 skills enregistres + 80 definis = zero effet |
| Post-TD pas de re-setup | `game-state.ts:714` | Apres un TD, pas de kickoff, jeu reprend directement |
| Mi-temps incomplete | `game-state.ts:542` | `resetPlayerPositions()` ne replace pas les joueurs, pas de 2e kickoff |
| Cheering fans hardcode a 0 | `kickoff-events.ts` | Dedicated fans count ignore |

### Actions implementees

| Action | Etat | Gaps |
|--------|------|------|
| MOVE | Complet | Dodge, GFI, pickup, TD detection fonctionnels |
| BLOCK | Quasi-complet | Block, Dodge/Tackle, Guard, Mighty Blow. **Manque** : Wrestle, Fend, Stand Firm, Side Step, Grab, Juggernaut, Frenzy, Dauntless, Horns, Strip Ball, crowd push |
| BLITZ | Partiel | Blitz+block continuation OK. Horns (+1 ST) pas applique |
| PASS | Substantiel | Range modifiers, intercept, catch, completion OK. **Manque** : Pass/Catch reroll, Nerves of Steel, Accurate, Strong Arm, Dump-off, Safe Pass, Hail Mary |
| HANDOFF | Implemente | Catch roll, turnover, TD. **Manque** : Catch reroll |
| FOUL | Substantiel | Assists, armor, injury, doubles-ejection. **Manque** : Dirty Player modifier, Sneaky Git |
| THROW_TEAM_MATE | Non implemente | Type declare, tombe dans default |

---

## 2. Frontend Web

### Ce qui marche
- Board Pixi.js complet : zoom/pan, zones de tacle, selection joueurs, ball carrier, legal moves
- Setup placement drag+click avec validation (LOS, wide zones, half-field)
- Lobby `/play/` poli avec creation/join de match, clipboard copy
- Post-match SPP screen (`PostMatchSPP.tsx`)
- Admin panel complet avec CRUD toutes entites
- i18n FR/EN, pages SEO (teams, star players, skills)
- Auth complete (login, register, profil)
- Team management complet (creation, edition, star players, achats)

### Lacunes critiques

| Probleme | Detail |
|----------|--------|
| **Zero WebSocket cote client** | `useGameState` poll GET `/match/:id/state` a 3s/10s. Pas de socket.io-client. |
| **Block/Push/FollowUp popups non cables** | Importes dans l'ancien stub (supprime) mais PAS dans `/play/[id]/page.tsx` |
| **Pas de bouton Reroll** | Badge `pendingReroll` visible mais pas interactif |
| **Pas d'animations** | Positions snapent instantanement, aucun tween Pixi.js |
| **GameLog non affiche** | Composant existe dans `@bb/ui` mais non rendu dans la page match |
| **Pas d'UI mi-temps** | Aucun ecran de transition half-time |
| **Pas de pass/handoff UI** | Pas de ruler de range, pas de probabilite catch |

### Mobile vs Web

| Feature | Web | Mobile |
|---------|-----|--------|
| Board | Pixi.js, statique | SVG + Reanimated tweens |
| Setup placement | Drag+click | Manquant |
| Action picker | Present | Manquant |
| Dice popup | Present | Manquant |
| Post-match SPP | Present | Manquant |
| Team management | Complet | Manquant |

---

## 3. Backend & Securite

### WebSocket : structure en place, pas cable
- socket.io installe, namespace `/game`, auth JWT, rooms par matchId
- `getIO()` et `getGameNamespace()` exportes mais **jamais appeles depuis les routes**
- Aucun event emis apres un move, changement d'etat, ou fin de match
- Pas de verification que le joueur qui rejoint une room est participant du match

### Failles de securite

| Severite | Probleme | Detail |
|----------|----------|--------|
| **CRITIQUE** | `/admin/data/*` sans auth | `admin-data.ts` ne call pas `authUser`/`adminOnly` — endpoints publics |
| **HIGH** | CORS `origin: "*"` | Pas de CSRF protection |
| **HIGH** | `gameState` JSON sans validation | Arbitrary JSON stocke et deserialise sans schema |
| **MEDIUM** | JWT_SECRET default | `"dev-secret-change-me"` si env var absente |
| **MEDIUM** | Rate limiting IP only | Pas de per-user rate limiting |
| **LOW** | `authUser` cast `any` | `jwt.verify() as any` perd la type safety |

### Schema Prisma — modeles manquants
- Pas de table matchmaking queue
- Pas de champs ELO/rating sur User
- Pas de modele Notification
- Schema SQLite de test diverge du Postgres prod (modeles manquants : TeamStarPlayer, Skill, Roster, etc.)
- `Match.summary` route retourne score hardcode `{ teamA: 0, teamB: 0 }`

---

## 4. Contenu

### Rosters
- **Season 2** : 30 equipes, 156 positions
- **Season 3** : 29 equipes, 155 positions (Slann manquant)
- S3 sans descriptions (`descriptionFr`/`descriptionEn` absents)
- Slugs S3 en francais vs S2 en anglais (intentionnel, source mordorbihan.fr)

### Star Players
- **67 star players** definis dont 4 Mega Stars
- **7/67** ont des `specialRule` redigees, les 60 autres ont un fallback generique
- Zero implementation mecanique des regles speciales
- S3 = clone de S2 (`cloneStarPlayersMap`), pas de star players specifiques S3
- 3 regional rules definies mais aucun star player ne les utilise comme `hirableBy`

### Images Star Players
- 34 images sur disque, ~28 star players sans image
- Bug encodage : Morg 'n' Thorg utilise apostrophe ASCII dans imageUrl mais le fichier a un Unicode curly quote
- 6 star players pointent vers `Fungus-the-Loon.webp` comme placeholder alors qu'ils ont leur propre image

### Skills
- 126 definitions (105 S2 + 21 S3)
- Toutes ont des descriptions FR+EN
- 86 entries dans `static-skills-data.ts` pour le seed DB
- ~45 skills utilises dans les rosters/star players n'ont aucun effet mecanique

### Meteo & Kickoff
- 12 types de meteo, 43 conditions uniques, 37/43 gerees mecaniquement
- 2 conditions manquantes : `Affaissement du plafond`, `Ames errantes en colere`
- 11 kickoff events, 4 delegues au UI sans implementation (perfect-defence, high-kick, quick-snap, blitz)
- Cheering fans : dedicated fans hardcode a 0
