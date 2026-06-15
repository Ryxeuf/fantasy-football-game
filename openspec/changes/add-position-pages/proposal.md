# Pages par position de roster (detail + indexation SEO)

## Why

On dispose deja d'une page par competence (`/skills/[slug]` : index +
detail + structured data + sitemap longue-traine). L'audit `/ideas` du
2026-06-15 demande la meme chose **par position de chaque roster** : une
page detail par poste (Lineman, Blitzer, Gutter Runner, Trois-Quart
Humain...) qui servira de socle aux futures etudes/stats joueurs.

L'exploration (`/opsx:explore`, consignee dans
`docs/roadmap/backlog/future-ideas.md` Annexe B) a etabli le point cle :
**la donnee d'une position est deja servie en entier** par l'endpoint
existant `GET /api/rosters/:slug`. Chaque position y porte deja `slug`,
`displayName`, `cost`, `min`/`max`, `ma`/`st`/`ag`/`pa`/`av`, `skills`
(CSV de slugs de competences), `primarySkills`, `secondarySkills`. La page
roster `/teams/[slug]` les **liste deja** — mais aucune n'est cliquable
vers une page dediee.

Il manque donc uniquement :
1. la **page detail** par position (front, calquee sur `/skills/[slug]`) ;
2. l'**indexation** de ces ~200-280 URLs season_3 (sitemap + JSON-LD).

Aucun nouvel endpoint, aucune migration Prisma : le MVP est une addition
purement front qui reutilise un fetch deja en cache ISR (1h).

## What Changes

- **Brique 1 — Page detail position** `/teams/[slug]/[position]`. Route
  Next.js imbriquee calquee sur `/skills/[slug]` : header stats
  (MA/ST/AG/PA/AV) + cout + bornes min/max + skills de base **lies vers
  `/skills/[slug]`** + acces competences (categories G/A/S/P/M) + positions
  liees (meme roster) + fil d'Ariane + `generateMetadata` + structured
  data. Reutilise `GET /api/rosters/:slug` et selectionne la position par
  slug reconstruit.
- **Brique 2 — Indexation SEO.** Enumerer les URLs position des rosters
  season_3 dans `apps/web/app/sitemap.ts` (calque du bloc skills) +
  JSON-LD d'index. Canonical = season_3 sans param.
- **Brique 3 — Liens & garde d'invariant.** Rendre les positions de
  `/teams/[slug]` cliquables, et ajouter un test verifiant que
  `roster.slug` prefixe bien le slug de chacune de ses positions (les 30
  rosters S3) — invariant dont depend la reconstruction du slug d'URL.

## Impact

- **Capability** : nouvelle spec `position-pages` (page detail par
  position + resolution de slug + maillage interne + indexation + invariant
  de prefixe).
- **Code (front uniquement)** :
  - `apps/web/app/teams/[slug]/[position]/page.tsx` (nouveau) +
    `position-detail-structured-data.ts` (+ `layout.tsx` si metadata
    separee) ;
  - `apps/web/app/teams/[slug]/TeamDetailClient.tsx` (positions cliquables) ;
  - `apps/web/app/sitemap.ts` (bloc positions season_3) ;
  - util pur de resolution/nettoyage de slug + tests.
- **Aucune migration Prisma, aucun nouvel endpoint serveur, aucun
  changement de contrat d'API.** Reutilise `GET /api/rosters/:slug`.

## Non-Goals

- **B.5 — Normalisation bilingue** (`Position.displayNameEn`, nettoyage du
  marqueur `*` "big guy", incoherence des noms Season 2 EN / Season 3 FR) :
  fast-follow, cadre en design. NON bloquant — le hreflang single-URL est
  deja en place (`fr-FR`/`en`/`x-default` pointent la meme URL).
- **B.4 — Endpoint serveur `/api/positions` dedie** (le proxy web
  `app/api/positions/route.ts` pointe un endpoint inexistant) :
  optimisation / filtres differable.
- **B.3 — Etudes/stats d'usage reelles par position** : objectif aval ; la
  page de cette brique est la **surface d'affichage** future, pas le
  pipeline de stats.
- **OG image dynamique par position** : optionnel ; MVP = logo statique
  comme `/skills/[slug]`.
