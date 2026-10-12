# Clés API d'administration

## Why

Les seuls moyens de parler au serveur sont un JWT d'accès de 15 minutes
(rafraîchi par un refresh token de 7 jours, conçu pour un navigateur) et le
jeton statique de `/metrics`. Un client automatisé — un agent Claude Code
dans un environnement cloud, un script de recette, une CI — n'a donc aucun
moyen propre de s'authentifier : il faudrait lui confier le mot de passe d'un
admin, ou recopier à la main un token qui expire au bout d'un quart d'heure.

Le besoin concret : lancer des tests (smoke tests, vérifications après
déploiement, lectures de diagnostic) contre le serveur de production avec
une identité d'admin, à partir d'un secret stocké dans les variables
d'environnement du client — jamais collé dans une conversation.

## What Changes

- **Clés API créées depuis l'admin** : un admin crée une clé nommée, choisit
  sa portée et son expiration, et reçoit le secret UNE seule fois. La base ne
  garde qu'une empreinte SHA-256, un préfixe d'identification et les
  métadonnées (propriétaire, dates, dernier usage, révocation).
- **Authentification par clé** : `Authorization: Bearer nak_…` (ou
  `X-API-Key: nak_…`) est accepté partout où un JWT l'est (`authUser`,
  `optionalAuthUser`, `requireFeatureFlag`, `/feature-flags/me`). La requête
  s'exécute au nom du propriétaire de la clé, avec ses rôles RELUS en base.
- **Portée** : `read` (défaut) n'autorise que `GET` / `HEAD` / `OPTIONS` ;
  `write` autorise tout ce que le propriétaire peut faire.
- **Refus** : clé inconnue, révoquée, expirée, propriétaire supprimé, banni,
  désactivé ou qui n'est plus admin ⇒ 401, sans distinguer la cause.
- **Actions réservées à une session interactive** : gérer les clés,
  impersonner un utilisateur, modifier son propre compte (profil, mot de
  passe, désactivation) — une clé fuitée ne peut pas se perpétuer en
  fabriquant d'autres accès.
- **Traçabilité** : `AuditLog` et `TeamAuditEvent` portent l'id de la clé
  quand une action passe par elle ; création et révocation sont journalisées
  (sans le secret).
- **Page admin `/admin/api-keys`** : liste (préfixe, portée, propriétaire,
  expiration, dernier usage, statut), création avec affichage unique du
  secret et rappel de configuration d'un environnement Claude Code,
  révocation.
- **Script de smoke test distant** (`pnpm smoke:remote`) : lit
  `NUFFLE_API_URL` et `NUFFLE_API_KEY`, vérifie la santé du serveur,
  l'identité de la clé et une série de lectures publiques et admin.

## Capabilities

### New Capabilities

- `admin-api-keys` : cycle de vie des clés API d'administration,
  authentification par clé, portée, refus, actions réservées à une session
  interactive, traçabilité, smoke test distant.

### Modified Capabilities

Aucune (l'impersonation reste décrite par `admin-user-impersonation` ; son
refus via une clé est porté par la nouvelle capacité).

## Impact

- **Base** : modèle `ApiKey` (nouveau) et colonne nullable `apiKeyId` sur
  `AuditLog` et `TeamAuditEvent`, dans `prisma/schema.prisma` ET le miroir
  `apps/server/prisma/sqlite/schema.prisma` ; client SQLite régénéré. Tout
  est lisible sans backfill (`db push`).
- **Serveur** : module pur `services/api-key-rules`, service
  `services/api-keys`, middlewares `authUser` / `optionalAuthUser` /
  `requireFeatureFlag` / `sessionOnly`, `routes/feature-flags` (auth
  optionnelle locale), `routes/admin-api-keys` (nouveau), `routes/admin`
  (impersonation), `routes/auth` (compte courant, `/auth/me` annonce la clé),
  `services/audit-log`, `services/team-audit`, `utils/audit-context`.
- **Web** : page `/admin/api-keys`, wrapper `lib/admin-api-keys`, entrée de
  menu « Système », badge « clé API » du journal d'audit.
- **Outillage** : `apps/server/src/scripts/remote-smoke.ts` + script racine
  `smoke:remote`.
- **Doc** : `docs/admin-api-keys.md`, section `CLAUDE.md`.
- **Hors périmètre** : WebSocket (le handshake Socket.IO reste JWT), rate
  limit et mode maintenance inchangés (une clé n'en contourne aucun).
