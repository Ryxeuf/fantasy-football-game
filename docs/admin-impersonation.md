# Se connecter en tant que (impersonation admin)

Permet à un administrateur d'ouvrir une session « en tant que » un utilisateur
cible, pour reproduire et déboguer un problème vu par ce compte, puis de revenir
à sa session admin sans re-login. Action **tracée** et **bornée dans le temps**.

## Flux

1. Dans `admin/users`, l'admin clique « 🎭 Se connecter en tant que » sur une
   ligne (bouton masqué pour les comptes supprimés/bannis).
2. Le front appelle `POST /admin/users/:id/impersonate`. Le serveur (gardes
   `authUser` + `adminOnly`) émet un **access token** signé pour la cible.
3. Le front sauvegarde les tokens admin, bascule l'access token sur la cible et
   **retire le refresh token actif**, puis recharge l'application sur `/`.
4. Une **bannière** (`ImpersonationBanner`, montée dans `layout.tsx`) reste
   affichée tant que l'impersonation est active.
5. « Revenir à mon compte » restaure les tokens admin et recharge
   `admin/users`.

## Token d'impersonation

`signImpersonationToken` ([`auth-tokens.ts`](../apps/server/src/services/auth-tokens.ts)) :

- `typ: "access"` → c'est un access token normal, accepté tel quel par
  `authUser` (pas de chemin de vérification spécial).
- `sub` = utilisateur **cible** ; `roles` = ceux de la **cible** (l'admin n'a
  que les droits de l'utilisateur pendant l'impersonation — pas d'escalade).
- `act` = id de l'admin à l'origine (claim « actor », cf. RFC 8693) ; `imp: true`.
- TTL = `IMPERSONATION_TOKEN_TTL_SECONDS` (1 h). **Aucun refresh token n'est
  émis** : la session usurpée expire d'elle-même et ne peut pas être prolongée
  silencieusement.

`authUser` peuple `req.user.impersonatorId` depuis `act`. `GET /auth/me` expose
`impersonatedBy: { id, coachName } | null`.

## Côté client

[`lib/auth-storage.ts`](../apps/web/app/lib/auth-storage.ts) gère la bascule via
des clés `imp_backup_token` / `imp_backup_refresh_token` / `imp_target_label` :

- `startImpersonation(token, label)` : sauvegarde `auth_token` +
  `auth_refresh_token` courants, écrit le token cible dans `auth_token`, **retire
  `auth_refresh_token`** (sinon un refresh automatique rebasculerait sur
  l'identité admin).
- `isImpersonating()` : vrai tant que la sauvegarde admin existe — donc fiable
  **même si le token d'impersonation a expiré** (l'admin peut toujours revenir).
- `stopImpersonation()` : restaure les tokens admin, nettoie les clés.

## Sécurité

- `adminOnly` revérifie le rôle admin **en base** à l'émission.
- Refus d'impersonner : soi-même (400), un compte supprimé (400), un compte
  banni (400), un compte inexistant (404).
- Action journalisée dans `AuditLog` (`user.impersonate`, `newValue =
  { impersonatorId }`) — **le token n'est jamais journalisé**.
- Fenêtre d'usurpation bornée à 1 h, non renouvelable (pas de refresh).

## Limites volontaires

- Pas de table d'état serveur « qui impersonne qui » en temps réel : le claim
  `act` et l'audit log suffisent.
- Pas de blocage d'impersonation d'un autre admin (l'appelant est déjà admin).
- Aucune modification de schéma Prisma.

## Tests

- Serveur : `auth-tokens.impersonation.test.ts`, `authUser.test.ts` (bloc
  impersonation), `admin-impersonate.test.ts`.
- Web : `auth-storage.test.ts` (bloc impersonation).
