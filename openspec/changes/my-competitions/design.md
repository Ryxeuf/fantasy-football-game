# Design — Mes compétitions et leurs « à faire »

## Context

Voir `proposal.md` (Why) et les specs `my-competitions` / `competition-todos`
(exigences). État du code qui façonne l'approche :

- **La règle « à moi » est réécrite quatre fois**, avec des variantes :
  - `listLeagues` (`services/league.ts`) l'inclut dans son OR de visibilité
    (participation via `team.ownerId`, tous statuts, équipes supprimées
    comprises) ;
  - `buildCupListWhere` (`services/cup-listing.ts`) et `GET /cup/archived`
    (`routes/cup.ts`) pré-chargent les équipes NON supprimées du coach puis
    filtrent `teamId in [...]` ;
  - `isLeagueParticipant` (`services/league.ts`) répond pour la garde de
    lecture.
- **Liens joueur ↔ compétition** : `LeagueParticipant` et `CupParticipant`
  ne portent que `teamId` ; l'utilisateur se lit par `Team.ownerId`. Le retrait
  de ligue est un statut (`withdrawn`) ; la désinscription de coupe supprime la
  ligne. Une équipe ne se supprime (soft delete) qu'une fois ses compétitions
  terminées (`services/team-delete`) : ses participations sont de l'HISTOIRE.
- **Listings** : `GET /leagues` (Zod `listLeaguesQuerySchema`, paginé, `meta`)
  et `GET /cup` (sans schéma de query, sans pagination, `{ cups }`). Aucun ne
  sert le rôle du lecteur ; la page `/cups` le reconstruit en trois requêtes
  (`/auth/me`, `/cup`, `/team/mine`).
