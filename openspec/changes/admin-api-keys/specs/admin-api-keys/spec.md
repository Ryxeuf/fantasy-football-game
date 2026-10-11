# admin-api-keys

## ADDED Requirements

### Requirement: Création d'une clé API par un admin

Un administrateur DOIT pouvoir créer une clé API nommée via
`POST /admin/api-keys`, en choisissant sa portée (`read` ou `write`) et une
expiration (de 1 à 365 jours, ou aucune). La clé DOIT appartenir à l'admin
qui la crée. Le secret DOIT être renvoyé dans la réponse de création et
NULLE PART ailleurs : la base NE DOIT stocker que son empreinte SHA-256 et
un préfixe d'identification. La création DOIT être journalisée sans le
secret.

#### Scenario: Création d'une clé en lecture seule
- WHEN un admin crée une clé « Recette prod », portée `read`, 90 jours
- THEN la réponse DOIT contenir le secret (préfixé `nak_`) et son préfixe
- AND la base NE DOIT contenir que l'empreinte du secret
- AND l'expiration DOIT être posée à 90 jours
- AND l'action DOIT être journalisée (`api-key.create`) sans le secret

#### Scenario: Le secret ne se relit pas
- WHEN un admin liste les clés
- THEN aucune entrée NE DOIT contenir le secret ni son empreinte

#### Scenario: Paramètres invalides
- WHEN le nom est vide, la portée inconnue ou l'expiration hors bornes
- THEN la requête DOIT être refusée (HTTP 400)

### Requirement: Liste et révocation des clés

Un administrateur DOIT pouvoir lister toutes les clés (nom, préfixe,
portée, propriétaire, création, expiration, dernier usage, révocation) et
révoquer n'importe laquelle. La révocation DOIT prendre effet à la requête
suivante et DOIT être journalisée. Révoquer une clé déjà révoquée NE DOIT
rien changer.

#### Scenario: Révocation immédiate
- WHEN un admin révoque une clé
- THEN la requête suivante authentifiée par cette clé DOIT être refusée
  (HTTP 401)

#### Scenario: Clé inexistante
- WHEN un admin révoque un id inconnu
- THEN la requête DOIT être refusée (HTTP 404)

### Requirement: Authentification par clé

Le serveur DOIT accepter une clé API dans `Authorization: Bearer <clé>` ou
`X-API-Key: <clé>`, sur toute route qui accepte un token de session. La
requête DOIT s'exécuter au nom du propriétaire de la clé, avec les rôles
lus en base au moment de la requête. Une session par JWT DOIT se comporter
exactement comme avant.

#### Scenario: Lecture admin par clé
- WHEN un client appelle une route admin en `GET` avec une clé valide dont
  le propriétaire est admin
- THEN la requête DOIT être servie comme pour une session de ce
  propriétaire

#### Scenario: Identité de la clé
- WHEN un client appelle `GET /auth/me` avec une clé valide
- THEN la réponse DOIT décrire le propriétaire et annoncer la clé utilisée
  (nom, préfixe, portée)

#### Scenario: JWT inchangé
- WHEN un client appelle une route avec un JWT de session valide
- THEN la requête DOIT être servie comme avant l'introduction des clés

### Requirement: Refus d'une clé inutilisable

Une clé inconnue, révoquée ou expirée, ou dont le propriétaire est supprimé,
banni, désactivé ou n'est plus admin, DOIT être refusée avec une réponse
identique quelle que soit la cause (HTTP 401). Sur une route à
authentification optionnelle, une telle clé DOIT être traitée comme une
absence d'authentification.

#### Scenario: Clé expirée
- WHEN une clé dont l'expiration est passée est présentée
- THEN la requête DOIT être refusée (HTTP 401) avec la même réponse qu'une
  clé inconnue

#### Scenario: Propriétaire rétrogradé
- WHEN le propriétaire d'une clé perd le rôle admin
- THEN ses clés DOIVENT être refusées dès la requête suivante

#### Scenario: Route publique
- WHEN une clé révoquée est présentée à une route à authentification
  optionnelle
- THEN la route DOIT servir la vue publique

### Requirement: Portée d'une clé

Une clé de portée `read` NE DOIT autoriser que les méthodes `GET`, `HEAD`
et `OPTIONS` ; toute autre méthode DOIT être refusée (HTTP 403), y compris
sur une route à authentification optionnelle. Une clé de portée `write`
DOIT autoriser ce que son propriétaire peut faire, hors actions réservées à
une session interactive.

#### Scenario: Écriture avec une clé en lecture seule
- WHEN un client envoie un `POST` avec une clé de portée `read`
- THEN la requête DOIT être refusée (HTTP 403, `api_key_read_only`)

#### Scenario: Écriture avec une clé en écriture
- WHEN un client envoie un `PATCH` admin avec une clé de portée `write`
- THEN la requête DOIT être servie

### Requirement: Actions réservées à une session interactive

Une requête authentifiée par clé DOIT être refusée (HTTP 403,
`interactive_session_required`) sur : la gestion des clés API,
l'impersonation d'un utilisateur, la modification du profil, du mot de
passe et la désactivation du compte courant.

#### Scenario: Une clé ne crée pas de clé
- WHEN un client appelle `POST /admin/api-keys` avec une clé de portée
  `write`
- THEN la requête DOIT être refusée (HTTP 403)

#### Scenario: Une clé n'impersonne pas
- WHEN un client appelle `POST /admin/users/:id/impersonate` avec une clé
  de portée `write`
- THEN la requête DOIT être refusée (HTTP 403) et aucun token émis

### Requirement: Traçabilité des actions faites par clé

Une action admin ou une mutation d'équipe faite par clé DOIT être tracée
avec l'id de la clé, en plus de l'id de son propriétaire. Le dernier usage
d'une clé (date, IP) DOIT être visible dans l'admin, avec une précision
d'au moins une minute, sans retarder les requêtes.

#### Scenario: Action admin par clé
- WHEN une clé de portée `write` déclenche une action admin journalisée
- THEN la ligne du journal DOIT porter l'id du propriétaire ET l'id de la
  clé

#### Scenario: Action faite à la main
- WHEN un admin agit par sa session
- THEN la ligne du journal NE DOIT porter aucun id de clé

### Requirement: Smoke test distant

Le dépôt DOIT fournir une commande qui, à partir de `NUFFLE_API_URL` et
`NUFFLE_API_KEY`, vérifie en lecture seule la santé du serveur, l'identité
de la clé et une série de lectures, puis sort en échec si une vérification
échoue. Le secret NE DOIT jamais être affiché.

#### Scenario: Serveur sain
- WHEN toutes les vérifications réussissent
- THEN la commande DOIT sortir avec le code 0 et un rapport par
  vérification

#### Scenario: Clé absente
- WHEN aucune clé n'est fournie et que le serveur répond 401 aux
  vérifications authentifiées
- THEN ces vérifications DOIVENT être rapportées « ignorées » et les
  vérifications publiques jouées normalement
