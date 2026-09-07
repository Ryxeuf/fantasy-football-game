# Tasks — Notifications internes & cycle de vie des compétitions

## 1. Données
- [x] 1.1 Modèle `Notification` (PG) + relation `User.notifications` ; miroir SQLite ; wipe dans `/__test/reset`.

## 2. Notifications internes (serveur)
- [x] 2.1 `services/in-app-notifications.ts` : create (never-throw), createMany, list, countUnread, markRead, markAllRead, serialize. Tests.
- [x] 2.2 `routes/notifications.ts` : `GET /`, `GET /unread-count`, `POST /read-all`, `POST /:id/read`, montées sur `/notifications`. Tests.
- [x] 2.3 Branchements : invitations ligue/coupe, appariements, match à valider, amis. Tests existants adaptés.

## 3. Cycle de vie des compétitions (serveur)
- [x] 3.1 `services/competition-lifecycle.ts` : archive/delete ligue et coupe, autorisation créateur/admin, notification des participants. Tests.
- [x] 3.2 `routes/competition-lifecycle.ts` : `POST /:id/archive`, `DELETE /:id` sur `/leagues` et `/cup`. Tests.

## 4. Web
- [x] 4.1 `NotificationsContext` + `NotificationsBell` ; cloche + compteur dans `Header` (bureau/mobile) et `AuthBar`. Tests.
- [x] 4.2 Page `/me/notifications` : liste, lecture automatique, « charger plus ». i18n FR/EN. Tests.
- [x] 4.3 Pages `/leagues/[id]` et `/cups/[id]` : section gestion (archiver, supprimer). Tests.

## 5. Vérification
- [x] 5.1 E2E API : `notifications.spec.ts`, `competition-lifecycle.spec.ts`.
- [x] 5.2 `pnpm typecheck`, `pnpm lint`, suites server + web, `next build`.

## Suites possibles (hors périmètre)
- Préférences par type de notification interne ; purge des notifications lues anciennes.
- Cloche et page notifications dans l'application mobile Expo.
- Corbeille / restauration d'une compétition supprimée.