- **Les états « à faire » existent tous en base** (inventaire de
  l'exploration) : feuille `LeagueMatchSheet` polymorphe ligue XOR coupe
  (`draft | submitted_home | submitted_away | both_submitted | validated |
  invalidated`, créée paresseusement), rencontres `LeaguePairing` /
  `CupPairing` (`scheduledAt`, `deadlineAt`, placeholder `home === away`,
  exempt = `awayTeamId` null), journées et rondes, `playoffsPublished`
  (saison et coupe), `LeaguePostMatchSequence.awaiting_choices`, invitations,
  `CompetitionPrediction`. Plusieurs prédicats purs existent déjà :
  `selectReminderTargets`, `predictionEligibility` / `isPredictionClosed`,
  `visibleCupRounds`, `selectUpcomingMatches` (web, une ligue à la fois).
  `listPendingValidationsForCommissioner` couvre déjà ligues ET coupes.
- Le serveur construit déjà des liens web (`public-news-ticker`,
  `Notification.url`).
- `prisma/migrations/` est gitignoré (`db push`) : ce change n'ajoute aucune
  colonne, donc rien à rattraper.

## Goals / Non-Goals

**Goals :**

- UNE résolution de « à moi », dont la visibilité, le filtre, la page et les
  rôles dérivent — et un invariant testé « à moi ⊆ visible ».
- Des « à faire » qui ne peuvent pas mentir sur l'état : dérivés à la lecture
  par des fonctions pures, testables sans Prisma, une famille = un dérivateur.
- Un « à faire » de commissaire n'est proposé que si l'action correspondante
  passerait ses gardes serveur.
- Aucune régression des listes existantes : défaut « Toutes », réponse
  inchangée sans `scope`.

**Non-Goals :**

- Compteur d'« à faire » dans le menu, bloc sur `/me`, notifications ou
  e-mails d'« à faire » (la route est pensée pour les servir plus tard).
- Marquer un « à faire » comme lu ou le masquer (rien n'est persisté).
- Application mobile, NFL Fantasy, pronostics Pro League.
- Réécrire les cartes des listes existantes : elles gagnent un badge de rôle,
  pas un composant commun.
- Corriger le forfait automatique qui ignore la feuille
  (`sweepDeadlinePairings`) : sujet séparé, proposé en tâche à part.

## Decisions

### D1 — Un module unique `services/competition-membership`

Il exporte les filtres Prisma « à moi » et la règle pure des rôles :

```ts
leagueMineWhere(userId) // OR [{ creatorId }, { seasons: { some: { participants: { some: { team: { ownerId } } } } } }]
cupMineWhere(userId)    // OR [{ creatorId }, { participants: { some: { team: { ownerId } } } }]
buildViewerRoles(input) // pur : { commissioner, participant, teams }
```

`listLeagues` compose sa visibilité à partir de `leagueMineWhere` (+ publiques
+ invités) ; `buildCupListWhere` et `GET /cup/archived` à partir de
`cupMineWhere` (+ publiques). Le filtre par relation (`team: { ownerId }`)
remplace le pré-chargement `teamId in [...]` : une requête de moins, et les
équipes supprimées comptent, ce que la spec exige.

- *Rejeté : filtrer côté client.* `/leagues` est paginé ; on ne trierait que
  la page courante.
- *Rejeté : réutiliser `?creatorId=`.* Il ne couvre que le commissaire et
  retombe sur `isPublic: true` — il raterait les ligues privées du coach.
- *Rejeté : exclure les équipes supprimées.* Elles ne le sont qu'après leurs
  compétitions : exclure reviendrait à effacer l'historique de « mes
  compétitions » (et de `/cups/archived`) au premier ménage du coach.

L'invariant « à moi ⊆ visible » est vrai par construction (le OR de
visibilité CONTIENT le filtre « à moi ») et vérifié par un test sur le `where`
produit.

### D2 — `scope=all|mine` sur les listings, à côté des filtres existants

`listLeaguesQuerySchema` gagne `scope` (défaut `all`) ; `GET /cup` gagne enfin
un schéma (`listCupsQuerySchema` : `scope`, `publicOnly`) monté par
`validateQuery`. Avec `mine`, le `where` devient `statut ET leagueMineWhere`
(resp. `cupMineWhere`), sans clause de visibilité : elle est inutile, « à moi »
étant inclus dans « visible ». `creatorId`, `status` et la pagination
s'appliquent par-dessus. Précédent : `GET /local-match?scope=mine`.

- *Rejeté : des routes `/leagues/mine`, `/cup/mine`.* Elles dupliqueraient
  tri, pagination et sérialisation de chaque listing.

### D3 — `viewerRoles` : une requête de plus par listing, jamais N+1

Après la page de résultats :

- ligues : `leagueParticipant.findMany({ where: { team: { ownerId }, season:
  { leagueId: { in: ids } } } })` + `leagueSeason.groupBy({ by: ["leagueId"],
  _max: { seasonNumber } })` pour l'édition courante ;
- coupes : `cupParticipant.findMany({ where: { cupId: { in: ids }, team: {
  ownerId } } })`.

`buildViewerRoles` (pur) tranche : `active` / `withdrawn` selon le statut de la
participation à l'édition courante, `former` si seulement des saisons
antérieures, `null` sinon ; une coupe n'a qu'une édition et pas de retrait.
Champ ajouté en OPTIONNEL côté web (retro-compat : le web peut partir avant le
serveur).

### D4 — Deux routes : la liste et les « à faire »

`routes/my-competitions.ts`, monté sur `/competitions` :

- `GET /competitions/me?kind&role&phase&limit&offset` — la liste ;
- `GET /competitions/me/todos` — `{ todos, upcoming }`.

La page les charge en parallèle (patron `Promise.all([detail, optional])`) :
un échec des « à faire » ne bloque pas la liste. La route des « à faire »
couvre TOUTES les compétitions actives, indépendamment de la pagination de la
liste ; elle servira telle quelle un futur compteur ou bloc de tableau de
bord.

- *Rejeté : une seule route.* Elle lierait la pagination de la liste (qui
  inclut les archives) au calcul des « à faire » (qui n'en a que pour les
  actives).
- *Rejeté : servir les « à faire » dans `GET /leagues` et `GET /cup`.* Coût
  imposé à chaque consultation des listes publiques.

### D5 — La liste se charge entière, puis se pagine en mémoire

Ligues et coupes vivent dans deux tables ; une pagination croisée exigerait
une UNION SQL, ce que Prisma ne sait pas faire portablement (PG + miroir
SQLite). Or l'ensemble « à moi » d'un coach est petit. On charge les deux
ensembles (`select` minimal, plafond 500 par type journalisé s'il est
atteint), on calcule phase et rôles, on filtre et on trie en PUR
(`my-competitions-rules` : phase `in_progress` → `registration` → `finished`
→ `archived`, puis activité la plus récente), puis on découpe la page.

### D6 — Phase normalisée : un mapping pur, inconnu = en cours

`competitionPhase(kind, status)` (pur, serveur) suit la table de la spec. Un
statut inconnu est lu `in_progress` : une compétition n'est jamais cachée
parce qu'un statut a dérivé. Le web ne fait que traduire la phase.

### D7 — Les « à faire » : chargeurs bornés → instantané → dérivateurs purs

```
 Prisma (≈ 12 requêtes bornées, aucune N+1)
   │  loadTodoSnapshot(userId, now)
   ▼
 TodoSnapshot (objets simples, dates en Date)
   │  TODO_DERIVERS.flatMap((derive) => derive(snapshot, now))
   ▼
 Todo[] ──▶ compareTodos (pur) ──▶ { todos, upcoming }
```

- **Chargeurs** (`services/competition-todos.ts`) : rencontres ouvertes de
  ligue dont le coach possède un côté ACTIF (saison non terminée, ligue ni
  `completed` ni `archived`) avec feuille, journée, saison
  (`playoffsPublished`) et ligue ; rencontres ouvertes de coupe (coupe
  `ouverte`/`en_cours`) ; feuilles à valider
  (`listPendingValidationsForCommissioner`, réutilisée) ; invitations
  (services existants) ; séquences `awaiting_choices` des saisons du coach ;
  rencontres pronosticables et pronostics du coach ; saisons et coupes CRÉÉES
  par le coach (rondes, statut des rencontres, inscrits actifs en `groupBy`).
- **Dérivateurs** (`services/competition-todos-rules.ts`, PUR) : un par
  famille de la spec, dans un registre `TODO_DERIVERS`. Ajouter un « à faire »
  = un dérivateur + son test, sans toucher aux autres.
- **Réutilisation stricte** : `selectReminderTargets` (raison `sheet_overdue`
  seule pour `round.remind`), `predictionEligibility` + `isPredictionClosed`,
  `visibleCupRounds` et la règle des play-offs de ligue masqués. Les gardes
  des actions de commissaire (`startSeason`, `generateCupRound`) sont
  EXTRAITES en prédicats purs appelés à la fois par l'action et par le
  dérivateur : un « à faire » ne peut pas proposer une action que le serveur
  refuserait.
- **Feuille côté joueur** : décision par le STATUT de la feuille, jamais par
  `submittedBy*At` — une invalidation ne remet pas ces horodatages à zéro.
  Une rencontre de ligue ouverte = `scheduled | in_progress` (le second n'est
  jamais écrit aujourd'hui, mais la colonne l'autorise).
- **Forme servie** :

  ```ts
  interface CompetitionTodo {
    kind: TodoKind;                 // "sheet.submit" | "sheet.validate" | …
    competition: { kind: "league" | "cup"; id: string; name: string };
    href: string;                   // écran d'action (chemin web relatif)
    dueAt: string | null;           // échéance ISO éventuelle
    waitingOnViewer: boolean;       // quelqu'un attend après le lecteur
    detail: Record<string, string | number>; // adversaire, journée, nombre…
  }
  ```

  Le serveur construit `href` (précédent : `public-news-ticker`) ; le web
  rend le libellé à partir de `kind` + `detail` (i18n), jamais le serveur.

- *Rejeté : persister les « à faire ».* Il faudrait les invalider à chaque
  évènement de chaque service — exactement la dérive qu'a connue le compteur
  de sorties persisté. Le recalcul à la lecture ne peut pas être périmé.
- *Rejeté : réutiliser `selectUpcomingMatches` du web.* Il ne sert qu'une
  ligue chargée en entier ; il reste en place pour sa page, la règle serveur
  est réécrite pour les deux types de compétition.

### D8 — Ordre : un comparateur pur et stable

`compareTodos` : `waitingOnViewer` d'abord, puis `dueAt` croissant (sans
échéance en dernier), puis nom de compétition, puis l'ordre de `TODO_KINDS`.
Les prochains matchs se trient par date prévue (sans date en dernier), puis
journée.

