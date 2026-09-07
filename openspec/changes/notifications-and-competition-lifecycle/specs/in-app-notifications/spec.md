# in-app-notifications

## ADDED Requirements

### Requirement: Notification interne persistante par utilisateur

Le système DOIT conserver, pour chaque utilisateur, une liste de
notifications internes (`Notification` : `kind`, `title`, `body`, `url`
facultatif, `meta` facultatif, `readAt`, `createdAt`). La création d'une
notification DOIT être un effet secondaire **jamais bloquant** : une erreur
de persistance DOIT être journalisée et NE DOIT PAS faire échouer l'action
métier qui l'a déclenchée. La création NE DOIT PAS dépendre des préférences
push de l'utilisateur.

#### Scenario: La base est indisponible au moment de notifier

- WHEN une invitation de ligue est créée et que l'écriture de la notification échoue
- THEN l'invitation DOIT être créée normalement
- AND l'erreur DOIT être journalisée côté serveur

### Requirement: Évènements générant une notification

Une notification DOIT être créée pour : une invitation à une ligue ou à une
coupe adressée à un utilisateur identifié ; l'appariement d'un coach pour
une journée de ligue ; un match prêt à valider (destinataire : le
commissaire) ; une demande d'ami reçue ; une demande d'ami acceptée
(destinataire : le demandeur) ; l'archivage ou la suppression d'une ligue
ou d'une coupe (destinataires : les coachs dont une équipe est inscrite,
hors auteur de l'action).

#### Scenario: Invitation de ligue ciblant un coach

- WHEN le commissaire invite le coach B par son identifiant
- THEN B DOIT recevoir une notification `league.invitation` dont l'URL mène à l'acceptation de l'invitation

#### Scenario: Demande d'ami

- WHEN A envoie une demande d'ami à B
- THEN B DOIT recevoir une notification `friend.request`
- AND WHEN B accepte, A DOIT recevoir une notification `friend.accepted`

### Requirement: Consultation, compteur et lecture

L'API DOIT exposer, pour l'utilisateur authentifié uniquement :
`GET /notifications` (liste paginée, plus récentes d'abord, avec le nombre
de non lus), `GET /notifications/unread-count`, `POST /notifications/:id/read`
et `POST /notifications/read-all`. Marquer comme lu DOIT être idempotent et
NE DOIT jamais affecter la notification d'un autre utilisateur.

#### Scenario: Compteur de non lus

- WHEN B a reçu deux notifications et n'en a lu aucune
- THEN `GET /notifications/unread-count` DOIT renvoyer `2`

#### Scenario: Lecture globale

- WHEN B appelle `POST /notifications/read-all`
- THEN toutes ses notifications DOIVENT porter un `readAt`
- AND le compteur DOIT renvoyer `0`

#### Scenario: Isolation entre utilisateurs

- WHEN A appelle `POST /notifications/<id d'une notification de B>/read`
- THEN la réponse DOIT être `404`
- AND la notification de B DOIT rester non lue

### Requirement: Menu et page web

L'en-tête du site DOIT afficher, pour un utilisateur connecté, une cloche
menant à `/me/notifications` avec le **nombre de notifications non lues**
(masqué à zéro), rafraîchi périodiquement et au retour sur l'onglet. La page
`/me/notifications` DOIT lister les notifications et DOIT les **marquer
lues dès leur consultation**, en mettant à jour le compteur du menu.

#### Scenario: Ouverture de la page

- WHEN un coach ayant 3 notifications non lues ouvre `/me/notifications`
- THEN les 3 notifications DOIVENT être affichées, distinguées comme nouvelles
- AND elles DOIVENT être marquées lues
- AND la pastille du menu DOIT disparaître
