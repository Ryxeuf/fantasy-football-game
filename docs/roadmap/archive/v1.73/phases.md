# Phases de Developpement

> Derniere mise a jour : 2026-04-27 (resync apres Sprint 23)
> Voir [audit-report.md](./audit-report.md) pour le detail des constats initiaux (2026-04-02).
> Voir [evolution-analysis-2026-04-12.md](./evolution-analysis-2026-04-12.md) pour le plan sprints 12-20.
> Voir [TODO.md](../../TODO.md) pour la table des sprints (Sprint 0 a Sprint 23) et le resume par phase.
>
> **Note 2026-04-27** : recompte des cases `[x]` apres re-audit code (CHANGELOG + skill-registry + routes ligues + ecrans mobile + sprints 12-23). Phases A a Q toutes marquees TERMINE selon le bilan TODO.md. Les dettes mineures (UI pour throw-team-mate, badge connexion, decay) sont consignees comme suivi qualite plutot que blocages roadmap.

---

## Phase A — Multijoueur temps reel (TERMINEE)

> socket.io complet : auth JWT + rooms par matchId + broadcast gameState + reconnexion exponential backoff + fallback polling.
> Hook `useGameSocket` cote client, notifications "votre tour" (toast/son/title/Notification API).

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| A.1 | Installer socket.io sur le serveur Express | Fort | Facile | [x] | Implemente dans #83 |
| A.2 | Creer les rooms par matchId | Fort | Facile | [x] | `socket.join(matchId)` + connect/disconnect |
| A.3 | Authentifier les connexions WebSocket | Fort | Moyen | [x] | Middleware JWT sur namespace `/game` |
| A.4 | Emettre le gameState apres chaque action | Fort | Moyen | [x] | `broadcastGameState` apres `applyMove` (`services/move-processor.ts`, event `game:state-updated`) |
| A.5 | Client socket.io dans le composant de jeu | Fort | Moyen | [x] | Hook `apps/web/app/play/[id]/hooks/useGameSocket.ts` |
| A.6 | Synchroniser les actions via WebSocket | Fort | Moyen | [x] | `game:submit-move` cote client → `processMove` serveur → broadcast |
| A.7 | Gerer la reconnexion WebSocket | Moyen | Moyen | [x] | Exponential backoff (500ms→10s, 15 tentatives) + resync complet |
| A.8 | Fallback polling si WebSocket echoue | Moyen | Facile | [x] | Polling 3s + `submitMoveWithFallback` HTTP |
| A.9 | Indicateur de connexion (online/offline) | Moyen | Facile | [x] | `wsConnected` expose dans `useGameState`, `ForfeitWarning` pour deconnexion adverse |
| A.10 | Notification "C'est votre tour" via WS | Fort | Facile | [x] | `useTurnNotification` : toast + audio + Notification API + tab title |

---

## Phase B — Regles BB3 (TERMINEE)

### B0 — Architecture skills (prerequis)

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| B0.1 | Brancher `skill-registry.ts` dans le moteur | Fort | Moyen | [x] | `skill-bridge.ts` + `collectModifiers` cable dans blocking/movement/passing/foul (Sprint 1) |
| B0.2 | Fixer le slug mismatch `sidestep` vs `side-step` | Fort | Facile | [x] | Normalisation lowercase + remplacement `_` → `-` dans `getSkillEffect()` |

### B1 — Regles critiques (impact chaque match)

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| B1.1 | Crowd push (surf) | Fort | Moyen | [x] | Sprint 0 — `handleInjuryByCrowd()` cable dans `blocking.ts` |
| B1.2 | Apothecaire — modele et logique | Fort | Moyen | [x] | `apothecary.ts` — 1 util/match, re-roll casualty, choix resultat |
| B1.3 | Apothecaire — UI popup de choix | Fort | Facile | [x] | Modal cable cote web (Sprint 2) |
| B1.4 | Regeneration (skill) | Moyen | Facile | [x] | `regeneration.ts` — D6 4+ apres KO/casualty, applique avant apothicaire |
| B1.5 | Loner (3+/4+/5+) reroll limitation | Moyen | Facile | [x] | `loner-3/4/5` enregistres dans skill-registry + tests |
| B1.6 | Wrestle | Fort | Facile | [x] | BOTH_DOWN → PRONE sans armor roll (`wrestle.test.ts`) |
| B1.7 | Procedure mi-temps complete | Fort | Moyen | [x] | KO recovery + reset positions + re-kickoff + UI transition (Sprint 2) |
| B1.8 | Procedure fin de match | Fort | Moyen | [x] | SPP + MVP + winnings/fan factor + ecran resultats `PostMatchSPP.tsx` |
| B1.9 | Post-touchdown : re-setup + re-kickoff | Fort | Moyen | [x] | `handlePostTouchdown()` — re-setup complet + re-kickoff auto |
| B1.10 | Timer de tour (optionnel) | Moyen | Moyen | [x] | Countdown configurable + fin de tour auto (Sprint 5) |

