# TODO — Nuffle Arena (Blood Bowl 3 Online)

> Backlog priorise par valeur (Gain) et effort (Difficulte).
> Derniere mise a jour : 2026-03-29
>
> **Objectif** : jouer en ligne a Blood Bowl avec les regles BB3 (Season 2/3).
>
> **Legende :**
> - **Gain** : Fort | Moyen | Faible — Impact utilisateur / valeur business
> - **Difficulte** : Facile (< 1j) | Moyen (1-3j) | Difficile (> 3j)
> - **Statut** : `[ ]` a faire | `[x]` termine | `[~]` en cours

---

## Etat des lieux (audit 2026-03-29)

### Ce qui est fait
- Moteur de jeu complet : plateau 26x15, mouvement, blocage, passes, fautes, blessures, blitz, GFI
- 35+ skills implementes (Block, Dodge, Tackle, Sure Hands, Frenzy, Guard, Mighty Blow, etc.)
- 120+ skills definis dans le registre (noms, descriptions, categories)
- 32 rosters BB3 avec toutes les positions
- 100+ Star Players avec stats et couts
- Zones de tacle, effets meteo (12 types), kickoff events (11 evenements)
- Sequence pre-match (fan factor, meteo, journeymen, coin toss)
- Auth JWT complete + rate limiting
- Base de donnees Prisma (User, Match, Turn, Team, Cup, etc.)
- Board Pixi.js avec zoom/pan, HUD, popups, dugout, game log
- Lobby de match avec invitations par token
- Admin panel complet
- i18n FR/EN
- Docker + CI/CD + Traefik SSL
- 200+ tests unitaires

### Ce qui manque pour jouer en ligne avec les regles BB3
1. **Multijoueur temps reel** : pas de WebSocket, uniquement polling/tokens
2. **Regles BB3 manquantes** : crowd push, apothecaire, inducements fonctionnels, prayers to Nuffle, regeneration, throw team-mate, secret weapons
3. **Matchmaking** : pas de file d'attente, pas de recherche de match
4. **Progression** : pas de SPP fonctionnel, pas de level-up, pas de campagne
5. **Animations** : pas de tweens (mouvement, passe, bloc), experience statique
6. **Game flow** : pas de timer de tour, pas de procedure mi-temps complete

---

## Phase A — Multijoueur temps reel (CRITIQUE)

> Sans ca, impossible de jouer en ligne. C'est le prerequis #1.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| A.1 | Installer socket.io sur le serveur Express | Fort | Facile | [ ] | `pnpm add socket.io`, attach au serveur HTTP existant, namespace `/game` |
| A.2 | Creer les rooms par matchId | Fort | Facile | [ ] | `socket.join(matchId)`, gestion connect/disconnect |
| A.3 | Authentifier les connexions WebSocket | Fort | Moyen | [ ] | Middleware socket.io qui verifie le JWT, associe `socket.userId` |
| A.4 | Emettre le gameState apres chaque action | Fort | Moyen | [ ] | Apres `executeMove()`, broadcast `game:state-update` a la room |
| A.5 | Client socket.io dans le composant de jeu | Fort | Moyen | [ ] | Hook `useGameSocket(matchId)` qui connecte et ecoute `game:state-update` |
| A.6 | Synchroniser les actions via WebSocket | Fort | Moyen | [ ] | Client envoie `game:action` au serveur, serveur valide et broadcast |
| A.7 | Gerer la reconnexion WebSocket | Moyen | Moyen | [ ] | Exponential backoff, resync du gameState complet au reconnect |
| A.8 | Fallback polling si WebSocket echoue | Moyen | Facile | [ ] | Detection deconnexion WS, bascule sur GET /match/:id/state toutes les 3s |
| A.9 | Indicateur de connexion (online/offline) | Moyen | Facile | [ ] | Badge vert/rouge dans le HUD pour chaque joueur |
| A.10 | Notification "C'est votre tour" via WS | Fort | Facile | [ ] | Event `game:your-turn` avec toast + son optionnel |

