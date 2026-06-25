# Invalidation du cache ISR (pages `/teams/*`)

Les pages de référence du front (`/teams`, `/teams/:slug`, `/teams/:slug/:position`)
sont en **ISR** (`revalidate = 3600`). Trois caches se superposent quand un
roster change (cf. aussi [high-elf-roster-s3-fix](./high-elf-roster-s3-fix-2026-06-05.md)) :

| Couche | Où | TTL | Invalidation |
| --- | --- | --- | --- |
| Next.js ISR (route + Data Cache des `fetch /api/rosters`) | conteneur `web` (`.next/cache`) | 1 h | régénération auto, ou `revalidateTag`/`revalidatePath`, ou recreate du conteneur |
| Mémoire serveur `memoizeAsync` sur `/api/rosters` | conteneur `server` | 5 min | `invalidateAllMemo()` (écritures), restart `server`, ou attente |
| HTTP `Cache-Control: max-age=3600` | navigateur | 1 h | hard refresh |

## Invalidation à la demande (route `POST /api/revalidate`)

Route Next protégée par `REVALIDATE_SECRET`
([apps/web/app/api/revalidate/route.ts](../apps/web/app/api/revalidate/route.ts)).
Accepte un `path` et/ou un `tag` (query) ou un corps JSON `{ paths?, tags? }`.

```bash
# Une page précise :
curl -X POST "https://nufflearena.fr/api/revalidate?path=/teams/underworld" \
  -H "x-revalidate-secret: $REVALIDATE_SECRET"

# Via tag (toutes les pages roster) :
curl -X POST "https://nufflearena.fr/api/revalidate" \
  -H "x-revalidate-secret: $REVALIDATE_SECRET" \
  -H "content-type: application/json" \
  -d '{"tags":["rosters"]}'
```

Les `fetch` roster sont taggés `rosters` + `roster:<slug>`, donc `revalidateTag`
les invalide de façon ciblée.

## Déclenchement automatique

Le serveur API appelle le front après chaque écriture roster — création /
édition / suppression / duplication (`admin-data.ts`) et `sync-rosters`
(`admin-utilities.ts`) — via
[`revalidateRosterPages`](../apps/server/src/services/revalidate-web.ts)
(best-effort, ne throw jamais). Aucune action manuelle n'est donc nécessaire en
usage normal.

### Configuration (env)

| Variable | Service | Rôle |
| --- | --- | --- |
| `REVALIDATE_SECRET` | `web` **et** `server` | secret partagé (identique des deux côtés). Absent → route 401 et helper no-op. |
| `WEB_REVALIDATE_URL` | `server` | origine interne du front, ex. `http://nufflearena_web:3100`. |

En prod, renseigner `REVALIDATE_SECRET` dans le `.env` (idéalement une valeur
aléatoire). Sans secret, la fonctionnalité est désactivée proprement (no-op).

## Repli manuel (si la route est indisponible)

```bash
docker compose restart server                 # vide le cache mémoire 5 min
docker compose up -d --force-recreate web     # repart d'un .next/cache neuf
```

`docker compose restart web` ne suffit pas (même conteneur → cache conservé).