### B2 — Regles importantes (certains matchs)

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| B2.1 | Inducements — liste et effets | Fort | Difficile | [x] | `inducements.ts` — 9 types, validation CTV, effets appliques |
| B2.2 | Inducements — UI selection pre-match | Fort | Moyen | [x] | `InducementSelector.tsx` + `PreMatchSummary.tsx` + `LocalMatchInducements.tsx` |
| B2.3 | Prayers to Nuffle — 16 effets | Moyen | Moyen | [x] | `prayers-to-nuffle.ts` — 16 effets D16 reels (treacherous-trapdoor, friends-with-ref, stiletto, iron-man, etc.) |
| B2.4 | Throw Team-Mate | Moyen | Difficile | [x] | `throw-team-mate.ts` — modele complet, scatter, atterrissage + injury roll |
| B2.5 | Secret Weapons — expulsion fin de drive | Moyen | Facile | [x] | `secret-weapons.ts` — expulsion + bribe defense D6 2+ |
| B2.6 | Sweltering Heat — retrait aleatoire | Moyen | Facile | [x] | Connexion flow verifiee (Sprint 11) |
| B2.7 | Animosity — jet avant passe/handoff | Moyen | Facile | [x] | `animosity.ts` — D6 check + lineage extraction |
| B2.8 | Decay (skill) | Faible | Facile | [x] | Blessures aggravees (Sprint 22+) |
| B2.9 | Hypnotic Gaze | Faible | Moyen | [x] | `hypnotic-gaze.ts` — D6 2+, cible perd tackle zone |
| B2.10 | Projectile Vomit | Faible | Moyen | [x] | `projectile-vomit.ts` — D6 2+, knockdown + armor + injury |

### B3 — Star Players special rules

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| B3.1 | Implementer regles speciales Mega Stars | Moyen | Difficile | [x] | Effets mecaniques cables (Sprints 14, 20-21) — voir aussi P2.8 et O.2 |
| B3.2 | UI affichage regles speciales | Moyen | Facile | [x] | Tooltip/popup catalogues web et mobile |

---

## Phase C — Matchmaking & flow en ligne (TERMINEE)

> Sprint 3-6. Queue TV ±150k, prematch automatise, post-match SPP, forfait WS.

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

## Phase E — Animations & experience web (TERMINEE)

> Board web et mobile : tweens deplacement/balle, file d'attente, effets blocage/TD/blessure, animation des.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| E.1 | Tween deplacement joueur | Fort | Moyen | [x] | `useAnimatedPositions` MOVE_DURATION_MS=200ms + easeOutCubic |
| E.2 | Tween balle (passe/scatter) | Fort | Moyen | [x] | BALL_DURATION_MS=250ms + arc trajectoire (Sprint 9) |
| E.3 | File d'attente d'animations | Moyen | Moyen | [x] | `AnimationQueue` Promise-based + enqueueParallel |
| E.4 | Animation de blocage | Moyen | Moyen | [x] | `blockEffects.ts` — shake damped + flash alpha |
| E.5 | Animation de touchdown | Moyen | Facile | [x] | `touchdownEffects.ts` — flash + particules endzone |
| E.6 | Animation de blessure | Moyen | Facile | [x] | `injuryEffects.ts` — icones KO/casualty/mort |
| E.7 | Animation de des | Moyen | Moyen | [x] | `diceEffects.ts` — TUMBLE_PHASE_MS=600ms (Sprint 9) |

---

## Phase F — ELO & classement (TERMINEE)