---

## Phase B — Regles BB3 manquantes (gameplay complet)

> Regles essentielles pour un match BB3 fidele.

### B1 — Regles critiques (impact chaque match)

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| B1.1 | Crowd push (surf) | Fort | Moyen | [ ] | Quand un joueur est pousse hors du terrain : jet d'armure+blessure par la foule |
| B1.2 | Apothecaire — modele et logique | Fort | Moyen | [ ] | 1 utilisation/match, choix entre 2 resultats de blessure, popup choix |
| B1.3 | Apothecaire — UI popup de choix | Fort | Facile | [ ] | Modal "Utiliser l'apothecaire ? Resultat actuel vs re-roll" |
| B1.4 | Regeneration (skill) | Moyen | Facile | [ ] | Apres casualty, jet 4+ pour revenir en reserve au lieu du banc |
| B1.5 | Loner (3+/4+/5+) reroll limitation | Moyen | Facile | [ ] | Avant chaque team reroll, jet Loner requis (echoue = reroll perdu) |
| B1.6 | Both Down — choix Block vs Wrestle | Fort | Facile | [ ] | Si les 2 joueurs ont Block/Wrestle, popup pour choisir l'effet |
| B1.7 | Procedure mi-temps complete | Fort | Moyen | [ ] | Recovery KO (4+ par joueur), reset positions, re-kickoff |
| B1.8 | Procedure fin de match | Fort | Moyen | [ ] | MVP aleatoire (+4 SPP), winnings (fan factor), blessures permanentes appliquees |
| B1.9 | Timer de tour (optionnel) | Moyen | Moyen | [ ] | Countdown configurable (2/3/4 min), fin de tour auto a expiration |

### B2 — Regles importantes (affectent certains matchs)

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| B2.1 | Inducements — liste et effets | Fort | Difficile | [ ] | Bloodweiser Kegs (KO recovery +1), Bribery (evite expulsion), Wandering Apothecary, Wizard (lightning/fireball) |
| B2.2 | Inducements — UI selection pre-match | Fort | Moyen | [ ] | Page de depense petty cash avec catalogue inducements |
| B2.3 | Prayers to Nuffle — 16 effets | Moyen | Moyen | [ ] | Table d6+d8, effets reels (reroll gratuit, +1 MA temporaire, etc.) |
| B2.4 | Throw Team-Mate — mecanique complete | Moyen | Difficile | [ ] | Jet de passe special, landing 2+ avec scatter, crash si rate |
| B2.5 | Secret Weapons — expulsion fin de drive | Moyen | Facile | [ ] | Chainsaw, Bomb, Ball & Chain : expulses en fin de drive sauf Bribe |
| B2.6 | Sweltering Heat — retrait aleatoire | Moyen | Facile | [ ] | D6 par joueur au setup, 1 = mis en reserve pour le drive |
| B2.7 | Animosity — jet avant passe/handoff | Moyen | Facile | [ ] | Si le receveur est d'une race differente, 2+ sinon refus |
| B2.8 | Decay (skill) | Faible | Facile | [ ] | Blessures 1 niveau plus grave sur la table casualty |
| B2.9 | Hypnotic Gaze | Faible | Moyen | [ ] | Action speciale : cible adjacente rate 2+ AG → perd tackle zone |
| B2.10 | Projectile Vomit | Faible | Moyen | [ ] | Action speciale : bloc range 1 avec jet special |

