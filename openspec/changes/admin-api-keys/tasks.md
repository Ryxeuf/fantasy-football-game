# Tasks — clés API d'administration

## 1. Modèle (base)

- [x] 1.1 Ajouter le modèle `ApiKey` (`name`, `keyPrefix`, `keyHash @unique`, `scope`, `userId` → `User` en cascade, `expiresAt?`, `lastUsedAt?`, `lastUsedIp?`, `revokedAt?`, `revokedById?`, `createdAt`) et la colonne nullable `apiKeyId` sur `AuditLog` et `TeamAuditEvent`, dans `prisma/schema.prisma` ET `apps/server/prisma/sqlite/schema.prisma` ; régénérer le client SQLite de test — vérifier : `pnpm --filter @bb/server typecheck` passe.

## 2. Règles et service (serveur)

- [x] 2.1 Module pur `services/api-key-rules` : génération (`nak_` + 32 octets base64url), empreinte, préfixe, extraction de l'en-tête (`Bearer` / `X-API-Key`), `evaluateApiKey(row, now)`, méthodes autorisées par portée, échéance d'expiration, échantillonnage du dernier usage — vérifier : tests unitaires (format, discriminant JWT, chaque cause de refus, portée, bornes d'expiration).
- [x] 2.2 Service `services/api-keys` : création (renvoie le secret une fois), liste (sans secret ni empreinte), révocation idempotente, résolution d'une clé avec son propriétaire, dernier usage échantillonné hors chemin critique — vérifier : tests avec Prisma mocké.

## 3. Authentification (serveur)

- [x] 3.1 `authUser` / `optionalAuthUser` : branche clé avant `jwt.verify`, chemin JWT synchrone inchangé, résolution mémorisée par requête, portée appliquée, `req.user.apiKey`, `setAuditActor({ apiKeyId })` — vérifier : tests du middleware (JWT inchangé, clé valide, clé refusée ⇒ 401 / vue publique, lecture seule ⇒ 403 sur POST, mémorisation).
- [x] 3.2 `requireFeatureFlag` et l'auth optionnelle locale de `routes/feature-flags` reconnaissent la clé — vérifier : tests.
- [x] 3.3 Middleware `sessionOnly` posé sur l'impersonation et sur `PUT /auth/me`, `PUT /auth/me/password`, `DELETE /auth/me` ; `GET /auth/me` annonce la clé utilisée — vérifier : tests de route.
- [x] 3.4 (revue sécurité) `sessionOnly` aussi sur `PATCH /admin/users/:id/role`, `POST /admin/users/:id/password-reset`, `PATCH /admin/users/:id/valid` — vérifier : `admin-session-only.test.ts`.

## 4. Traçabilité (serveur)

- [x] 4.1 `utils/audit-context` porte `apiKeyId` ; `recordTeamAudit` et `recordAdminActionFromRequest` l'écrivent ; `GET /admin/audit-log` le sert — vérifier : tests (avec et sans clé).

## 5. Routes admin (serveur)

- [x] 5.1 `routes/admin-api-keys` (`GET /`, `POST /`, `POST /:id/revoke`) derrière `authUser`, `adminOnly`, `sessionOnly`, schémas Zod dans `schemas/api-key.schemas`, journal `api-key.create` / `api-key.revoke` sans secret ; monté sur `/admin/api-keys` — vérifier : tests de route (création, 400, liste sans secret, révocation, 404, clé refusée en 403).

## 6. Admin web

- [x] 6.1 Wrapper `lib/admin-api-keys` (types + appels + libellés purs : statut, expiration, portée) — vérifier : tests unitaires.
- [x] 6.2 Page `/admin/api-keys` : liste, formulaire (nom, portée lecture par défaut, expiration 90 j par défaut), secret affiché une fois avec copie et rappel de configuration d'un environnement Claude Code, révocation confirmée ; entrée « Clés API » dans la section « Système » — vérifier : tests de rendu.
- [x] 6.3 Journal d'audit : badge « clé API » sur les lignes portant `apiKeyId` — vérifier : test de rendu.

## 7. Smoke test distant et documentation

- [x] 7.1 `apps/server/src/scripts/remote-smoke.ts` (logique pure + exécution) et script racine `smoke:remote` — vérifier : tests avec `fetch` injecté (succès, échec, clé absente ⇒ ignorées, secret jamais affiché).
- [x] 7.2 `docs/admin-api-keys.md` (création, configuration d'un environnement Claude Code, usage curl, sécurité, limites) et section `CLAUDE.md` — vérifier : relecture.