> ELO Sprint 4, leaderboard pagine, ELO saisonnier (L.8) ajoute en Sprint 17.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| F.1 | Champ ELO sur User (Prisma) | Moyen | Facile | [x] | `eloRating Int @default(1000)` |
| F.2 | Calcul ELO apres match | Moyen | Moyen | [x] | `elo-update.ts` + `calculateEloChange` (K=32) |
| F.3 | Page leaderboard | Moyen | Moyen | [x] | `apps/web/app/leaderboard/page.tsx` (web) + `apps/mobile/app/leaderboard.tsx` (mobile) |
| F.4 | ELO dans profil et lobby | Moyen | Facile | [x] | Affichage profil + lobby (Sprint 4) |

---

## Phase G — Notifications push (TERMINEE)

> Service Worker + web-push + integration "votre tour" / "match trouve" + preferences (Sprint 7).

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| G.1 | Service Worker push | Fort | Moyen | [x] | `apps/web/public/sw.js` |
| G.2 | Endpoint serveur web-push | Fort | Moyen | [x] | `apps/server/src/routes/push.ts` (vapid + sendPushToUser) |
| G.3 | Push "C'est votre tour" | Fort | Facile | [x] | Hook into game flow (Sprint 7) |
| G.4 | Push "Match trouve" | Fort | Facile | [x] | Hook into matchmaking (Sprint 7) |
| G.5 | UI permission + preferences | Moyen | Facile | [x] | `usePushNotifications` + UI prefs |

---

## Phase H — Polish & qualite de vie (TERMINEE)

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| H.1 | Chat in-game | Moyen | Moyen | [x] | `useGameChat` (Sprint 8) |
| H.2 | Mode spectateur | Moyen | Moyen | [x] | `apps/web/app/spectate/[id]/page.tsx` |
| H.3 | Replayer basique | Moyen | Moyen | [x] | `apps/web/app/replay/[id]/page.tsx` + `useReplayControls` |
| H.4 | Indicateurs tactiques | Moyen | Moyen | [x] | Overlay tactique (Sprint 9) |
| H.5 | Sons (effets sonores) | Moyen | Moyen | [x] | `useSoundEffects` + sound-manager |
| H.6 | Sprite sheets par equipe | Moyen | Moyen | [x] | Sprite manifest registry + UI resolver + PixiBoard integration (Sprint 10) |
| H.7 | Variantes terrain | Faible | Moyen | [x] | `terrain-skins.ts` — herbe/ruine/neige (Sprint 11) |

---

## Phase I — Contenu & donnees (TERMINEE)

> Audit contenu 2026-04-02 nettoye en Sprints 8, 10, 11.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| I.1 | Ajouter roster Slann en Season 3 | Faible | Facile | [x] | Sprint 10 |
| I.2 | Descriptions S3 rosters | Faible | Moyen | [x] | `descriptionFr`/`descriptionEn` ajoutes |
| I.3 | Fixer images star players manquantes (~28) | Moyen | Moyen | [x] | Sprint 10 |
| I.4 | Fixer bug encodage Morg 'n' Thorg image | Faible | Facile | [x] | Sprint 10 |
| I.5 | Fixer placeholders images (6 star players) | Faible | Facile | [x] | Sprint 10 |
| I.6 | Rediger les 60 specialRule star players manquantes | Moyen | Difficile | [x] | Sprint 11 (voir aussi P2.8 et O.2 pour effets mecaniques) |
| I.7 | Star players specifiques Season 3 | Moyen | Moyen | [x] | Overrides + Slann regional rules (Sprint 11) |
| I.8 | Fixer 2 conditions meteo manquantes | Faible | Facile | [x] | Affaissement plafond + Ames errantes |
| I.9 | Implementer 4 kickoff events delegues UI | Moyen | Moyen | [x] | perfect-defence, high-kick, quick-snap, blitz (Sprint 9) |
| I.10 | Fixer cheering fans dedicated fans a 0 | Faible | Facile | [x] | Sprint 8 |

---

## Phase J — Traits negatifs & equilibre equipes (TERMINEE)

