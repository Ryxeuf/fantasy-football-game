# Tasks

## 1. Une seule résolution « à moi » (serveur)

- [ ] 1.1 Créer `services/competition-membership.ts` : `leagueMineWhere`, `cupMineWhere` (filtres par relation `team.ownerId`, équipes supprimées comprises) et `buildViewerRoles` (pur : `commissioner`, `participant` = `active | withdrawn | former | null`, équipes de l'édition courante) ; vérifier par `competition-membership.test.ts` en table (commissaire seul, commissaire qui joue, retiré, saison passée, équipe supprimée, invité seulement, admin non membre)
- [ ] 1.2 Composer la visibilité de `listLeagues` à partir de `leagueMineWhere` (+ publiques + invités) sans changer son résultat ; vérifier par `services/league.test.ts` (existants verts) et un test « à moi ⊆ visible » sur le `where` produit
- [ ] 1.3 Faire passer `buildCupListWhere` et `GET /cup/archived` par `cupMineWhere`, supprimer le pré-chargement des équipes non supprimées ; vérifier par `services/cup-listing.test.ts` (coupe privée jouée avec une équipe supprimée : listée) et les tests de route coupe existants
- [ ] 1.4 Consigner le patron « une seule résolution de "à moi", incluse dans la visibilité » dans `CLAUDE.md` (section Patterns) ; vérifier que la section cite `services/competition-membership`

## 2. Filtre « Les miennes » et rôle du lecteur sur les listings (serveur)

- [ ] 2.1 Ajouter `scope: all | mine` (défaut `all`) à `listLeaguesQuerySchema` et la branche `mine` à `listLeagues` (statut, `creatorId` et pagination par-dessus, `meta.total` sur le sous-ensemble) ; vérifier par `routes/league.test.ts` et un cas de chaîne Express réelle dans `routes/league-access.test.ts` (`scope=mine` → `where` « à moi » ; `scope=friends` → 400)
- [ ] 2.2 Créer `listCupsQuerySchema` (`scope`, `publicOnly`) monté par `validateQuery` sur `GET /cup`, branche `mine` via `cupMineWhere` ; vérifier par des tests de route (défaut inchangé, `scope=mine`, 400, `publicOnly=false` toujours réservé à l'admin)
- [ ] 2.3 Servir `viewerRoles` sur chaque élément de `GET /leagues` (une requête de participations + `groupBy` du numéro de saison max) et de `GET /cup` (une requête de participations) ; vérifier par des tests qui comptent les appels Prisma (pas de N+1) et le contenu de `viewerRoles`

## 3. Liste « mes compétitions » (serveur)

- [ ] 3.1 Créer `services/my-competitions-rules.ts` (pur) : `competitionPhase(kind, status)` (inconnu → `in_progress`), filtres `kind` / `role` / `phase` (`active` par défaut), tri (phase puis activité récente) et découpe de page ; vérifier par `my-competitions-rules.test.ts` en table (tous les statuts ligue et coupe, statut inconnu, combinaisons de filtres, pagination)
- [ ] 3.2 Créer `services/my-competitions.ts` (chargement des ligues et coupes « à moi », `select` minimal, plafond 500 par type journalisé) et `routes/my-competitions.ts` (`GET /competitions/me`, `authUser`, schéma Zod `myCompetitionsQuerySchema`), monté sur `/competitions` dans `index.ts` ; vérifier par des tests de route (401 sans jeton, 400 sur paramètre invalide, défaut = actives, ligues et coupes mêlées, `viewerRoles` et `phase` servis)

## 4. « À faire » : dérivateurs purs (serveur)

- [ ] 4.1 Créer `services/competition-todos-rules.ts` : types `TodoKind` / `CompetitionTodo` / `UpcomingMatch` / `TodoSnapshot`, registre `TODO_DERIVERS`, `compareTodos` ; vérifier par des tests d'ordre (attente avant échéance, échéance croissante, sans échéance en dernier, stabilité)
- [ ] 4.2 Dérivateur joueur « feuille » (`sheet.submit`, `sheet.finish`, `sheet.enter`, décision par le STATUT de la feuille) + `match.schedule` (première rencontre ouverte sans date, une seule par équipe et compétition) + prochains matchs ; vérifier par des tests en table : chaque statut de feuille et chaque côté, feuille invalidée, date passée / future / absente, calendrier entier sans date, placeholder `home === away`, exempt, bracket non publié, équipe retirée
- [ ] 4.3 Dérivateurs `advancements.choose`, `predictions.make` (via `predictionEligibility` + `isPredictionClosed`, compte et première fermeture), `invitation.answer` (échéance = expiration) ; vérifier par des tests (propres matchs exclus, pronostics `off`, invitation expirée ignorée)
- [ ] 4.4 Dérivateurs commissaire `sheet.validate`, `playoffs.publish` (saison ET coupe), `round.remind` (raison `sheet_overdue` de `selectReminderTargets` seule), `season.close` (toutes les journées `completed`) ; vérifier par des tests (admin non créateur exclu, journée sans date ignorée, saison incomplète ignorée)
- [ ] 4.5 Extraire les gardes de `startSeason` et de `generateCupRound` en prédicats purs (`canStartSeason`, `canGenerateNextCupRound`) appelés par l'action ET par les dérivateurs `season.start`, `cup.round.next`, `cup.registrations.close` ; vérifier que les tests existants de `league-scheduler` et `cup-rounds` restent verts et que les nouveaux prédicats ont leurs tests (un inscrit, ronde ouverte, coupe terminée)

## 5. « À faire » : chargement et route (serveur)

- [ ] 5.1 Créer `services/competition-todos.ts` : `loadTodoSnapshot(userId, now)` (requêtes bornées aux compétitions actives du coach, réutilise `listPendingValidationsForCommissioner` et les services d'invitations) et `getCompetitionTodos(userId, now)` ; vérifier par des tests à Prisma mocké qui comptent les requêtes (aucune N+1) et contrôlent les `where` (côté ACTIF, compétitions actives, créateur)
- [ ] 5.2 Ajouter `GET /competitions/me/todos` (`authUser`) au routeur ; vérifier par des tests de route (401, liste vide, forme `{ todos, upcoming }`, `href` relatifs)
- [ ] 5.3 Écrire `tests/e2e-api/specs/my-competitions.spec.ts` sur une vraie base : ligue et coupe seedées, `scope=mine`, puis le cycle feuille (A soumet → B reçoit `sheet.submit` ; B soumet → le commissaire reçoit `sheet.validate` ; validation → plus rien) et la disparition d'un « à faire » réglé ailleurs ; vérifier que la spec passe localement
- [ ] 5.4 Documenter le catalogue des « à faire » et la marche à suivre pour en ajouter un dans `docs/competition-todos.md` (lié depuis `CLAUDE.md`) ; vérifier que chaque `TodoKind` du code y figure

## 6. Web : listes existantes

- [ ] 6.1 Créer `ScopeToggle` (« Toutes / Les miennes », lit et écrit `?scope=` par `router.replace(..., { scroll: false })`) et `ViewerRoleBadges` (commissaire, inscrit, retiré, ancienne saison) ; vérifier par des tests RTL (défaut « Toutes », URL mise à jour, badges selon `viewerRoles`, champ absent toléré)
- [ ] 6.2 Brancher `/leagues` et `/leagues/archived` : `scope` transmis à l'API, badges sur les cartes, lien vers `/me/competitions` ; vérifier par `leagues/page.test.tsx` et un test de la page d'archives
- [ ] 6.3 Brancher `/cups` : `scope` transmis, rôles lus dans `viewerRoles` au lieu d'être reconstruits par `/auth/me` + `/team/mine`, lien vers `/me/competitions` ; vérifier par un test de page (badge « Créateur » et « Inscrit » issus de l'API, `scope=mine` dans l'appel)

## 7. Web : page « Mes compétitions »

- [ ] 7.1 Créer `app/me/competitions/filters.ts` (URL ↔ filtres, valeurs inconnues ignorées) et `todo-labels.ts` (`kind` + `detail` → libellé), libellés fr/en dans `i18n/locales` ; vérifier par des tests purs (aller-retour URL, chaque `TodoKind` a un libellé dans les deux langues)
- [ ] 7.2 Créer `app/me/competitions/page.tsx` (`<Suspense>`, `Promise.all([liste, todos.catch(vide)])`) : bloc « À faire » en tête, filtres, cartes avec rôle, équipes, prochain match et « à faire », états vides ; vérifier par `page.test.tsx` (chargement, « rien à faire », aucune compétition, échec des « à faire » sans blocage de la liste, filtres → appel API)
- [ ] 7.3 Navigation : entrée dans le menu « 🏆 Compétitions » de `Header` (desktop et mobile, connecté seulement), dans le menu de `AuthBar`, bouton de `OfflineMatchGate` repointé vers `/me/competitions` ; vérifier par `AuthBar.test.tsx` et un test de `Header` (visible connecté, absent anonyme)
- [ ] 7.4 Ajouter l'entrée « Mes compétitions » à `aide/help-catalogue` (catégorie compétitions, lien `/me/competitions`) ; vérifier que `help-catalogue.test.ts` et `help-visibility.test.ts` passent

## 8. Intégration

- [ ] 8.1 Lancer `pnpm --filter server typecheck`, `pnpm --filter web typecheck`, les suites `server` et `web`, et la spec e2e-api `my-competitions` ; vérifier qu'elles sont toutes vertes
- [ ] 8.2 Ouvrir `/me/competitions`, `/leagues?scope=mine` et `/cups?scope=mine` dans l'application lancée avec un coach commissaire et joueur ; vérifier les rôles, l'ordre des « à faire » et que chaque lien mène à l'écran d'action

## Workflow follow-up

- Après merge : `/opsx:sync` puis `/opsx:archive`.
- Reporter dans `docs/roadmap/backlog/openspec-suites.md` les suites hors périmètre : compteur d'« à faire » dans le menu, bloc sur `/me`, notifications d'« à faire », application mobile, migration i18n de `/cups`.
- Ajouter l'entrée de session dans l'historique de `CLAUDE.md`.
