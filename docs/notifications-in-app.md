# Notifications internes (in-app)

> Historique persistant, par utilisateur, de ce qui le concerne dans
> l'application : invitations, appariements, matchs à valider, demandes
> d'ami, archivage ou suppression d'une compétition. Complète les canaux de
> LIVRAISON existants (push web/Expo, e-mail) sans les remplacer.
> Décision : `openspec/changes/notifications-and-competition-lifecycle/`.

## Modèle

`Notification` (`prisma/schema.prisma`, miroir `apps/server/prisma/sqlite/`) :
`userId`, `kind` (dot-case), `title`, `body`, `url` (lien relatif web,
null = pas de cible), `meta` (Json, ids libres), `readAt` (null = non lue),
`createdAt`. Index `(userId, readAt)` pour le compteur, `(userId, createdAt)`
pour la liste. Cascade sur la suppression du compte.

| `kind` | Destinataire | `url` |
|---|---|---|
| `league.invitation` / `cup.invitation` | l'invité (userId) | page d'acceptation (`/leagues/invitations/<code>`, `/cups/invitations/<code>`) |
| `league.round_pairing` | chaque coach apparié | `/leagues/<id>` |
| `league.match_validation` | le commissaire | `/leagues/<id>/pending-validations` |
| `friend.request` / `friend.accepted` | destinataire / demandeur | null (pas de page « amis » web) |
| `league.archived` / `cup.archived` | coachs inscrits, hors auteur | la fiche de la compétition |
| `league.deleted` / `cup.deleted` | coachs inscrits, hors auteur | null (la compétition n'existe plus) |

## Service `services/in-app-notifications.ts`

- `createInAppNotification(input)` et `createInAppNotifications(userIds, payload)`
  **ne throw jamais** : une notification est un effet secondaire, son échec
  est journalisé (`serverLog.error`) et ne fait jamais échouer l'action
  métier. Même posture que `notifyInvitedCoach` (pattern « hook
  post-settlement encapsulé »).
- La création est **indépendante des préférences push**
  (`shouldSendNotification`) : dans `push-notifications`, elle précède le
  contrôle de préférence.
- `markNotificationRead` / `markAllNotificationsRead` filtrent par `userId`
  dans le WHERE : la notification d'un autre est indiscernable d'une
  notification inexistante (404), et les appels sont idempotents.
- `meta` est parsé tolérant (objet PG / chaîne sqlite).

Pour ajouter un évènement : étendre l'union `NotificationKind`, appeler
`createInAppNotification` là où le coach est déjà prévenu (ou devrait
l'être), et — côté web — ajouter le pictogramme dans
`app/me/notifications/format.ts` si la famille est nouvelle.

## API (`routes/notifications.ts`, montée sur `/notifications`)

| Route | Réponse |
|---|---|
| `GET /notifications?limit&offset&unread` | `{ notifications, unreadCount }` + `meta { total, page, limit }` |
| `GET /notifications/unread-count` | `{ count }` |
| `POST /notifications/read-all` | `{ updated }` |
| `POST /notifications/:id/read` | `{ read: true, changed }` ou 404 |

## Web

- `NotificationsProvider` (`app/contexts/NotificationsContext.tsx`, monté
  dans `ClientLayout`) : compteur partagé, interrogé au montage, toutes les
  60 s onglet visible, et au retour de focus ; jamais sans token. Hook
  `useNotifications()` no-op hors provider.
- `NotificationsBell` dans `Header` (bureau et mobile) et entrée dans le menu
  utilisateur (`AuthBar`), pastille plafonnée à « 99+ ».
- `/me/notifications` : liste paginée ; les non lues au chargement restent
  mises en avant puis sont marquées lues dès l'affichage — **consulter,
  c'est lire**. Seules les URL relatives au site sont suivies.

## Cycle de vie des compétitions (`services/competition-lifecycle.ts`)

`POST /leagues/:id/archive`, `DELETE /leagues/:id`, `POST /cup/:id/archive`,
`DELETE /cup/:id` — commissaire (créateur) ou admin. Archivage idempotent
sur les statuts déjà lus par les listes d'archives (`archived` / `archivee`),
sans verrou de statut. Suppression définitive par cascade Prisma ; les
destinataires sont résolus **avant** l'effacement et notifiés **après** sa
réussite. Côté web : `CompetitionLifecyclePanel` (confirmation par saisie du
nom pour supprimer).

## Suites possibles

- Préférences par type de notification interne ; purge des lues anciennes.
- Cloche et page dans l'application mobile Expo.