> Sprints 12-13 + 20-21. Tous les traits negatifs sont enregistres dans `skill-registry.ts` avec mecaniques cablees (D6 activation roll dans `applyMove`).

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| J.1 | Implementer `bone-head` | Fort | Facile | [x] | skill-registry.ts L706 — Sprint 12 |
| J.2 | Implementer `really-stupid` (1/2) | Fort | Facile | [x] | skill-registry.ts L717+724 (2 variantes) — Sprint 12 |
| J.3 | Implementer `wild-animal` | Fort | Facile | [x] | skill-registry.ts L735 — Sprint 12 |
| J.4 | Implementer `animal-savagery` | Fort | Moyen | [x] | skill-registry.ts L746 — Sprint 12 |
| J.5 | Implementer `take-root` | Fort | Facile | [x] | skill-registry.ts L780 — Sprint 12 |
| J.6 | Implementer `no-hands` | Fort | Facile | [x] | skill-registry.ts L831 — Sprint 12 |
| J.7 | Implementer `right-stuff` | Fort | Facile | [x] | skill-registry.ts L843 — Sprint 12 |
| J.8 | Implementer `bloodlust` (3 variantes) | Fort | Moyen | [x] | skill-registry.ts L1084/1091/1098 — Sprint 13/20-21 |
| J.9 | Implementer `always-hungry` | Fort | Facile | [x] | skill-registry.ts L1111 — Sprint 13/20-21 |
| J.10 | Implementer `foul-appearance` | Fort | Facile | [x] | skill-registry.ts L869 — Sprint 13/20-21 |
| J.11 | Implementer `instable` | Moyen | Facile | [x] | skill-registry.ts L1039 — Sprint 13/20-21 |

---

## Phase K — Skills a fort impact (TERMINEE)

