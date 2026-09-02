# admin-user-impersonation (delta)

Capability : un administrateur peut ouvrir une session « en tant que » un
utilisateur cible (impersonation), de façon tracée et bornée dans le temps, puis
revenir à sa propre session. Surface serveur (`apps/server`) + UI admin
(`apps/web`).

## ADDED Requirements

### Requirement: Émission d'un token d'impersonation par un admin
Un administrateur DOIT pouvoir obtenir un token de session pour un utilisateur
cible via `POST /admin/users/:id/impersonate`. La route DOIT être gardée par
`authUser` + `adminOnly` (rôle admin revérifié en base). Le token émis DOIT
avoir pour `sub` la cible, porter le claim `act` = id de l'admin et `imp: true`,
hériter des rôles de la cible, expirer en au plus 1 heure, et NE PAS être
accompagné d'un refresh token. L'action DOIT être journalisée (`AuditLog`,
`user.impersonate`) sans jamais inclure le token.

#### Scenario: Impersonation d'un compte valide
- WHEN un admin appelle `POST /admin/users/:id/impersonate` sur un compte
  existant, non supprimé et non banni
- THEN la réponse DOIT contenir un access token signé pour la cible
  (`sub` = cible, `act` = admin, `imp: true`) et `expiresIn`
- AND aucun refresh token NE DOIT être émis
- AND l'action DOIT être journalisée (`user.impersonate`) sans le token

#### Scenario: Refus de s'impersonner soi-même
- WHEN l'admin cible son propre id
- THEN la requête DOIT être refusée (HTTP 400)
- AND aucun token NE DOIT être émis ni aucune action journalisée

#### Scenario: Refus sur compte supprimé ou banni
- WHEN la cible est soft-delete (`deletedAt` non nul) ou bannie
  (`bannedUntil` dans le futur)
- THEN la requête DOIT être refusée (HTTP 400)

#### Scenario: Cible inexistante
- WHEN la cible n'existe pas
- THEN la requête DOIT répondre HTTP 404

### Requirement: Périmètre de privilèges pendant l'impersonation
Le token d'impersonation NE DOIT conférer que les rôles de la cible. Un admin
qui impersonne un utilisateur non-admin NE DOIT PAS conserver ses droits admin
au sein de la session usurpée.

#### Scenario: Pas d'escalade de privilèges
- WHEN un admin impersonne un compte de rôle `user`
- THEN le token émis NE DOIT PAS contenir le rôle `admin`

### Requirement: Exposition de l'état d'impersonation
`authUser` DOIT peupler `req.user.impersonatorId` à partir du claim `act`.
`GET /auth/me` DOIT exposer `impersonatedBy` (id + `coachName` de l'admin) quand
la session est usurpée, et `null` sinon.

#### Scenario: /auth/me sur session usurpée
- WHEN la requête présente un token d'impersonation
- THEN `/auth/me` DOIT renvoyer `impersonatedBy` non nul identifiant l'admin

#### Scenario: /auth/me sur session normale
- WHEN la requête présente un token normal (sans claim `act`)
- THEN `/auth/me` DOIT renvoyer `impersonatedBy: null`

### Requirement: Bascule et retour côté client
L'UI admin DOIT permettre de démarrer une impersonation et d'y mettre fin. Au
démarrage, les tokens admin DOIVENT être sauvegardés, l'access token actif
basculé sur la cible, et le refresh token actif retiré (pas de renouvellement
silencieux). « Revenir à mon compte » DOIT restaurer les tokens admin
sauvegardés. Une bannière DOIT être affichée tant que l'impersonation est
active, indépendamment de la validité du token d'impersonation.

#### Scenario: Démarrage
- WHEN l'admin déclenche « Se connecter en tant que » sur un utilisateur
- THEN les tokens admin DOIVENT être sauvegardés
- AND l'access token actif DOIT devenir celui de la cible
- AND le refresh token actif DOIT être retiré
- AND une bannière d'impersonation DOIT être affichée

#### Scenario: Retour à la session admin
- WHEN l'admin clique « Revenir à mon compte »
- THEN les tokens admin sauvegardés DOIVENT être restaurés
- AND la bannière NE DOIT plus être affichée
