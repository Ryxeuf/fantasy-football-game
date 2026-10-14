# Mes compétitions, et ce que j'ai à y faire

## Why

Un coach n'a aujourd'hui aucun moyen de retrouver SES compétitions : `/leagues`
et `/cups` listent tout ce qui lui est visible (les publiques de tout le
monde, plus ses privées), sans filtre ni indication de son rôle sur les
cartes de ligue. La notion existe pourtant déjà dans le code, en morceaux :
le listing des ligues, celui des coupes, les archives de coupe et la garde de
visibilité réécrivent chacun « créée par moi ou une de mes équipes y est
inscrite », avec des variantes (équipe retirée comptée d'un côté, équipe
supprimée exclue de l'autre). Un bouton s'appelle même « Mes compétitions »
(`OfflineMatchGate`) et renvoie vers `/leagues`.

Et ce qu'un coach cherche dans « ses » compétitions, c'est surtout ce qu'il a
à y faire : saisir une feuille que l'adversaire a déjà soumise, valider celles
de sa ligue en tant que commissaire, fixer la date de son prochain match,
répondre à une invitation, choisir des évolutions, pronostiquer, publier un
bracket, générer la ronde suivante d'une coupe. Chacun de ces états existe en
base et se lit déjà quelque part, mais page par page, compétition par
compétition : rien ne les rassemble.

## What Changes

- **Filtre « Les miennes » sur les listes existantes** : `/leagues`,
  `/leagues/archived` et `/cups` gagnent un sélecteur « Toutes / Les
  miennes », porté par l'URL (`?scope=mine`). Défaut : **Toutes**, comme
  aujourd'hui. Filtrage côté SERVEUR (`GET /leagues?scope=mine`,
  `GET /cup?scope=mine`) : la liste des ligues est paginée, un filtre client
  ne trierait que la page courante.
- **Mon rôle sur chaque carte** : les listings servent `viewerRoles`
  (commissaire, joueur inscrit / retiré / d'une saison passée, équipes
  engagées), tranché par le serveur. Les cartes de ligue affichent enfin
  « 👑 Commissaire » et « Inscrit » comme celles des coupes ; la page des
  coupes cesse de reconstruire ces rôles en trois requêtes.
- **Page « Mes compétitions » (`/me/competitions`)** : ligues ET coupes
  réunies, filtrables par type, par rôle et par phase normalisée
  (Inscriptions / En cours / Terminée / Archivée, défaut : actives), filtres
  portés par l'URL. Accessible depuis le menu « 🏆 Compétitions », le menu du
  compte, les listes `/leagues` et `/cups`, et le bouton « Mes compétitions »
  existant.
- **« À faire »** : la même page ouvre sur la liste de ce qui attend le coach,
  toutes compétitions confondues, triée par urgence (quelqu'un attend après
  lui, puis échéance la plus proche), et chaque carte porte ses propres
  « à faire » et son prochain match. Catalogue initial :
  - joueur : feuille à soumettre (adversaire déjà soumis), feuille commencée
    à terminer, feuille à saisir (match passé), date du prochain match à
    fixer, évolutions à choisir, pronostics ouverts, invitation à accepter ;
  - commissaire : feuilles à valider, bracket de play-offs à publier, ronde
    suivante de coupe à générer (ou play-offs à lancer), saison prête à
    démarrer, saison prête à clôturer, inscriptions de coupe à clore,
    journée en retard à relancer.
  Tous DÉRIVÉS à la lecture de l'état existant, par des fonctions pures :
  aucune colonne, aucun compteur persisté, rien à rattraper.
- **« Mes compétitions » est une seule règle** : un module de résolution
  unique (créateur OU propriétaire d'une équipe inscrite à une édition,
  retrait compris, équipe supprimée comprise) alimente le filtre, la page,
  les rôles, et les listings existants qui la réécrivaient. Invariant testé :
  « les miennes » ⊆ « visibles ».
- **Aide du site** : une entrée présente la page et ses « à faire ».

Hors périmètre (suites) : compteur d'« à faire » dans le menu, bloc sur le
tableau de bord `/me`, notifications des « à faire », application mobile,
NFL Fantasy et pronostics Pro League (déjà « les miennes » seulement).

## Capabilities

### New Capabilities

- `my-competitions` : ce qu'est « une compétition à moi » (règle unique),
  le rôle du lecteur servi par les listings, le filtre « Les miennes » des
  listes, la page `/me/competitions` (phases normalisées, filtres, accès).
- `competition-todos` : le catalogue des « à faire » d'un coach et d'un
  commissaire sur ses ligues et coupes, leur dérivation à la lecture, leur
  visibilité (rien de ce qu'un coach ne peut pas voir) et leur ordre.

### Modified Capabilities

- `site-help` : l'aide présente « Mes compétitions ». Capacité introduite par
  le change `site-help-page`, non encore archivé : le delta est écrit en
  `ADDED`, valable que ce change soit archivé avant ou après.

## Impact

- **Base** : aucune colonne, aucun modèle. Lecture seule.
- **Serveur** :
  - nouveau module pur de résolution « à moi »
    (`services/competition-membership`) réutilisé par `listLeagues`,
    `buildCupListWhere` et `GET /cup/archived` ;
  - `GET /leagues` et `GET /cup` : paramètre `scope`, champ `viewerRoles`
    (`GET /cup` gagne enfin un schéma Zod de query) ;
  - nouveau routeur `routes/my-competitions` : `GET /competitions/me` (liste)
    et `GET /competitions/me/todos` (« à faire » + prochains matchs) ;
  - dérivations pures réutilisant l'existant : `selectReminderTargets`,
    `predictionEligibility` / `isPredictionClosed`, `visibleCupRounds`,
    `listPendingValidationsForCommissioner`, invitations en attente,
    évolutions en attente ; la condition « saison prête à clôturer » et
    « ronde de coupe générable », aujourd'hui écrites dans l'écran, passent
    dans un module pur partagé.
- **Web** : `/me/competitions` (page, cartes, liste « à faire »),
  sélecteur `scope` sur `/leagues`, `/leagues/archived` et `/cups`, badges de
  rôle sur les cartes de ligue, entrées de menu (`Header`, `AuthBar`), bouton
  de `OfflineMatchGate`, entrée d'aide, traductions fr/en.
- **Aucun** flag : la page est en lecture seule et n'ouvre l'accès à rien
  qui ne soit déjà visible.
- **Mobile** : non touché (suite).