### D9 — Web

- `/me/competitions` (`"use client"`, `<Suspense>` pour `useSearchParams`,
  patron `recherche/SearchClient`) : bloc « À faire » en tête, puis filtres
  (type, rôle, phase) et cartes. Modules purs `app/me/competitions/filters.ts`
  (URL ↔ filtres) et `todo-labels.ts` (`kind` + `detail` → libellé),
  testés sans DOM.
- Un composant partagé `ViewerRoleBadges` sert les cartes de `/leagues`,
  `/leagues/archived`, `/cups` et `/me/competitions`.
- Sélecteur « Toutes / Les miennes » : un composant `ScopeToggle` qui lit et
  écrit `?scope=` (`router.replace(..., { scroll: false })`).
- Libellés en fr/en via `useLanguage()` ; la page `/cups`, aujourd'hui en
  français codé en dur, n'est pas migrée dans ce change (seuls les libellés
  ajoutés passent par les traductions).
- Navigation : `Header` (menu « 🏆 Compétitions », connecté seulement),
  `AuthBar` (menu du compte), liens depuis `/leagues` et `/cups`, bouton de
  `OfflineMatchGate` repointé. `/me/*` est déjà protégé par le middleware.

## Risks / Trade-offs

- [Coût de `GET /competitions/me/todos` à chaque ouverture de la page] →
  requêtes bornées par les compétitions du coach, index existants
  (`LeaguePairing` home/away/status, `CupPairing` home/away/status,
  `LeagueMatchSheet.status`, invitations `(inviteeUserId, status)`) ; pas de
  cache tant que la mesure ne le justifie pas.
- [Suggestions perçues comme du harcèlement (`season.start`,
  `cup.registrations.close`)] → jamais `waitingOnViewer`, donc toujours après
  les vrais blocages ; elles disparaissent dès que la condition tombe.
- [`sheet.enter` alors que le match a été reporté sans changer la date] →
  c'est un rappel : refixer la date le fait disparaître.
- [Un dérivateur qui diverge de l'écran d'action] → les gardes d'action sont
  partagées (D7) ; les conditions purement d'affichage
  (`SeasonAdminPanel.readyToClose`, `CupRoundsView.canGenerate`) restent côté
  web, l'action serveur restant seule juge.
- [Plafond de 500 compétitions par type atteint] → journalisé ; la liste
  reste servie, tronquée aux plus récentes.
- [Équipe transférée à un autre coach] → la règle suit le propriétaire
  COURANT de l'équipe, comme la visibilité et la feuille de match.

## Migration Plan

Aucune donnée à migrer. Déployer serveur puis web ; les champs ajoutés
(`viewerRoles`) sont optionnels côté web, donc l'ordre inverse ne casse rien
(cartes sans badge, sélecteur sans effet jusqu'au serveur). Retour arrière :
revert du web puis du serveur, sans trace en base.
