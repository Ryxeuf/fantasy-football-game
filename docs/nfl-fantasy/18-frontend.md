# 18 — Frontend Next.js V1 (Phase 3.A)

> Premier lot frontend pour le module NFL Fantasy : dashboard +
> CRUD league + invite flow. Suit les conventions du repo (Next.js
> 14 app router, `apiRequest<T>`, "use client" en haut, hardcoded FR
> comme autorise par la vision section "Scope MVP".

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

## Hors scope (futurs lots frontend)

- **Lineup builder** drag-and-drop avec slots positionnels BB
  (Phase 3.B). Requiert d'abord un service `roster-fill` (draft) pour
  alimenter le NflFantasyRoster.
- **Matchups + standings UI** (Phase 3.C). Tableau + storytelling
  Gazette par matchup.
- **Mercato UI** : achat rerolls/inducements (Phase 3.D). Bloque
  par l'integration Wallet/Gold.
- **Page admin** /admin/nfl-fantasy : invocation manuelle des ticks
  cron et de l'ingestion (Phase 3.E).
- **i18n FR/EN** : a faire quand le module sera promu hors beta.
- **Tests Playwright E2E** : `apps/web/e2e/nfl-fantasy/` (cf.
  `10-architecture.md`).