> Sprints 13-15 + 20-21. Tous les skills a fort impact ont une entree skill-registry + mecanique cablee.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| K.1 | Implementer `leap` + `pogo-stick` | Fort | Moyen | [x] | skill-registry.ts L920 (leap) + L1139 (pogo-stick) |
| K.2 | Implementer `stab` | Fort | Moyen | [x] | skill-registry.ts L932 |
| K.3 | Implementer `chainsaw` | Fort | Moyen | [x] | skill-registry.ts L996 |
| K.4 | Implementer `dump-off` | Fort | Moyen | [x] | skill-registry.ts L983 |
| K.5 | Implementer `on-the-ball` | Moyen | Facile | [x] | skill-registry.ts L958 (audit P1.11) |
| K.6 | Implementer `kick` | Moyen | Facile | [x] | skill-registry.ts L856 — Sprint 14 |
| K.7 | Implementer `sneaky-git` | Moyen | Facile | [x] | skill-registry.ts L300 — Sprint 14 |
| K.8 | Implementer `defensive` | Moyen | Facile | [x] | skill-registry.ts L191 — Sprint 14 |
| K.9 | Implementer `disturbing-presence` | Moyen | Facile | [x] | skill-registry.ts L908 — Sprint 14 |
| K.10 | Implementer `multiple-block` | Moyen | Moyen | [x] | skill-registry.ts L1011 |
| K.11 | Implementer `hail-mary-pass` + `safe-pass` | Moyen | Moyen | [x] | skill-registry.ts L883 (hail-mary) + L895 (safe-pass) + legal moves (PR #324) |
| K.12 | Implementer `ball-and-chain` | Fort | Moyen | [x] | skill-registry.ts L769 — Goblin Fanatic |
| K.13 | Implementer `bombardier` | Fort | Moyen | [x] | skill-registry.ts L757 — Goblin Bomma |

---

## Phase L — Systeme de ligues (TERMINEE)

> Sprint 17 — killer feature competitive livree.
> Fichiers : `prisma/schema.prisma` (League/LeagueSeason/LeagueParticipant/LeagueRound), `apps/server/src/routes/league.ts`, `apps/server/src/services/league.ts`, `apps/web/app/leagues/`.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| L.1 | Modeles Prisma League/Season/Participant/Round | Fort | Moyen | [x] | `schema.prisma` L637-721 (PR #266) |
| L.2 | Migration Prisma + seed data | Fort | Facile | [x] | Seed "Open 5 Teams" (PR #267) |
| L.3 | Routes API CRUD ligue | Fort | Difficile | [x] | `routes/league.ts` (create/list/join/schedule/standings/withdraw, PR #271) |
| L.4 | Generateur de calendrier round-robin | Fort | Moyen | [x] | PR #273 |
| L.5 | Page liste des ligues | Fort | Moyen | [x] | `apps/web/app/leagues/page.tsx` (PR #275) |
| L.6 | Page detail ligue | Fort | Difficile | [x] | SeasonCalendar + SeasonStandings + SeasonParticipants (PR #276) |
| L.7 | Integration match -> ligue | Fort | Moyen | [x] | Match.leagueSeasonId/leagueRoundId + resultats auto (PR #277) |
| L.8 | ELO saisonnier avec reset | Moyen | Moyen | [x] | seasonElo dans LeagueParticipant + reset/placements (PR #278) |
| L.9 | Ligue demarrage "Open 5 Teams" | Moyen | Moyen | [x] | allowedRosters service-side restriction (PR #279) |

---

## Phase M — Parite mobile (TERMINEE)

> Sprint 18-19 — parite mobile livree. Ecrans complets dans `apps/mobile/app/`.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| M.1 | Ecrans gestion d'equipe | Fort | Difficile | [x] | `apps/mobile/app/teams/` (index, new, [id], edit) — PR #283 |
| M.2 | Ecran queue matchmaking | Fort | Moyen | [x] | `apps/mobile/app/matchmaking.tsx` — PR #290 |
| M.3 | Integration WebSocket complete | Fort | Moyen | [x] | Socket.io client + reconnexion — PR #291 |
| M.4 | Popups block/push/followup/reroll | Fort | Moyen | [x] | Composants natifs touch-friendly — PR #292 |
| M.5 | Chat in-game mobile | Moyen | Facile | [x] | Bulle overlay — PR #293 |
| M.6 | Ecran leaderboard | Moyen | Facile | [x] | `apps/mobile/app/leaderboard.tsx` — PR #294 |
| M.7 | Ecran replay de match | Moyen | Moyen | [x] | `apps/mobile/app/replay/[id].tsx` — PR #296 |
| M.8 | Ecrans cups/ligues | Moyen | Moyen | [x] | `apps/mobile/app/cups/` + `leagues/` — PR #299 |
| M.9 | Push notifications natives | Moyen | Moyen | [x] | Expo Notifications — PR #300 |
| M.10 | Details joueur et progression | Moyen | Moyen | [x] | Stats/SPP/blessures/level-up — PR #302 |
| M.11 | Catalogue Star Players | Faible | Facile | [x] | `apps/mobile/app/star-players/` — PR #303 |
| M.12 | Profil et settings | Faible | Facile | [x] | `apps/mobile/app/settings.tsx` — PR #304 |

---

## Phase N — Croissance & engagement (TERMINEE)

> Sprints 15-16. Onboarding (tutoriel + IA) et retention (amis + achievements + historique) livres.
> Fichiers : `rules-config.ts` (SIMPLIFIED_RULES), `packages/game-engine/src/ai/`, `prisma/schema.prisma` (Friendship, UserAchievement).

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| N.1 | Tutoriel interactif | Fort | Difficile | [x] | Match guide pas a pas — PR #250 |
| N.2 | Mode simplifie debutants | Fort | Moyen | [x] | `SIMPLIFIED_RULES` cable cote UI — PR #251 |
| N.3 | IA adversaire (heuristique) | Fort | Tres Diff | [x] | Evaluation positionnelle + scoring coups — PR #253 |
| N.4 | Mode pratique contre IA | Fort | Moyen | [x] | 3 niveaux de difficulte — PR #254 |
| N.4b | IA contrainte aux 5 equipes prioritaires | Moyen | Facile | [x] | PR #255 |
| N.5 | Systeme d'amis | Moyen | Difficile | [x] | `Friendship` model + `routes/friends.ts` — PR #258 |
| N.6 | Historique matchs + stats carriere | Moyen | Moyen | [x] | Par equipe / par joueur (commit 3ff6ba4) |
| N.7 | Systeme d'achievements | Moyen | Difficile | [x] | UserAchievement + catalogue (commit 564b173) |
| N.8 | Badges "Maitre" par equipe prioritaire | Faible | Facile | [x] | Gagner X matchs avec chaque equipe prioritaire — PR #264 |

---

## Phase O — Contenu & polish final (TERMINEE)

> Sprints 20-22. Couverture skills/star players completee, perf et qualite normalisees.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| O.1 | ~39 skills niche restants (batch 3) | Moyen | Difficile | [x] | Batches 3a-3u — PR #313 a #337 (closes O.1) |
| O.2 | Star player special rules (~30 restantes) | Moyen | Moyen | [x] | specialRuleEn 21 stars (PR #312) + traits registry stars S3 (PR #335-336) |
| O.3 | Verification differences regles S3 | Moyen | Moyen | [x] | Audit S2 vs S3 + register running-pass-2025 — PR #338 |
| O.4 | Expansion E2E tests (80% coverage) | Moyen | Difficile | [x] | Vitest coverage + Playwright specs etendus (Sprint 22+) |
| O.5 | Optimisation GameState (separer gameLog) | Moyen | Moyen | [x] | gameLog separe, diffs par tour |
| O.6 | Standardiser error handling | Moyen | Moyen | [x] | `ApiResponse<T>` uniforme |
| O.7 | Optimiser queries DB | Moyen | Moyen | [x] | Pagination + select + indexes |
| O.8a | Generateur de noms d'equipe par roster | Faible | Moyen | [x] | Service + endpoint |
| O.8b | Cosmetiques visuels (logos, assets) | Faible | Moyen | [x] | Logos equipe + assets graphiques |
| O.9 | Features communautaires | Faible | Difficile | [x] | Match of the week, Discord, profils coach |
| O.10 | Dashboard analytics | Faible | Moyen | [x] | Stats perso et globales |

---

## Phase P1 — Skills intrinseques 5 equipes prioritaires (TERMINEE)

> Sprint 13. Tous les skills presents de base sur les rosters Skaven, Gnomes, Hommes-Lezards, Nains, Noblesse Imperiale.
> Objectif : chaque joueur des 5 rosters joue avec ses regles BB3 correctement appliquees.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| P1.1 | Implementer `stunty` | Fort | Moyen | [x] | Skinks, Lineman Gnome, joueurs petits |
| P1.2 | Implementer `dauntless` | Fort | Facile | [x] | Dwarf Troll Slayer |
| P1.3 | Implementer `break-tackle` | Fort | Moyen | [x] | Dwarf Deathroller (PR #215) |
| P1.4 | Implementer `juggernaut` | Fort | Moyen | [x] | Dwarf Deathroller |
| P1.5 | Implementer `stand-firm` | Fort | Facile | [x] | Deathroller, Bodyguard, Treeman Gnome |
| P1.6 | Implementer `armored-skull` | Fort | Facile | [x] | Dwarf Deathroller (PR #326) |
| P1.7 | Implementer `iron-hard-skin` | Fort | Facile | [x] | Gnomes : piston, beastmaster, treeman |
| P1.8 | Implementer `shadowing` | Fort | Moyen | [x] | Lizardmen Chameleon Skink (PR #226) |
| P1.9 | Implementer `fend` | Fort | Facile | [x] | Imperial Retainer Lineman (PR #227) |
| P1.10 | Implementer `running-pass` | Fort | Moyen | [x] | Imperial Thrower (PR #228) |
| P1.11 | Audit skills appliques aux 5 equipes | Fort | Moyen | [x] | prehensile-tail, frenzy, throw-team-mate, thick-skull, on-the-ball, loner (PR #229) |

---

## Phase P2 — Progression & Star Players 5 equipes (TERMINEE)

> Sprint 14. Skills selectionnables au level-up + toutes les star players hirables par les 5 equipes prioritaires.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| P2.1 | Implementer `kick` | Moyen | Facile | [x] | Pris en progression universelle (PR #242) |
| P2.2 | Implementer `defensive` | Moyen | Facile | [x] | Progression universelle (PR #243) |
| P2.3 | Implementer `disturbing-presence` | Moyen | Facile | [x] | Progression universelle (PR #244) |
| P2.4 | Implementer `leap` (progression) | Moyen | Moyen | [x] | Saurus progression frequente |
| P2.5 | Implementer `dump-off` (progression) | Moyen | Moyen | [x] | Imperial / Skaven Thrower progression |
| P2.6 | Implementer `sneaky-git` (progression) | Moyen | Facile | [x] | Dwarf Troll Slayer progression (PR #245) |
| P2.7 | Lister star players hirables 5 equipes | Faible | Facile | [x] | Flag `hirableBy` (PR #246) |
| P2.8 | Special rules star players 5 equipes | Moyen | Moyen | [x] | ~15-25 stars enrichies (PR #247) |
| P2.9 | Images + descriptions FR/EN star players | Faible | Moyen | [x] | PR #248 |
| P2.10 | Tests unitaires special rules stars | Moyen | Moyen | [x] | 5 equipes prioritaires |

---

## Phase Q — SEO, GEO & rayonnement (TERMINEE)

> Sprint 23. Visibilite moteurs classiques (Google, Bing) et generatifs / LLM (ChatGPT, Claude, Perplexity, Gemini, Apple Intelligence). Acquisition organique zero-budget.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| Q.1 | Refresh homepage (chiffres, FAQ visible) | Moyen | Facile | [x] | Feature flags respectes |
| Q.2 | Metadata Next.js enrichies | Moyen | Facile | [x] | hreflang fr/en/x-default, canonical, geo FR, applicationName |
| Q.3 | JSON-LD homepage `@graph` | Moyen | Moyen | [x] | Organization + WebSite + WebApplication + FAQPage |
| Q.4 | `robots.txt` + `app/robots.ts` consolides | Faible | Facile | [x] | Pages publiques allow, zones privees disallow |
| Q.5 | Sitemap enrichi | Moyen | Facile | [x] | Skills, support, legales, tutoriels, teams/[slug], star-players/[slug] |
| Q.6 | `llms.txt` + `llms-full.txt` | Moyen | Facile | [x] | Standard llmstxt.org avec faits citables |
| Q.7 | Regles 20 crawlers IA | Moyen | Facile | [x] | GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, CCBot... |
| Q.8 | `sameAs` + `knowsAbout` + `dateModified` | Moyen | Facile | [x] | Citabilite LLM dans JSON-LD |
| Q.9 | `manifest.json` enrichi | Faible | Facile | [x] | Shortcuts PWA : equipes, rosters, stars |
| Q.10 | Metadata + JSON-LD `SportsTeam` | Moyen | Moyen | [x] | `/teams/[slug]` (31 pages) |
| Q.11 | Metadata + JSON-LD `Person`/`SportsAthlete` | Moyen | Moyen | [x] | `/star-players/[slug]` (~67 pages) |
| Q.12 | Metadata + JSON-LD `ItemList`/`DefinedTermSet` | Moyen | Moyen | [x] | `/skills` (130+ entries citables) |
| Q.13 | `BreadcrumbList` JSON-LD | Faible | Facile | [x] | Pages profondes (teams, stars, skills, tutoriel) |
| Q.14 | OG images dynamiques par page | Moyen | Moyen | [x] | `ImageResponse` Next.js — PR #393 |
| Q.15 | Page `/a-propos` citable | Moyen | Moyen | [x] | Histoire, chiffres, equipe, roadmap publique |
| Q.16 | Blog/changelog public + flux RSS | Moyen | Moyen | [x] | `/feed.xml` signal de fraicheur LLM |
| Q.17 | Codes verification webmasters | Faible | Facile | [x] | Google Search Console, Bing, Yandex |
| Q.18 | Soumission sitemap + monitoring | Moyen | Moyen | [x] | Search Console + Bing Webmaster Tools |
| Q.19 | Umami events cles | Moyen | Facile | [x] | Clic equipe, recrut star player, export PDF, support CTA |
| Q.20 | Core Web Vitals monitoring | Moyen | Moyen | [x] | LCP, INP, CLS + budget perf CI |
| Q.21 | Audit A11y WCAG AA | Moyen | Difficile | [x] | Contraste, labels, navigation clavier, focus rings |
| Q.22 | `humans.txt` + `security.txt` | Faible | Facile | [x] | Bonnes pratiques, contact securite |
| Q.23 | Wikidata / ebauche Wikipedia | Faible | Difficile | [x] | Renforcement identite d'entite |
| Q.24 | Schema.org `Event` tournois/ligues | Faible | Moyen | [x] | Quand online_play sera ouvert |
| Q.25 | Protocole de test "presence IA" | Moyen | Moyen | [x] | Prompts de reference + suivi mensuel — PR #390 |
| Q.26 | Strategie liens entrants | Moyen | Difficile | [x] | r/bloodbowl, TalkFantasyFootball, blog Mordorbihan, Discord BB — PR #391 |
| Q.27 | Hreflang par page | Moyen | Moyen | [x] | Alternates canoniques fr/en, helper centralise — PR #392 |
