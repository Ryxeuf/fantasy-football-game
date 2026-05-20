# 18 — Frontend Next.js V1 (Phase 3.A + 3.B admin)

> Frontend user-facing pour le module NFL Fantasy (Phase 3.A : dashboard +
> CRUD league + invite flow) + console admin (Phase 3.B :
> `/admin/nfl-fantasy` qui wrap les routes admin). Suit les conventions
> du repo (Next.js 14 app router, `apiRequest<T>`, "use client" en
> haut, hardcoded FR comme autorise par la vision section "Scope MVP".

## Pages livrees

```
apps/web/app/nfl-fantasy/
├── layout.tsx                         header + navigation
├── page.tsx                           dashboard "Mes leagues"
├── types.ts                           types partages (miroir API)
├── new/page.tsx                       formulaire createLeague
├── join/page.tsx                      formulaire join-by-code
└── leagues/[id]/page.tsx              detail + actions owner/member
```

### `/nfl-fantasy` — Dashboard

- `GET /api/nfl-fantasy/leagues` -> liste des leagues du user.
- Affiche un badge status (draft / in_progress / completed).
- CTA `+ Créer` et `Rejoindre`.
- Etat vide explicite quand 0 leagues.
- Si 401 -> CTA login.

### `/nfl-fantasy/new` — Créer

- Form Zod-aligne sur le service Phase 2.C :
  - `name` 3-50 chars
  - `teamName` 3-50 chars
  - `size` 2-16 (default 10)
  - `type` private / public
  - `draftMode` snake / auction / free
  - `seasonId` (V1 hardcoded "2025")
- `POST /api/nfl-fantasy/leagues` -> redirige sur `/leagues/[id]`.

### `/nfl-fantasy/join` — Rejoindre

- Form `inviteCode` + `teamName`.
- `POST /api/nfl-fantasy/leagues/join-by-code`.
- Mapping erreurs UX : 401 -> "Connecte-toi", 404 -> "Invite code
  invalide" (le service renvoie `INVALID_INVITE` -> 404 via
  `nfl-error-mapper`).

### `/nfl-fantasy/leagues/[id]` — Detail

- `GET /api/nfl-fantasy/leagues/:id` + `GET /auth/me` en parallele
  (pattern Q.B.3 — load detail + optional in Promise.all).
- Affiche :
  - Header (nom, status, taille `n/size`)
  - Block invite code copiable (clipboard API)
  - Liste des membres (badge `Owner` + badge `Toi`)
  - Actions contextuelles :
    - Owner + draft : Renommer, Toggle public/private, Supprimer
    - Member non-owner + draft : Quitter
    - !draft : message verrouille
- Toutes les actions cote service Phase 2.C (updateLeague / leaveLeague / deleteLeague).

## Conventions appliquees

| Aspect | Choix |
|---|---|
| Auth | `apiRequest` lit `auth_token` localStorage automatiquement |
| Error UX | `ApiClientError.status` distingue 401/404/autres |
| Styling | TailwindCSS via `globals.css` existant ; palette slate + accent orange |
| i18n | **Pas** d'i18n V1 (vision : OK de hardcode FR pour pages jetable) |
| Tests | `data-testid="nfl-fantasy-*"` parlants pour E2E Playwright futur |
| Redirections | `useRouter().push()` apres mutations success |

## Smoke test

```
curl -s -k -o /dev/null -w "%{http_code}\n" \
  https://web.nuffle-arena.orb.local/nfl-fantasy
```

Tous les 4 paths retournent 200 (Next.js compile fast-refresh OK,
aucun warning ni erreur dans `docker logs nufflearena_web`).

## Console admin — `/admin/nfl-fantasy` (Phase 3.B)

Page unique qui expose toutes les routes admin Phase 2.G avec des
formulaires + affichage JSON brut des reponses. Sert au debug
manuel + au rattrapage hors cron.

### Layout

- Reutilise `apps/web/app/admin/layout.tsx` (sidebar admin, mobile
  drawer).
- Nav item "🐀 NFL Fantasy" ajoute apres "Pro League" (l'emoji rat
  rappelle Skaven, race archetype du module).
- Check `fetchMe()` + redirect "/" si pas admin (pattern existant
  des autres pages admin).

### Composant `ActionCard`

Local au fichier. Encapsule :
- Header (titre + description + `METHOD endpoint`)
- Slot `children` pour les inputs Zod-alignes
- Bouton "Lancer" + indicateur OK/Erreur (avec status HTTP)
- Block `<pre>` qui affiche la reponse JSON formatee (max-h 64,
  scroll si gros payload)

### Sections

**Ingestion (Phase 2.A / 2.B)** — 5 cartes :
- Seed 32 NflTeam (no input)
- Seed saison (seasonId)
- Ingest nflverse W{n} (seasonId, weekNumber 1-22)
- ESPN gameday (dateYmd YYYYMMDD)
- ESPN rosters snapshot (seasonId + CSV teamCodes optionnel)

**League ops (Phase 2.D / 2.E / 2.F)** — 4 cartes :
- Lock lineups (weekId)
- Generer matchups (leagueId + weekId)
- Settle week (leagueId + weekId)
- Seed rerolls (entryId + count 1-50)

### UX

- Pattern validation Zod cote backend (le client ne duplique pas les
  bornes, juste les `pattern` HTML5 minimums pour bloquer l'envoi de
  caracteres absurdes).
- Affichage JSON brut volontaire : le module est en V1, l'admin sait
  lire la structure. Mise en forme conviviale (table d'ingestRun
  ulterieure) en V2.
- Footer avec liens vers `16-routes.md` et `17-crons.md` pour la
  reference complete.

### Smoke test

`/admin/nfl-fantasy` retourne **HTTP 307** vers
`/admin/sync?redirect=/admin/nfl-fantasy` (meme comportement que
`/admin/blog`) : c'est la sync auth cookie Next.js qui kicke avant
le render protected. Une fois sync OK, la page render normalement
pour les users admin et redirect "/" pour les autres.

## Hors scope (futurs lots frontend)

- **Lineup builder** drag-and-drop avec slots positionnels BB
  (Phase 3.C). Requiert d'abord un service `roster-fill` (draft) pour
  alimenter le NflFantasyRoster.
- **Matchups + standings UI** (Phase 3.D). Tableau + storytelling
  Gazette par matchup.
- **Mercato UI** : achat rerolls/inducements (Phase 3.E). Bloque
  par l'integration Wallet/Gold.
- **Vue audit log ingestRun** : table dediee dans la console admin
  pour visualiser les runs nflverse/ESPN passes (succes / partial /
  failed). V1 affiche juste le JSON de retour de chaque action.
- **i18n FR/EN** : a faire quand le module sera promu hors beta.
- **Tests Playwright E2E** : `apps/web/e2e/nfl-fantasy/` (cf.
  `10-architecture.md`).
