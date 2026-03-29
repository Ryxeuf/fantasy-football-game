# TODO — BlooBowl (Nuffle Arena)

> Backlog priorisé par valeur (Gain) et effort (Difficulté).
> Dernière mise à jour : 2026-03-22
>
> **Légende :**
> - **Gain** : 🟢 Fort | 🟡 Moyen | 🔴 Faible — Impact utilisateur / valeur business
> - **Difficulté** : 🟢 Facile (< 1j) | 🟡 Moyen (1-3j) | 🔴 Difficile (> 3j)
> - **Score** = Gain élevé + Difficulté faible → à faire en premier

---

## 🏆 Priorité 1 — Quick Wins (Gain fort, Difficulté faible)

> ✅ Toutes les tâches P1 sont terminées ! Voir ROADMAP_DONE.md

---

## 🥇 Priorité 2 — Fonctionnalités clés (Gain fort, Difficulté moyenne)

### WEB — Animations & polish

| # | Tâche | Gain | Diff | Issue | Détail |
|---|-------|------|------|-------|--------|
| 2.1 | Animation tween déplacement joueur | 🟢 | 🟡 | [#36] | Interpolation position 150-250ms avec easing |
| 2.2 | Animation tween de la balle (passe/scatter) | 🟢 | 🟡 | [#36] | Arc de trajectoire balle avec durée proportionnelle à la distance |
| 2.3 | File d'attente d'animations (queue) | 🟡 | 🟡 | [#36] | Système séquentiel Promise-based, skip avec touche (S) |
| 2.4 | Animation de touchdown | 🟡 | 🟢 | [#36] | Effet visuel flash/particles sur TD, renforcer l'animation existante |
| 2.5 | Animation de blocage (impact) | 🟡 | 🟡 | [#36] | Shake/flash sur la cible du bloc, visuel selon résultat |

### MULTIJOUEUR — Temps réel

| # | Tâche | Gain | Diff | Issue | Détail |
|---|-------|------|------|-------|--------|
| 2.6 | Intégrer WebSocket côté serveur (socket.io) | 🟢 | 🟡 | — | Setup socket.io sur le serveur Express existant |
| 2.7 | Émettre les moves via WebSocket | 🟢 | 🟡 | — | Broadcast du gameState après chaque move aux joueurs du match |
| 2.8 | Recevoir les moves via WebSocket côté web | 🟢 | 🟡 | — | Client socket.io dans le composant de jeu, update gameState |
| 2.9 | Fallback polling si WebSocket échoue | 🟡 | 🟢 | — | Détection déconnexion WS → bascule sur polling existant |
| 2.10 | Gestion reconnexion WebSocket | 🟡 | 🟡 | — | Reconnexion auto avec exponential backoff, resync état |

### WEB — Assets & thèmes

| # | Tâche | Gain | Diff | Issue | Détail |
|---|-------|------|------|-------|--------|
| 2.11 | Créer un asset loader/cache Pixi.js | 🟡 | 🟡 | [#38] | Chargement sprite sheets avant rendu, cache mémoire |
| 2.12 | Sprite sheet joueurs par équipe | 🟡 | 🟡 | [#38] | Pions visuels différenciés par roster (couleurs/formes) |
| 2.13 | Tileset terrain de base (herbe/lignes) | 🟡 | 🟡 | [#26] | Calques Pixi séparés : herbe, en-buts, lignes de terrain |

---

## 🥈 Priorité 3 — Notifications & engagement (Gain moyen, Difficulté moyenne)

### NOTIFICATIONS

| # | Tâche | Gain | Diff | Issue | Détail |
|---|-------|------|------|-------|--------|
| 3.1 | UI demande permission notifications browser | 🟡 | 🟢 | [#23] | Modal avec explication + bouton Notification.requestPermission() |
| 3.2 | Page /settings avec préférences notifications | 🟡 | 🟡 | [#23] | Toggles par type : tour, match terminé, invitation |
| 3.3 | Badge cloche dans le header | 🟡 | 🟢 | [#24] | Icône cloche avec compteur non-lu, dropdown liste |
| 3.4 | Service Worker pour push notifications | 🟢 | 🟡 | — | Enregistrement SW, subscription endpoint, stockage côté serveur |
| 3.5 | Endpoint serveur envoi push | 🟢 | 🟡 | — | Route POST /notifications/push avec web-push library |
| 3.6 | Push "C'est votre tour" | 🟢 | 🟢 | — | Trigger après chaque end turn de l'adversaire |
| 3.7 | Push "Invitation reçue" | 🟡 | 🟢 | — | Trigger à la création d'un match avec shareToken |
| 3.8 | Push "Match terminé" | 🟡 | 🟢 | — | Trigger au touchdown final ou fin de temps |

### WEB — Expérience utilisateur

| # | Tâche | Gain | Diff | Issue | Détail |
|---|-------|------|------|-------|--------|
| 3.9 | Replayer basique (lecture seule) | 🟡 | 🟡 | [#21] | Slider de tours, recalcul gameState via seed, boutons prev/next |
| 3.10 | Onglet historique du match | 🟡 | 🟡 | [#20] | Liste des turns avec résumé, bouton "voir cet état" |
| 3.11 | Indicateurs tactiques au survol | 🟡 | 🟡 | — | Lignes de passe potentielles, trajectoires blitz au hover joueur |

---

## 🥉 Priorité 4 — Mobile (Gain moyen, Difficulté élevée)

### MOBILE — Fonctionnalités essentielles

| # | Tâche | Gain | Diff | Issue | Détail |
|---|-------|------|------|-------|--------|
| 4.1 | ~~Écran login mobile~~ ✅ | 🟡 | 🟡 | [#17] | Formulaire email/password, stockage token SecureStore |
| 4.2 | ~~Écran register mobile~~ ✅ | 🟡 | 🟢 | [#17] | Formulaire inscription, validation, redirect login |
| 4.3 | ~~Écran lobby / liste matchs mobile~~ ✅ | 🟡 | 🟡 | [#17] | FlatList des matchs en attente, bouton créer/rejoindre |
| 4.4 | ~~Zoom pinch sur le board mobile~~ ✅ | 🟡 | 🟡 | [#42] | PinchGestureHandler, scale avec limites |
| 4.5 | ~~Pan drag sur le board mobile~~ ✅ | 🟡 | 🟡 | [#42] | PanGestureHandler, translation avec limites |
| 4.6 | ~~Surbrillance cases jouables (tap)~~ ✅ | 🟡 | 🟡 | [#35] | Tap joueur → affiche cases, double-tap annule |
| 4.7 | Renderer Canvas RN complet | 🟡 | 🔴 | [#29] | Plateau rect/cercles, gestes tap/long press, toutes mécaniques |
| 4.8 | ~~Animations tween mobile~~ ✅ | 🟡 | 🟡 | [#37] | API partagée web/mobile pour déplacement/balle |
| 4.9 | Pack d'assets mobile optimisé | 🟡 | 🟡 | [#40] | Sprite sheets 1x/2x, fallback vectoriel |
| 4.10 | Notifications push Expo | 🟡 | 🟡 | [#25] | expo-notifications, permissions, tokens |
| 4.11 | ~~Historique matchs minimal~~ ✅ | 🔴 | 🟢 | [#22] | Liste turns + bouton voir état |

---

## 📦 Priorité 5 — Polish & Communauté (Gain variable, Difficulté élevée)

### STATISTIQUES & CLASSEMENT

| # | Tâche | Gain | Diff | Issue | Détail |
|---|-------|------|------|-------|--------|
| 5.1 | Modèle Prisma pour ELO / classement | 🟡 | 🟢 | — | Champ elo sur User, historique classement |
| 5.2 | Calcul ELO après chaque match | 🟡 | 🟡 | — | Fonction calcul ELO K-factor, update en fin de match |
| 5.3 | Page leaderboard | 🟡 | 🟡 | — | Tableau classement, filtres saison/global |
| 5.4 | Dashboard stats par coach | 🟡 | 🟡 | — | Win rate, TD/match, équipes préférées, graphiques |
| 5.5 | Stats carrière par joueur | 🔴 | 🟡 | — | TD, casualties, passes, MVP, SPP, progression |
| 5.6 | Heatmap terrain post-match | 🔴 | 🟡 | — | Visualisation zones jouées, couloirs de passe |

### ENGAGEMENT

| # | Tâche | Gain | Diff | Issue | Détail |
|---|-------|------|------|-------|--------|
| 5.7 | Système achievements (modèle + logique) | 🟡 | 🟡 | — | Table Achievement, triggers en fin de match |
| 5.8 | 20 premiers achievements | 🟡 | 🟡 | — | 1er TD, 10 casualties, victoire parfaite, etc. |
| 5.9 | UI achievements sur profil | 🟡 | 🟢 | — | Grille badges, progression, date obtention |
| 5.10 | Profil public de coach | 🟡 | 🟡 | — | Page /coach/:id, palmarès, équipes, stats |
| 5.11 | Système de saisons compétitives | 🔴 | 🔴 | — | Saisons 4 semaines, reset, récompenses |
| 5.12 | Mode draft | 🔴 | 🔴 | — | Sélection alternée joueurs avant match exhibition |

### EXPÉRIENCE ENRICHIE

| # | Tâche | Gain | Diff | Issue | Détail |
|---|-------|------|------|-------|--------|
| 5.13 | Variantes terrain (skins) | 🔴 | 🟡 | [#39] | Sélecteur herbe/ruine/neige + preview |
| 5.14 | Thèmes météo dynamiques | 🔴 | 🟡 | — | Terrain change selon météo (neige, pluie) + particles |
| 5.15 | Caméra cinématique | 🔴 | 🟡 | — | Zoom auto sur action (bloc, passe longue, TD) |
| 5.16 | Mode spectateur | 🟡 | 🟡 | — | Vue lecture seule match en cours |
| 5.17 | Chat in-game | 🟡 | 🟡 | — | Messagerie simple entre joueurs pendant match |
| 5.18 | Emotes rapides | 🔴 | 🟢 | — | GG, Nice Block, Ouch! sans quitter le board |
| 5.19 | Sound design (effets sonores) | 🟡 | 🟡 | — | Web Audio API : impact bloc, sifflet, foule |
| 5.20 | Export GIF/vidéo action | 🔴 | 🔴 | — | Capture animée d'une action pour partage |

### IA & TUTORIEL

| # | Tâche | Gain | Diff | Issue | Détail |
|---|-------|------|------|-------|--------|
| 5.21 | IA adversaire — évaluation positionnelle | 🟡 | 🔴 | — | Scoring cases, formation, densité |
| 5.22 | IA adversaire — scoring de coups | 🟡 | 🔴 | — | Évaluation bloc/mouvement/passe par heuristiques |
| 5.23 | IA adversaire — niveau Débutant | 🟡 | 🟡 | — | Coups aléatoires pondérés, pas d'optimisation |
| 5.24 | IA adversaire — niveau Intermédiaire | 🔴 | 🟡 | — | Scoring basique, quelques erreurs volontaires |
| 5.25 | IA adversaire — niveau Légende | 🔴 | 🔴 | — | Scoring optimal, anticipation, gestion risque |
| 5.26 | Tutoriel interactif — mouvement | 🟡 | 🟡 | — | Scénario guidé pas-à-pas, highlight cases |
| 5.27 | Tutoriel interactif — blocage | 🟡 | 🟡 | — | Scénario guidé bloc + résultat |
| 5.28 | Tutoriel interactif — passe | 🔴 | 🟡 | — | Scénario guidé passe + catch |
| 5.29 | Tutoriel interactif — blitz | 🔴 | 🟡 | — | Scénario guidé blitz complet |

### TECHNIQUE & INFRA

| # | Tâche | Gain | Diff | Issue | Détail |
|---|-------|------|------|-------|--------|
| 5.30 | Logs structurés (winston/pino) | 🟡 | 🟡 | — | Logger centralisé, niveaux, format JSON |
| 5.31 | Monitoring health dashboard | 🟡 | 🟡 | — | Endpoint /health détaillé, métriques basiques |
| 5.32 | Moteur d'événements chaînés | 🟡 | 🔴 | — | Système événementiel cascades (bloc→push→injury→apothecary) avec rollback |
| 5.33 | Tournois automatiques (brackets) | 🟡 | 🔴 | — | Swiss system, round-robin, timers |
| 5.34 | API publique documentée | 🔴 | 🟡 | — | REST docs OpenAPI, endpoints tiers |

---

## 📊 Résumé par priorité

| Priorité | Nb tâches | Effort estimé | Impact |
|----------|-----------|--------------|--------|
| **P1 — Quick Wins** | ~~2~~ ✅ | ~~1-2 jours~~ | ✅ Terminé |
| **P2 — Clés** | 13 | ~10-15 jours | Animations + multijoueur temps réel |
| **P3 — Notifications** | 11 | ~8-12 jours | Engagement + rétention |
| **P4 — Mobile** | 11 | ~15-20 jours | Couverture mobile |
| **P5 — Polish** | 34 | ~40-60 jours | Communauté + fidélisation |
| **Total** | **75** | ~78-108 jours | — |

---

## 🎯 Chemin critique recommandé

```
P1.1-1.3 (Zoom/Pan)  ──→  P2.1-2.5 (Animations)  ──→  P2.11-2.13 (Assets)
         │
P1.6-1.8 (Sécurité)  ──→  P2.6-2.10 (WebSocket)  ──→  P3.4-3.8 (Push notif)
         │
P1.4-1.5 (Heatmap)   ──→  P3.9-3.11 (Replayer)   ──→  P5.x (Communauté)
```

> **Recommandation** : commencer par P1 (quick wins) pour un impact immédiat,
> puis P2.6-2.10 (WebSocket) car le multijoueur temps réel est le plus gros
> manque fonctionnel du projet actuellement.