### B3 — Star Players special rules

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| B3.1 | Implementer les regles speciales Mega Stars | Moyen | Difficile | [ ] | Chaque star player a des regles uniques (ex: Morg'th, Griff Oberwald) |
| B3.2 | UI affichage regles speciales dans le match | Moyen | Facile | [ ] | Tooltip/popup avec description de la regle speciale au survol |

---

## Phase C — Matchmaking & flow de jeu en ligne

> Pour trouver un adversaire et jouer un vrai match.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| C.1 | Page "Jouer en ligne" avec bouton recherche | Fort | Moyen | [ ] | Route /play, selection equipe, bouton "Chercher un match" |
| C.2 | File d'attente matchmaking (queue) | Fort | Moyen | [ ] | Table MatchQueue en DB, matching par TV similaire (+/- 150k) |
| C.3 | Matching automatique + creation match | Fort | Moyen | [ ] | Cron ou check a chaque join : si 2 joueurs compatibles, creer match |
| C.4 | Notification match trouve | Fort | Facile | [ ] | Event WS `matchmaking:found`, redirect vers le match |
| C.5 | Phase de setup en ligne (placement joueurs) | Fort | Moyen | [ ] | Chaque coach place ses joueurs sur sa moitie, bouton "Pret" |
| C.6 | Sequence pre-match automatisee en ligne | Fort | Moyen | [ ] | Fan factor, meteo, inducements, prayers enchaines avec UI |
| C.7 | Fin de match en ligne (resultats, stats) | Fort | Moyen | [ ] | Ecran recap : score, MVP, casualties, SPP gagnes |
| C.8 | Abandon / deconnexion = defaite | Moyen | Facile | [ ] | Si un joueur quitte > 2 min, victoire par forfait |

---

## Phase D — Progression des joueurs (campagne)

> Pour que les equipes evoluent entre les matchs.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| D.1 | SPP tracking en match | Fort | Facile | [x] | Compteur SPP par joueur : TD(3), Casualty(2), Completion(1), Interception(1), MVP(4) |
| D.2 | Ecran post-match : attribution SPP | Fort | Moyen | [x] | Liste joueurs avec SPP gagnes, MVP aleatoire highlight |
| D.3 | Level-up : choix de competence | Fort | Moyen | [x] | Quand SPP >= seuil, popup choix primary/secondary/random skill |
| D.4 | Table d'avancement BB3 | Fort | Facile | [x] | Seuils SPP par level (3, 4, 6, 8, 10...), cout TV par type |
| D.5 | Blessures permanentes persistees | Moyen | Moyen | [x] | Niggling Injury, -1 MA/ST/AG/PA appliques au roster |
| D.6 | Mort de joueur persistee | Moyen | Facile | [x] | Joueur marque comme mort, retire du roster |
| D.7 | Achat de remplacants entre matchs | Moyen | Moyen | [ ] | Winnings + tresorerie, achat joueurs/rerolls/apothecaire |
| D.8 | Journeymen automatiques si < 11 joueurs | Moyen | Facile | [x] | Deja en place dans le moteur, connecter a la persistence |

---

## Phase E — Animations & experience de jeu

> Pour que ce soit agreable a jouer (pas bloquant mais important).

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| E.1 | Tween deplacement joueur | Fort | Moyen | [ ] | Interpolation position 150-250ms avec easing, Pixi.js ticker |
| E.2 | Tween balle (passe/scatter) | Fort | Moyen | [ ] | Arc de trajectoire, duree proportionnelle a la distance |
| E.3 | File d'attente d'animations | Moyen | Moyen | [ ] | Systeme sequentiel Promise-based, skip avec touche Espace |
| E.4 | Animation de blocage (impact) | Moyen | Moyen | [ ] | Shake/flash sur la cible, visuel selon resultat (push/stun/KO) |
| E.5 | Animation de touchdown | Moyen | Facile | [ ] | Flash + particules sur la endzone, renforcer animation existante |
| E.6 | Animation de blessure | Moyen | Facile | [ ] | Icone KO/casualty/mort qui apparait au-dessus du joueur |
| E.7 | Animation de des | Moyen | Moyen | [ ] | Des 3D ou 2D animes avant affichage resultat |

---

## Phase F — ELO & classement

> Pour le competitif en ligne.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| F.1 | Champ ELO sur le modele User (Prisma) | Moyen | Facile | [ ] | `elo Int @default(1000)`, migration |
| F.2 | Calcul ELO apres chaque match | Moyen | Moyen | [ ] | K-factor 32, bonus/malus selon ecart TV, update en fin de match |
| F.3 | Page leaderboard | Moyen | Moyen | [ ] | Tableau top 100, recherche, filtres saison/global |
| F.4 | ELO affiche dans le profil et le lobby | Moyen | Facile | [ ] | Badge ELO a cote du pseudo dans le matchmaking et profil |

---

## Phase G — Notifications push

> Pour savoir quand c'est son tour sans garder l'onglet ouvert.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| G.1 | Service Worker pour push notifications | Fort | Moyen | [ ] | Enregistrement SW, subscription endpoint, stockage cote serveur |
| G.2 | Endpoint serveur envoi push (web-push) | Fort | Moyen | [ ] | Route POST /notifications/push, library web-push |
| G.3 | Push "C'est votre tour" | Fort | Facile | [ ] | Trigger apres chaque end turn adversaire |
| G.4 | Push "Match trouve" | Fort | Facile | [ ] | Trigger quand matchmaking trouve un adversaire |
| G.5 | UI demande permission + preferences | Moyen | Facile | [ ] | Modal permission + page /settings avec toggles |

---

## Phase H — Polish & qualite de vie

> Ameliorations non-bloquantes mais qui comptent.

| # | Tache | Gain | Diff | Statut | Detail |
|---|-------|------|------|--------|--------|
| H.1 | Chat in-game (messages predefinies) | Moyen | Moyen | [ ] | Messages rapides : "GG", "Nice!", "Ouch!", via WebSocket |
| H.2 | Mode spectateur | Moyen | Moyen | [ ] | Vue lecture seule d'un match en cours, liste spectateurs |
| H.3 | Replayer basique | Moyen | Moyen | [ ] | Slider de tours, recalcul gameState, boutons prev/next |
| H.4 | Indicateurs tactiques au survol | Moyen | Moyen | [ ] | Lignes de passe, trajectoires blitz au hover |
| H.5 | Sons (effets sonores) | Moyen | Moyen | [ ] | Web Audio API : impact bloc, sifflet, foule, touchdown |
| H.6 | Sprite sheets joueurs par equipe | Moyen | Moyen | [ ] | Pions visuels differencies par roster |
| H.7 | Variantes terrain (skins) | Faible | Moyen | [ ] | Selecteur herbe/ruine/neige |

---

## Resume par phase

| Phase | Nb taches | Effort estime | Criticite pour jouer en ligne |
|-------|-----------|--------------|-------------------------------|
| **A — Multijoueur temps reel** | 10 | ~5-7 jours | BLOQUANT |
| **B — Regles BB3 manquantes** | 21 | ~12-18 jours | ESSENTIEL (B1 critique, B2/B3 secondaire) |
| **C — Matchmaking & flow** | 8 | ~6-8 jours | BLOQUANT |
| **D — Progression joueurs** | 8 | ~5-7 jours | IMPORTANT (campagne) |
| **E — Animations** | 7 | ~5-7 jours | IMPORTANT (UX) |
| **F — ELO & classement** | 4 | ~2-3 jours | SOUHAITABLE |
| **G — Notifications push** | 5 | ~3-4 jours | SOUHAITABLE |
| **H — Polish** | 7 | ~5-7 jours | BONUS |
| **Total** | **70** | **~43-61 jours** | — |

---

## Chemin critique pour jouer en ligne

```
Phase A (WebSocket)  ──→  Phase C (Matchmaking)  ──→  JOUABLE EN LIGNE
       │                         │
       └── Phase B1 (Regles critiques : crowd push, apothecaire, mi-temps)
                                 │
                    Phase E (Animations) ──→  EXPERIENCE AGREABLE
                                 │
                    Phase D (Progression) ──→  MODE CAMPAGNE
                                 │
              Phase F (ELO) + Phase G (Push) ──→  COMPETITIF
```

> **Recommandation** : faire A → B1 → C dans cet ordre. Ca donne un jeu
> en ligne fonctionnel avec les regles BB3 essentielles. Ensuite E et D
> en parallele pour l'experience et la profondeur.
