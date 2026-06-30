# Se connecter en tant que (impersonation admin)

## Why

Le support et le debug d'un problème spécifique à un compte (roster cassé, état
de ligue incohérent, bug visible seulement pour un coach donné) imposaient
jusqu'ici de demander le mot de passe de l'utilisateur ou de reproduire
l'environnement à l'aveugle. L'admin disposait déjà d'un large arsenal sur
[`routes/admin.ts`](../../../apps/server/src/routes/admin.ts) (ban, reset
password, soft-delete, rôles…) mais d'aucun moyen de **voir l'application avec
les yeux de l'utilisateur**. Le besoin : pouvoir ouvrir une session en tant que
n'importe quel compte, de façon tracée et bornée dans le temps, puis revenir à
sa session admin sans re-login.

## What Changes

- **Token d'impersonation.** Nouvel helper `signImpersonationToken` : un access
  token normal (`typ: "access"`, donc accepté tel quel par `authUser`) dont le
  `sub` est l'utilisateur **cible** et qui porte un claim `act` = id de l'admin
  (« actor », cf. RFC 8693) plus `imp: true`. Le token hérite des rôles de la
  **cible** (l'admin n'a que les droits de l'utilisateur pendant l'impersonation).
  TTL court (1 h, `IMPERSONATION_TOKEN_TTL_SECONDS`) et **aucun refresh token
  émis** : la session usurpée expire d'elle-même et ne peut pas être prolongée
  silencieusement.
- **Route admin.** `POST /admin/users/:id/impersonate` (gardée `authUser` +
  `adminOnly`) : refuse de s'impersonner soi-même, un compte soft-delete ou un
  compte banni ; émet le token ; journalise `user.impersonate` dans `AuditLog`
  (jamais le token en clair).
- **`/auth/me`.** Expose `impersonatedBy: { id, coachName } | null` lorsque la
  session porte un claim `act`, pour que l'UI sache qu'elle est usurpée et par
  qui. `authUser` peuple désormais `req.user.impersonatorId`.
- **Bascule côté client.** `auth-storage` gagne `startImpersonation` /
  `stopImpersonation` / `isImpersonating` / `getImpersonationTargetLabel` :
  sauvegarde des tokens admin, bascule de l'access token sur la cible, **retrait
  du refresh token actif** (pas de renouvellement silencieux ni de rebascule
  accidentelle vers l'admin), restauration au retour.
- **UI.** Bouton « Se connecter en tant que » par ligne dans
  `admin/users` (masqué pour les comptes supprimés/bannis) ; bannière globale
  `ImpersonationBanner` (montée dans `layout.tsx`) avec « Revenir à mon compte ».

Hors périmètre (volontaire) : pas de table d'état serveur « qui impersonne qui »
en temps réel (le claim `act` + l'audit log suffisent) ; pas de blocage
d'impersonation d'un autre admin (l'appelant est déjà admin) ; aucune
modification de schéma Prisma.

## Impact

- **Capability** : `admin-user-impersonation` (nouvelle).
- **Code serveur** : `services/auth-tokens.ts` (`signImpersonationToken` +
  `IMPERSONATION_TOKEN_TTL_SECONDS`) ; `middleware/authUser.ts`
  (`impersonatorId`) ; `routes/admin.ts` (route) ; `routes/auth.ts`
  (`/auth/me` → `impersonatedBy`).
- **Code web** : `lib/auth-storage.ts` (helpers), `ImpersonationBanner.tsx`
  (nouveau), `layout.tsx` (montage), `admin/users/page.tsx` (bouton + handler).
- **Tests** : `auth-tokens.impersonation.test.ts` (3) ; `authUser.test.ts`
  (+2) ; `admin-impersonate.test.ts` (6) ; `auth-storage.test.ts` (+5).
- **Données** : aucune migration.
- **Sécurité** : fenêtre d'usurpation bornée (1 h, pas de refresh) ; rôle admin
  revérifié en base par `adminOnly` à l'émission ; action auditée ; le token
  n'est jamais journalisé.
