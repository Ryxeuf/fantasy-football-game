# Design — clés API d'administration

## Context

Voir `proposal.md` (Why). État du code utile ici :

- `authUser` / `optionalAuthUser` (`middleware/authUser.ts`) prennent tout ce
  qui suit le premier espace de `Authorization` et le passent à
  `jwt.verify`. Ils sont SYNCHRONES ; deux autres parseurs refont la même
  chose : `requireFeatureFlag` (monté AVANT l'auth de route) et une copie
  locale d'`optionalAuthUser` dans `routes/feature-flags.ts`.
- `adminOnly` relit déjà le rôle en base. Les routeurs admin font
  `router.use(authUser, adminOnly)`, et `app.use("/admin", adminRoutes)` est
  monté avant les sous-routeurs `/admin/*` : une même requête traverse donc
  plusieurs fois `authUser`.
- `PasswordResetToken` est le précédent de stockage d'un secret : 32 octets
  aléatoires en base64url, seule l'empreinte SHA-256 est stockée
  (`tokenHash @unique`).
- `AuditLog` (actions admin) et `TeamAuditEvent` (journal d'équipe) tracent
  l'acteur ; `TeamAuditEvent` lit l'acteur dans le contexte ambiant
  (`utils/audit-context`, rempli par `setAuditActor` depuis l'auth).
- Rate limit : 100 requêtes/min par IP, liste blanche d'IP par env. Mode
  maintenance : liste de préfixes autorisés, aucun contournement par rôle.
- `prisma/migrations/` est gitignoré : la prod est en `db push`, toute
  colonne ajoutée à une table existante est nullable et lue sans backfill.
- L'environnement cloud de Claude Code sort par un proxy HTTPS ; le `fetch`
  natif de Node 22 ne le suit qu'avec `NODE_USE_ENV_PROXY=1`. Les WebSocket
  n'y passent pas.

## Goals / Non-Goals

**Goals :**

- Un client automatisé s'authentifie avec un secret longue durée, stocké
  dans SES variables d'environnement, révocable à tout moment depuis l'admin.
- Une clé ne donne JAMAIS plus que son propriétaire, et la lecture seule est
  le défaut.
- Une clé fuitée se neutralise par une révocation, sans qu'elle ait pu
  fabriquer d'autres accès.
- Chaque action faite par clé se distingue d'une action faite à la main.

**Non-Goals :**

- Des clés pour les coachs (clé = outil d'admin ; le jour venu, la règle
  « propriétaire admin » se lève, le reste tient).
- Des portées fines par route ou par ressource : deux niveaux suffisent au
  besoin (recette en lecture, scénarios d'écriture assumés).
- Contourner le rate limit ou le mode maintenance.
- L'authentification Socket.IO par clé.

## Decisions

### D1 — Format `nak_<43 car. base64url>`, discriminé AVANT `jwt.verify`

32 octets aléatoires (`randomBytes`) encodés en base64url, préfixés `nak_`
(« Nuffle Arena Key »). Un JWT commence par `eyJ` : le préfixe aiguille sans
ambiguïté, et l'existant (JWT) ne change pas d'un octet. Deux en-têtes :
`Authorization: Bearer nak_…` (ce que tout client HTTP sait envoyer, et ce
qu'un injecteur de secret côté proxy pose) et `X-API-Key: nak_…`.

Alternative écartée : un en-tête dédié seul. Les outils (curl, clients
génériques, injection de secret réseau) savent tous poser un `Bearer`.

### D2 — Empreinte SHA-256 `@unique`, pas de bcrypt

Le secret a 256 bits d'entropie : une empreinte rapide suffit (un hachage
lent ne protège que des secrets devinables), et elle permet la recherche
directe par index unique, en une requête. Même posture que
`PasswordResetToken`. On garde aussi `keyPrefix` (les 12 premiers
caractères, ex. `nak_Ab12Cd34`) pour reconnaître une clé dans l'admin et
les journaux sans jamais réafficher le secret.

### D3 — Résolution en une requête, mémorisée sur la requête

`resolveApiKey(secret)` charge la clé ET son propriétaire
(`select` : rôle, rôles, `valid`, `deletedAt`, `bannedUntil`). La décision
est PURE (`evaluateApiKey(row, now)` dans `services/api-key-rules`) :
clé absente, révoquée, expirée, propriétaire supprimé / banni / désactivé
ou non admin ⇒ refus. La promesse de résolution est mémorisée par requête
(`WeakMap`, `middleware/apiKeyAuth`) : les `authUser` empilés par les
routeurs admin et `requireFeatureFlag` ne refont pas la requête. Le module est
séparé d'`authUser` pour que les tests qui remplacent `authUser` par un mock
ne privent pas `requireFeatureFlag` de la résolution.

`authUser` reste SYNCHRONE sur le chemin JWT (les tests existants appellent
le middleware sans `await`) ; seul le chemin clé est asynchrone.

### D4 — Les rôles viennent de la BASE, et le propriétaire doit être admin

Une clé ne porte aucun rôle : `req.user.roles` est relu sur le propriétaire
à chaque requête. Rétrograder un admin neutralise donc ses clés
immédiatement, sans passer par la page des clés. Les vérifications de rôle
qui lisent `req.user.roles` (et non la base) restent justes.

### D5 — Portée `read` | `write`

`read` : seules les méthodes sûres (`GET`, `HEAD`, `OPTIONS`) passent ;
toute autre méthode reçoit 403 (`api_key_read_only`), y compris sur une
route à authentification optionnelle — mieux vaut un refus explicite
qu'une écriture silencieusement faite en anonyme. `write` : tout ce que le
propriétaire peut faire. Le formulaire propose `read` par défaut.

### D6 — 401 indistinct, cause dans les logs

Clé inconnue, révoquée, expirée, propriétaire inéligible : même réponse
`401 { error: "Clé API invalide", code: "api_key_invalid" }`. Distinguer
« révoquée » de « inconnue » confirmerait à un tiers qu'une clé a existé.
La cause est journalisée côté serveur (avec le préfixe, jamais le secret).
Sur `optionalAuthUser`, une clé refusée est traitée comme un token
invalide : vue publique.

### D7 — `sessionOnly` : ce qu'une clé ne fait jamais

Middleware posé APRÈS l'auth : 403 (`interactive_session_required`) si la
requête est authentifiée par clé. Routes concernées :

- `/admin/api-keys/*` — une clé ne crée, ne liste ni ne révoque de clé ;
- `POST /admin/users/:id/impersonate` — émettrait un JWT qui survit à la
  révocation ;
- `PUT /auth/me`, `PUT /auth/me/password`, `DELETE /auth/me` — prendre ou
  détruire le compte propriétaire.

Le reste d'une clé `write` a le pouvoir de son propriétaire : c'est écrit
dans la doc et rappelé dans le formulaire.

### D8 — Expiration optionnelle, 90 jours par défaut dans l'UI

`expiresInDays` ∈ [1, 365] ou `null` (sans expiration). L'UI propose
7 / 30 / 90 / 365 jours / sans expiration, 90 présélectionné. Le serveur
n'impose pas d'expiration : c'est un choix d'admin, rendu visible dans la
liste (« sans expiration » en évidence).

### D9 — Dernier usage échantillonné, hors du chemin critique

`lastUsedAt` / `lastUsedIp` sont réécrits au plus une fois par minute et
par clé (`updateMany where lastUsedAt < now - 60 s`), sans `await` dans le
middleware : l'échec ou la lenteur de cette écriture ne retarde ni ne fait
échouer la requête.

### D10 — Traçabilité par le contexte d'audit

`setAuditActor` reçoit `apiKeyId` ; le contexte le porte ;
`recordTeamAudit` et `recordAdminActionFromRequest` l'écrivent dans une
colonne nullable `apiKeyId` (`TeamAuditEvent`, `AuditLog`). `null` =
action faite sans clé, ce qui est exactement l'état de tout l'historique.
Le journal d'audit admin affiche un badge « clé API » sur ces lignes.

### D11 — Rate limit et maintenance inchangés

Un smoke test tient en quelques dizaines de requêtes, sous les 100/min par
IP. Contourner la maintenance donnerait à la clé un privilège que même une
session admin n'a pas hors `/admin`. Si le besoin apparaît, la liste
blanche d'IP (`RATE_LIMIT_WHITELIST`) existe.

### D12 — Smoke test distant, pas la suite e2e

La suite `tests/e2e-api` dépend des routes `/__test/*`, absentes hors
`TEST_SQLITE`. Le smoke test est un script autonome
(`apps/server/src/scripts/remote-smoke.ts`), en lecture seule, dont la logique (liste
des vérifications, exécution, rapport) est pure et testée avec un `fetch`
injecté. `pnpm smoke:remote` pose `NODE_USE_ENV_PROXY=1` (sans effet hors
proxy). Sans `NUFFLE_API_KEY`, les vérifications authentifiées sont tout de
même tentées (un injecteur de secret côté proxy peut poser l'en-tête) et
marquées « ignorées » si le serveur répond 401.

## Risks / Trade-offs

- **Clé `write` fuitée** = pouvoir admin jusqu'à révocation. Atténué par la
  lecture seule par défaut, l'expiration par défaut, le dernier usage
  visible, `sessionOnly` et la révocation immédiate (aucun cache côté
  serveur).
- **Une requête de plus par appel par clé** (résolution). Négligeable pour
  du trafic d'automatisation ; mémorisée par requête.
- **Secret perdu** : il ne se réaffiche pas ; on en recrée une et on
  révoque l'ancienne.

## Migration Plan

`db push` crée `ApiKey` et les deux colonnes nullables. Aucun backfill.
Rollback : retirer le code ; la table et les colonnes restent inertes.
