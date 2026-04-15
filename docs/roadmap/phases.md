# Phases de Developpement

> Derniere mise a jour : 2026-04-02
> Voir [audit-report.md](./audit-report.md) pour le detail des constats.

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
| C.1 | Page "Jouer en ligne" avec bouton recherche | Fort | Moyen | [~] | Route /play existe. Manque : selection equipe, "Chercher un match" |
| C.2 | File d'attente matchmaking (queue) | Fort | Moyen | [ ] | Table MatchQueue en DB, matching TV +/- 150k |
| C.3 | Matching automatique + creation match | Fort | Moyen | [ ] | Cron ou check a chaque join |
| C.4 | Notification match trouve | Fort | Facile | [ ] | Event WS `matchmaking:found` |
| C.5 | Phase de setup en ligne | Fort | Moyen | [ ] | Placement joueurs, bouton "Pret" |
| C.6 | Sequence pre-match automatisee | Fort | Moyen | [~] | Moteur existe. Manque : inducements/prayers reels, UI online |
| C.7 | Fin de match en ligne (resultats) | Fort | Moyen | [ ] | Ecran recap adapte de `PostMatchSPP.tsx` |
| C.8 | Abandon / deconnexion = defaite | Moyen | Facile | [ ] | Forfait si quitte > 2 min |

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
| I.9 | Implementer 4 kickoff events delegues UI | Moyen | Moyen | [x] | perfect-defence, high-kick, quick-snap, blitz |
| I.10 | Fixer cheering fans dedicated fans a 0 | Faible | Facile | [ ] | Hardcode dans kickoff-events.ts |
