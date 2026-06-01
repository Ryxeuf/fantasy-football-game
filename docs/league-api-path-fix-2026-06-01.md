# Fix — chemins API ligue `/league` → `/leagues` (2026-06-01)

## Symptôme

L'entrée de menu « 🏅 Ligues » ([`Header.tsx`](../apps/web/app/components/Header.tsx)) mène
vers `/leagues`. La page se charge (HTTP 200) mais affiche **« Erreur : HTTP 404 »**
dans son corps. Même symptôme sur tout le parcours ligue (détail, création,
saisons, calendrier, archives…).

## Cause racine

Mismatch **frontend ↔ backend** sur le préfixe de route :

- Le serveur Express monte les routes ligue au **pluriel** :
  `app.use("/leagues", leagueRoutes)` ([`apps/server/src/index.ts:258`](../apps/server/src/index.ts#L258)),
  et ce **depuis le tout premier commit ligue** (#271, avril 2026). Aucun mount
  `/league` singulier n'a jamais existé.
- Le client web appelait l'API au **singulier** `/league…` dans **tous** les
  consommateurs (`buildListPath`, détail, modals, calendrier, recap…).

`apiRequest` (`app/lib/api-client.ts`) ne fait que `fetch(\`${API_BASE}${path}\`)`
sans réécriture, et `API_BASE = NEXT_PUBLIC_API_BASE = https://server.nuffle-arena.orb.local`.
La requête réelle était donc `GET https://server.nuffle-arena.orb.local/league…`
→ **404** côté Express → `apiRequest` lève `ApiClientError("HTTP 404", 404)` →
la page rend `setError(err.message)` = « HTTP 404 ».

### Pourquoi non détecté plus tôt

- Feature gardée par `OnlinePlayGate` / flag online-play (non lancé en prod).
- Les tests unitaires mockent `apiRequest` / `fetch` → le vrai chemin n'était
  jamais exercé. Plusieurs mocks asserteent même le chemin singulier, masquant
  le bug.

Preuve serveur :

```
GET /league?status=all   -> 404   (route inexistante)
GET /leagues?status=all  -> 401   (existe, demande auth)
GET /leagues/themes      -> 200   (route publique, OK)
```

## Correctif

Le serveur fait foi (pluriel, conforme REST et au reste du repo : `admin/leagues`,
`nfl-fantasy/leagues`). Le **web** a été aligné sur `/leagues`.

**16 sites d'appel API** (11 fichiers source) `/league…` → `/leagues…` :

- `app/leagues/page.tsx` (`buildListPath`)
- `app/leagues/new/page.tsx` (POST création)
- `app/leagues/archived/page.tsx` (×2 : completed + archived)
- `app/leagues/seasons/page.tsx` (`/leagues/themes`, `/leagues/seasons/themed`)
- `app/leagues/[id]/page.tsx` (×4 : détail, season, standings)
- `app/leagues/[id]/{SeasonAdminPanel,JoinSeasonModal,NewSeasonModal,PlayoffBracketView,SeasonCalendar}.tsx`
- `app/leagues/[id]/seasons/[sid]/recap/page.tsx`

Les chemins de **navigation Next** (`href="/leagues/…"`, `router.push`) étaient
déjà au pluriel — inchangés.

**Tests** mis à jour (mocks/assertions sur l'URL appelée) :
`app/leagues/page.test.tsx`, `app/leagues/seasons/page.test.tsx`,
`app/leagues/[id]/page.test.tsx` (3 regex `\/league\/` → `\/leagues\/`).

**Bonus** : `app/auth-client.ts` — le fallback `inferApiBase()` pointait encore
sur l'ancien domaine périmé `server.fantasy-football-game.orb.local:8201`
(ancien nom de projet, port non routé). Corrigé en `https://server.nuffle-arena.orb.local`.

## Vérification

- `vitest run app/leagues` → **53/53** passent.
- `tsc --noEmit` (web) → clean.
- Container `nufflearena_web` en `next dev` + source bind-monté → hot-reload,
  recompilation sans erreur, **aucun rebuild nécessaire**.
- L'app mobile n'utilise aucun chemin `/league` singulier — non concernée.

## Garde-fou

> Convention : côté **web**, les endpoints ligue sont au **pluriel** `/leagues…`,
> alignés sur le mount serveur `app.use("/leagues", …)`. Tout nouvel appel doit
> utiliser le pluriel. Préférer des mocks de test qui matchent le **vrai** chemin
> serveur plutôt qu'un chemin inventé, sinon un mismatch passe inaperçu.
