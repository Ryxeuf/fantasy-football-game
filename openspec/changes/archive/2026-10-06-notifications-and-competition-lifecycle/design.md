# Design — Notifications internes & cycle de vie des compétitions

## Modèle de données

```prisma
model Notification {
  id        String    @id @default(cuid())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  kind      String    // "league.invitation", "cup.invitation", "league.round_pairing",
                      // "league.match_validation", "friend.request", "friend.accepted",
                      // "league.archived", "league.deleted", "cup.archived", "cup.deleted"
  title     String
  body      String
  url       String?   // lien relatif web ; null = pas de cible (ex : ligue supprimée)
  meta      Json?     // ids libres — objet natif (PG) ou string (miroir sqlite)
  readAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, readAt])
  @@index([userId, createdAt])
}
```

Alternatives écartées :

- **Dériver les notifications des tables existantes** (invitations pending,
  demandes d'ami, pairings…) sans table : impossible de représenter « lu »
  sans une table d'état par utilisateur, et le compteur exigerait N requêtes
  par affichage de menu. Une table dénormalisée coûte une écriture par
  évènement et une requête indexée par affichage.
- **Réutiliser `PushSubscription` / les préférences push** : ce sont des
  canaux de livraison, pas un historique.

`prisma/migrations/` étant gitignoré (prod = `db push`), le modèle est
entièrement additif : aucune colonne existante n'est touchée.

## Service `in-app-notifications`

- `createInAppNotification(input)` — **ne throw jamais** ; renvoie la ligne
  ou `null`. Même posture que `notifyInvitedCoach`.
- `createInAppNotifications(userIds, payload)` — fan-out dédupliqué
  (`createMany`) pour les participants d'une compétition.
- `listNotifications(userId, { limit ≤ 100, offset, unreadOnly })` →
  `{ items, total, unreadCount }`.
- `countUnreadNotifications(userId)`.
- `markNotificationRead(userId, id)` / `markAllNotificationsRead(userId)` —
  `updateMany` filtré par `userId` : un utilisateur ne peut jamais marquer
  la notification d'un autre, et l'appel est idempotent.
- `serializeNotification(row)` — parse `meta` tolérant PG/sqlite.

## Points de branchement

| Évènement | Module | Destinataire | `kind` |
|---|---|---|---|
| Invitation de ligue | `league-invitation-notify` | invité (userId) | `league.invitation` |
| Invitation de coupe | `cup-invitation-notify` | invité (userId) | `cup.invitation` |
| Appariement J{n} | `push-notifications.sendLeagueRoundReminderPush` | chaque coach | `league.round_pairing` |
| Match prêt à valider | `push-notifications.sendLeagueMatchValidationPush` | commissaire | `league.match_validation` |
| Demande d'ami | `friendship.sendFriendRequest` | destinataire | `friend.request` |
| Demande acceptée | `friendship.respondToFriendRequest` | demandeur | `friend.accepted` |
| Archivage / suppression | `competition-lifecycle` | participants (hors acteur) | `league.archived`… |

Le branchement se fait **dans** les fonctions de push existantes, avant le
contrôle de préférence : elles sont déjà l'unique point de fan-out et leurs
appelants les mockent en bloc dans les tests. La création interne précède
le push et n'en dépend pas.

## Cycle de vie des compétitions

- `archiveLeague` / `deleteLeague` / `archiveCup` / `deleteCup` dans
  `services/competition-lifecycle.ts`, erreurs `CompetitionLifecycleError`
  (`not_found` → 404, `forbidden` → 403).
- Autorisation : `creatorId === actor` **ou** rôle `admin`.
- Archivage idempotent (`changed: false` si déjà archivé) ; aucun verrou de
  statut : un commissaire peut clore une ligue en cours (les feuilles et
  classements restent consultables, cf. page `/leagues/archived`).
- Suppression : les participants sont résolus **avant** le `delete` (la
  cascade emporte saisons, poules, appariements, feuilles, invitations,
  documents) et notifiés **après** sa réussite — jamais d'annonce d'une
  suppression qui a échoué. `Match.leagueSeasonId` passe à `null`
  (`onDelete: SetNull`) : les matchs joués en ligne survivent.
- Routes : `routes/competition-lifecycle.ts` expose deux routeurs
  (`leagueLifecycleRouter`, `cupLifecycleRouter`) construits par la même
  fabrique, montés sur `/leagues` et `/cup` avant les routeurs historiques.

## Web

- `NotificationsProvider` (contexte global, hook `useNotifications()` no-op
  hors provider) : interroge `GET /notifications/unread-count` au montage,
  toutes les 60 s et au retour de focus, uniquement si un token est présent.
- `NotificationsBell` : lien vers `/me/notifications` + pastille si
  `unreadCount > 0`. Bureau : à côté du menu utilisateur ; mobile : à côté
  du bouton menu, et entrée dans le menu utilisateur.
- `/me/notifications` : liste (50 par page, « charger plus »), les éléments
  non lus sont mis en avant puis **marqués lus dès l'affichage**
  (`POST /notifications/read-all`), le compteur du menu se rafraîchit.
- Pages ligue et coupe : section « Gestion » (commissaire ou admin) avec
  « Archiver » (confirmation simple) et « Supprimer » (saisie du nom).
