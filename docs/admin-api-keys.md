# Clés API d'administration

Permet à un client **automatisé** — un agent Claude Code dans un environnement
cloud, un script de recette, une CI — d'appeler l'API au nom d'un admin, avec un
secret longue durée stocké dans SES variables d'environnement. Révocable à tout
moment, lecture seule par défaut. Change OpenSpec `admin-api-keys`.

## Créer une clé

1. `/admin/api-keys` (menu « Système » → « Clés API ») → « + Nouvelle clé ».
2. Nom, portée (**lecture seule** recommandée), expiration (90 jours par
   défaut ; 7 / 30 / 90 jours, 1 an ou sans expiration).
3. Le secret (`nak_…`) et les variables à déclarer s'affichent **une seule
   fois**. Perdu = on en crée une autre et on révoque l'ancienne.

La clé appartient à l'admin qui la crée et agit en son nom.

## Brancher la clé sur Claude Code (environnement cloud)

1. Dans les réglages de l'environnement cloud (menu de l'environnement dans la
   barre de titre de la session, puis « Modifier »), déclarer :

   ```
   NUFFLE_API_URL=https://api.nufflearena.fr
   NUFFLE_API_KEY=nak_…
   ```

   Selon la version de l'application, la clé peut aussi se déclarer comme
   secret réseau pour l'hôte `api.nufflearena.fr` : le proxy pose alors
   l'en-tête lui-même et `pnpm smoke:remote` fonctionne sans `NUFFLE_API_KEY`.
2. **Ne jamais coller la clé dans une conversation** : elle y serait stockée.
3. L'hôte `api.nufflearena.fr` doit être joignable depuis l'environnement
   (niveau d'accès réseau, ou domaine autorisé).
4. Ouvrir une **nouvelle** session (les variables sont lues au démarrage) et
   demander « lance le smoke test distant ».

## Utiliser la clé

Deux en-têtes acceptés, partout où un token de session l'est :

```bash
curl -H "Authorization: Bearer $NUFFLE_API_KEY" "$NUFFLE_API_URL/auth/me"
curl -H "X-API-Key: $NUFFLE_API_KEY" "$NUFFLE_API_URL/admin/stats"
```

`GET /auth/me` décrit le propriétaire et annonce la clé
(`user.apiKey = { name, keyPrefix, scope }`).

### Smoke test distant

```bash
pnpm smoke:remote            # rapport lisible, code de sortie 1 si un échec
pnpm smoke:remote -- --json  # rapport JSON
```

Script : [`apps/server/src/scripts/remote-smoke.ts`](../apps/server/src/scripts/remote-smoke.ts).
Santé (`/health`, `/health/ready`), lectures publiques, identité de la clé
(`/auth/me` doit annoncer un admin authentifié par clé), lectures admin, et un
garde-fou : `POST /admin/api-keys` DOIT être refusé (403). Aucune vérification
n'écrit quoi que ce soit ; le secret n'est jamais affiché (`nak_***`). Sans
clé, les vérifications authentifiées sont « ignorées » sur 401.

`smoke:remote` pose `NODE_USE_ENV_PROXY=1` : le `fetch` natif de Node 22 ne
suit le proxy HTTPS des environnements cloud qu'avec cette variable (sans effet
ailleurs).

## Portée

| Portée | Méthodes | Usage |
|---|---|---|
| `read` (défaut) | `GET`, `HEAD`, `OPTIONS` ; toute autre ⇒ 403 `api_key_read_only` | smoke tests, diagnostics, lectures admin |
| `write` | toutes | scénarios de recette qui écrivent, en connaissance de cause |

Une clé `write` a **le pouvoir de son propriétaire**, à une exception près :
les actions réservées à une session interactive (ci-dessous).

## Sécurité

- **Secret** : 32 octets aléatoires base64url, préfixe `nak_`. Seule
  l'empreinte SHA-256 est stockée (`ApiKey.keyHash @unique`), plus un préfixe
  d'identification de 12 caractères (`keyPrefix`). Création et révocation
  journalisées (`api-key.create` / `api-key.revoke`) **sans** le secret.
- **Rôles relus en base** à chaque requête, avec la même résolution que la
  connexion (`roles ?? role`) : rétrograder un admin neutralise ses clés.
- **Refus** (401 `api_key_invalid`, même réponse quelle que soit la cause) :
  clé inconnue, révoquée, expirée ; propriétaire supprimé, banni, désactivé ou
  qui n'est plus admin. La cause est dans les logs serveur, avec le préfixe.
- **Réservé à une session interactive** (403 `interactive_session_required`,
  middleware `sessionOnly`) : gestion des clés (`/admin/api-keys/*`),
  impersonation, `PUT /auth/me`, `PUT /auth/me/password`, `DELETE /auth/me`.
  Une clé fuitée ne peut pas se perpétuer en fabriquant un autre accès.
- **Révocation immédiate** : aucune mise en cache côté serveur.
- **Traçabilité** : `AuditLog.apiKeyId` et `TeamAuditEvent.apiKeyId` (via le
  contexte d'audit) ; le journal d'audit admin affiche un badge « 🔑 clé API ».
  Dernier usage (date + IP) visible dans l'admin, écrit au plus une fois par
  minute, hors du chemin critique.

## Code

| Rôle | Fichier |
|---|---|
| Règles pures (format, éligibilité, portée, expiration) | `apps/server/src/services/api-key-rules.ts` |
| Lecture / écriture | `apps/server/src/services/api-keys.ts` |
| Authentification par clé (résolution mémorisée par requête) | `apps/server/src/middleware/apiKeyAuth.ts` |
| Branchement | `authUser`, `optionalAuthUser`, `requireFeatureFlag`, `/api/feature-flags/me` |
| Session interactive exigée | `apps/server/src/middleware/sessionOnly.ts` |
| Routes admin | `apps/server/src/routes/admin-api-keys.ts` |
| Page admin | `apps/web/app/admin/api-keys/page.tsx` |

## Limites volontaires

- Clés réservées aux admins (le propriétaire doit l'être).
- Deux portées seulement, pas de portée par route.
- Rate limit (100 requêtes/min par IP) et mode maintenance inchangés : une clé
  n'en contourne aucun.
- Pas d'authentification Socket.IO par clé (le proxy des environnements cloud
  ne laisse de toute façon pas passer les WebSocket).
- La suite `tests/e2e-api` ne vise pas un serveur distant : elle dépend des
  routes `/__test/*`, absentes hors `TEST_SQLITE`.

## Tests

- Serveur : `api-key-rules.test.ts`, `api-keys.test.ts`,
  `middleware/apiKeyAuth.test.ts`, `routes/admin-api-keys.test.ts` (chaîne
  Express réelle, `/auth/me`, `sessionOnly` sur `/auth`),
  `admin-impersonate.test.ts` (refus par clé), `audit-log.test.ts`,
  `team-audit.test.ts`, `audit-context.test.ts`,
  `scripts/remote-smoke.test.ts`.
- Web : `lib/admin-api-keys.test.ts`, `admin/api-keys/page.test.tsx`,
  `admin/audit-log/page.test.tsx`.
