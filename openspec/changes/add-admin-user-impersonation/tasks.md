# Tasks — Se connecter en tant que (impersonation admin)

> TDD : token + gardes d'abord, puis bascule client et UI.
> Calque sur `specs/admin-user-impersonation/spec.md`.

## 1. Token d'impersonation (serveur)
- [x] 1.1 `auth-tokens.ts` : `IMPERSONATION_TOKEN_TTL_SECONDS` (1 h) +
      `signImpersonationToken({ sub, role, roles, act })` → access token
      `imp: true`, sans refresh.
- [x] 1.2 `middleware/authUser.ts` : `AuthenticatedUser.impersonatorId` peuplé
      depuis le claim `act`.

## 2. Route + audit
- [x] 2.1 `routes/admin.ts` : `POST /users/:id/impersonate` (gardes self / 404 /
      soft-delete / banni), rôles de la cible, audit `user.impersonate` (sans
      token), réponse `{ token, expiresIn, impersonatedUser }`.
- [x] 2.2 `routes/auth.ts` : `/auth/me` expose `impersonatedBy` (lookup admin
      via `req.user.impersonatorId`).

## 3. Bascule + UI (web)
- [x] 3.1 `lib/auth-storage.ts` : `startImpersonation` / `stopImpersonation` /
      `isImpersonating` / `getImpersonationTargetLabel` (sauvegarde admin,
      retrait du refresh actif, restauration).
- [x] 3.2 `ImpersonationBanner.tsx` : bannière globale + « Revenir à mon
      compte » ; montée dans `layout.tsx`.
- [x] 3.3 `admin/users/page.tsx` : bouton « Se connecter en tant que » par ligne
      (masqué si supprimé/banni) + handler (confirm → POST → start → redirect).

## 4. Tests
- [x] 4.1 `auth-tokens.impersonation.test.ts` : claims `sub`/`act`/`imp`, rôles
      de la cible, TTL (3).
- [x] 4.2 `authUser.test.ts` : `impersonatorId` présent/absent (+2).
- [x] 4.3 `admin-impersonate.test.ts` : succès + claims, audit sans token, self
      400, 404, supprimé 400, banni 400 (6).
- [x] 4.4 `auth-storage.test.ts` : start/stop/is/label + round-trip (+5).

## 5. Vérification
- [x] 5.1 `vitest run` serveur : token (3) + authUser (14) + route (6) — vert.
- [x] 5.2 `vitest run` web : `auth-storage` (16) — vert.
- [x] 5.3 Garde-fou `routes/no-raw-body-cast.test.ts` vert.
- [x] 5.4 `pnpm --filter server typecheck` vert.
- [ ] 5.5 `pnpm --filter web typecheck` : aucune nouvelle erreur introduite (les
      erreurs `typedRoutes`/`.next/types` préexistantes sur `main` ne touchent
      pas ces fichiers).
